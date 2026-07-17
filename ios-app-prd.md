# Nyack Today iOS App — PRD & Engineering Spec
**Scope:** Phase 0 (Foundations) + Phase 1 (MVP: Events + "Tonight in Nyack" push)
**Status:** Draft for agent handoff (Claude Fable 5)
**Owner:** Danny
**Last updated:** 2026-07-17

> Phases 2–4 (News/Alerts, Utilities, Dining/Business) are intentionally not specced here — see Appendix A. Don't let an agent start on them; scope creep here is the main risk to shipping the MVP.

---

## 1. Why this exists

Nyack Today (web) already aggregates events from 16+ sources into a "tonight-first" public API. It has no daily presence on a resident's phone — people visit it when planning a weekend, not every day. The iOS app's job is to become the thing every Nyack resident opens daily, starting with the data that already exists (events) and the one feature most likely to drive that daily habit: a **"Tonight in Nyack" push notification**.

Events are the reason people download the app. The notification is the reason they keep it.

## 2. Users & success criteria

**User:** A Nyack resident with an iPhone who currently either doesn't know what's happening locally or checks the website inconsistently.

**MVP success bar** (this is a personal/tester build, not an App Store launch yet):
- You and a handful of local testers have the app installed via TestFlight and use it without you manually walking them through bugs.
- The Tonight push fires correctly every day, on time, with the right event, and tapping it opens the right event detail screen.
- Favorites persist across app restarts and airplane-mode/offline launches.
- Nothing in the existing website or its public API breaks because of backend changes made to support the app.

**Explicitly not success criteria yet:** app store approval, non-tester adoption, monetization, Android.

## 3. Non-goals for this spec (do not build)

- No user accounts / sign-in (device-local personalization only — see §5).
- No community/UGC feed.
- No News/Alerts, Utilities, or Dining/Business features (Phases 2–4, deferred).
- No Android build (Expo makes it possible later; not now).
- No monetization code of any kind.
- No Widget/WidgetKit work in this spec — that's Phase 1b, follow-on, and is the one part of this project that is real native Swift. Do not let an agent bundle it into Phase 1 "since it's related."

If an agent proposes work outside this list, that's a signal to stop and re-scope, not to let it "add value."

## 4. Decisions already made (do not relitigate)

| Decision | Rationale |
|---|---|
| Expo (managed workflow) / React Native, not native Swift | Reuses TypeScript/Next.js skills; cross-platform for later Android |
| No accounts in MVP; favorites/prefs stored device-local (AsyncStorage + Zustand) | Avoids Sign-in-with-Apple requirement and all PII burden |
| Push via Expo's push service (ExponentPushToken), not raw APNs | Expo manages the APNs key; `expo-server-sdk` handles chunking/receipts |
| TanStack Query + AsyncStorage persister for server data | App opens instantly with last-known events; offline support |
| Two-repo split: existing Next.js repo (backend changes) + new Expo repo (app) | Clean agent/ownership boundary; backend must stay backward-compatible forever |
| Public API params/shape are append-only forever | Installed app versions will call old endpoints for years; breaking them breaks old installs silently |
| Stable event IDs: one-time = DB cuid, recurring instance = `parentId-YYYY-MM-DD` (synthetic, not in DB) | Favorites and deep links depend on this resolving correctly for years |

## 5. Architecture summary

```
Existing: Scrapers/AI ingest → Prisma/Postgres (Supabase) → Next.js API (/api/events) → Web

New backend surface (same Next.js repo):
  • GET  /api/events/[id]
  • POST /api/devices            (push token registration)
  • POST /api/push/tonight       (cron, sends daily notification)
  • POST /api/push/send          (admin ad-hoc, e.g. emergencies)
  • Device model (Prisma)
                    │
                    ▼
New Expo iOS app (new repo, e.g. nyack-app/):
  • expo-router (Today / Browse / Saved / More tabs)
  • TanStack Query + AsyncStorage persister
  • Zustand + AsyncStorage (device-local favorites, notification prefs)
  • expo-notifications
  • EAS Build/Submit/Update
```

No accounts anywhere in this diagram. Personalization = device state only.

---

## 6. Phase 0 — Foundations

**Outcome:** Both repos can build, deploy, and talk to each other safely, with the one pre-existing security hole closed, before any user-facing screen exists.

**Scope boundary:** No app screens beyond a scaffold. No push. No new user-facing behavior.

### 6.1 Close the admin-auth gap (launch blocker — do this first, before anything else)

- **Constraint:** Several `/api/admin/*` GET routes currently have no server-side auth and leak subscriber emails/submissions. This must be fixed before the app's existence draws any traffic to the domain, independent of the app itself.
- **Task:** Apply the existing `checkAuth()` guard (pattern already used in `src/app/api/digest/route.ts`) to every unauthenticated `/api/admin/*` GET route.
- **Verification:** `curl` each previously-open admin GET route without credentials → expect 401/403, not 200 with data. List the specific routes fixed in the PR description.

### 6.2 Freeze the public API contract

- **Task:** Write `docs/public-api.md` documenting every param and response field of `GET /api/events` and `GET /api/activities` as they exist today. Mark it "append-only" — new fields/params may be added, nothing removed or renamed.
- **Verification:** Doc exists, checked into the Next.js repo, and the current live API's actual response is diffed against it (no undocumented fields).

### 6.3 CORS wrapper for public read routes

- **Task:** Add a CORS wrapper (`src/lib/api/response.ts` or equivalent) so the Expo app (different origin) can call `/api/events` and `/api/activities` directly.
- **Verification:** A request from a non-web-app origin (e.g. `curl -H "Origin: exp://localhost"`) succeeds against the public read routes; write-routes and admin routes remain unaffected.

### 6.4 Expo app scaffold

- **Task:** New repo/directory. `expo-router` with four tabs (Today, Browse, Saved, More) as empty screens. Typed API client (`src/api/client.ts`, `src/types/api.ts`) hitting the **live production** `/api/events` (read-only — safe against prod).
- **Verification:** App runs in Expo Go, all four tabs render, Today tab fetches and displays real event titles from production (visually confirm at least one real event name on screen).

### 6.5 EAS project + TestFlight pipeline

- **Task:** EAS project created, `eas.json` with three profiles (development/dev-client, preview/TestFlight, production). Apple Developer account enrolled (human step — flag to Danny, not delegable to the agent).
- **Verification:** `eas build --profile preview` completes successfully and produces an installable build; build is submitted to TestFlight and installs on Danny's physical device.

---

## 7. Phase 1 — MVP: Events + "Tonight in Nyack" push

**Outcome:** A resident can browse/search/filter events, save favorites that survive restarts and offline launches, see a real event detail screen, and receives a daily push naming tonight's best event that deep-links to it.

**Scope boundary:** No accounts. No widget (Phase 1b). No news/alerts/utilities/business. No Android build.

### 7.1 Backend: single-event endpoint

- **Constraint:** Must handle the stable-ID contract (§4) — one-time cuid vs. synthetic recurring-instance ID `parentId-YYYY-MM-DD` — and 404 cleanly on a non-occurrence date rather than erroring.
- **Task:** `src/app/api/events/[id]/route.ts`. Centralize ID parse/format logic as `getEventByStableId` in `src/lib/utils/events-query.ts` (single source of truth — do not duplicate parsing elsewhere). Reuse `generateRecurringInstances` from `src/lib/utils/recurrence.ts`. Same `Cache-Control` behavior as the list route.
- **Verification (scriptable):**
  - `curl /api/events/[one-time-cuid]` → 200, full event payload.
  - `curl /api/events/[parentId]-[valid-future-date]` → 200, materialized instance.
  - `curl /api/events/[parentId]-[date-with-no-occurrence]` → 404, not 500.
  - Unit tests exist and pass for `getEventByStableId` covering all three cases above.

### 7.2 Backend: Device model + registration endpoint

- **Task:** Prisma migration adding `Device { id, expoPushToken @unique, platform, appVersion, wantsDailyTonight, wantsAlerts, alertMinSeverity, isActive, lastSeenAt, createdAt }`. `POST /api/devices` upserts by `expoPushToken` (idempotent — safe to call every app launch), validates token shape, rate-limited, no auth (device isn't logged in).
- **Constraint:** Check Supabase RLS — confirm the anon key can reach `Device` appropriately (write access for registration, no broad read access to other devices' tokens).
- **Verification:** `npx prisma migrate dev` + `npx prisma generate` succeed. Calling `POST /api/devices` twice with the same token results in one row, updated `lastSeenAt`, not two rows. Confirm via Prisma Studio or a direct query that RLS blocks reading other devices' tokens from the anon key.

### 7.3 Backend: Tonight push (cron) + admin ad-hoc push

- **Task:** `src/lib/push/send.ts` — Expo push fan-out via `expo-server-sdk`; handle `DeviceNotRegistered` receipts by flipping `Device.isActive = false`. `src/app/api/push/tonight/route.ts` — cron-authed (reuse the `CRON_SECRET` bearer-token pattern from the digest route), composes from `queryEvents({dateFilter: 'tonight'})`, optional one-line summary (reuse `generateWeeklySummary`'s gpt-4o-mini pattern), targets only devices with `wantsDailyTonight = true` and `isActive = true`. `src/app/api/push/send/route.ts` — admin-authed ad-hoc send (for manually firing an alert before Phase 2 exists). Add the cron to `vercel.json` alongside existing scrape/digest crons.
- **Verification:**
  - Local: `curl -H "Authorization: Bearer $CRON_SECRET" /api/push/tonight` fires correctly; confirm it selected tonight's actual top event and only targeted opted-in, active devices (log the count).
  - On a physical device: register via the app, confirm the Expo token appears in the `Device` table, fire the cron manually, confirm the push arrives in foreground, background, and killed-app states.
  - Tapping the push opens the app directly to the correct event detail screen (deep link), not just the Today tab.
  - Send to a token that's since been deregistered → confirm `Device.isActive` flips to `false` and it's excluded from the next send.
- **Content eval (not a unit test — a quality check):** Before shipping, build a golden set of ~10–15 known "tonight" event lists (including edge cases: zero events, one event, a free event, a paid event) and manually review the generated one-liner for each. Reject: hallucinated details not in the source event, tone inconsistent with the rest of the app, anything that reads as ad copy for a specific venue. This isn't scriptable pass/fail — it's a judgment review, budget 15 minutes for it before every model/prompt change to this pattern.

### 7.4 App: Today / Browse / Saved tabs

- **Task:** Today tab = tonight-first list (mirrors web's core UX). Browse tab = filters mirroring `/api/events` params (date, category, price, family-friendly) **plus free-text search**, which the web app currently lacks. Saved tab = device-local favorites via Zustand + AsyncStorage, keyed on the **stable event ID** (§4), not a synthetic per-render key.
- **Verification:**
  - Favoriting an event in Browse, then killing and relaunching the app, shows it still favorited in Saved.
  - Turning on airplane mode and relaunching shows the last-cached event list within ~1 second (TanStack Query + AsyncStorage persister working), not a blank/error screen.
  - Search returns correct results for a partial title match against a real production event.
  - Favoriting a recurring event, then confirming it still resolves correctly if that specific date's instance is later requested via 7.1 above (cross-check with the ID contract, don't let this silently break).

### 7.5 App: Event Detail screen

- **Task:** New screen (the web app has none — its cards just deep-link out to source URLs). Full event info, add-to-calendar, share sheet, "favorite" toggle, deep-link target for both push notifications and universal links.
- **Task (backend):** `public/.well-known/apple-app-site-association` for universal links, so a shared/tapped link opens the app (if installed) instead of the browser.
- **Verification:** Opening a shared universal link on a device with the app installed opens the app directly to that event's detail screen, not Safari. Add-to-calendar produces a correct `.ics`/calendar entry with the right date/time in `America/New_York`.

---

## 8. Testing plan

| Layer | Tool | What it covers |
|---|---|---|
| Unit | Jest | `getEventByStableId`, recurrence parsing, date/timezone utils, push receipt handling |
| API contract | `curl` / a small script (or Vitest + supertest) | Every endpoint in §7.1–7.3, including error cases (404s, auth failures) |
| App logic | Jest + React Native Testing Library | Favorites store, query client offline behavior, filter logic |
| E2E (device flows) | Maestro (lighter weight than Detox for a solo dev) | Launch → browse → favorite → relaunch → still favorited; push tap → correct detail screen |
| Manual/device-only | Physical iPhone + TestFlight | Push delivery in foreground/background/killed states; universal links from Safari/Messages; offline launch |

**Gate rule for the agent:** nothing in §7 is "done" on the basis of code compiling or a static check. Each verification bullet must actually be run and its real output reported (curl output, test run output, or a description of what was observed on-device), per Phase. Treat a blocked permission (e.g. can't access a physical device) as a stop-and-ask signal, not something to route around or fake.

## 9. Recommended multi-agent execution plan

Given this is a two-repo project with a clean boundary, a simple three-role pattern works better than a single mega-session:

- **Coordinator** — holds this PRD, breaks each Phase into the task-sized units already listed in §6–7, and doesn't write implementation code itself.
- **Implementor(s)** — one per independent task where possible. Backend tasks (§7.1–7.3) and app tasks (§7.4–7.5) can run as separate sessions/sub-agents since they're different repos and don't share files, reducing merge conflicts.
- **Verifier** — runs the verification bullets for a task before it's marked complete, and rejects back to the Implementor with specifics if a bullet fails. Don't let the Implementor self-certify its own task as done.

Suggested session shape: one Coordinator session per Phase (0, then 1), spawning Implementor sub-agents per numbered subsection above, with the Verifier gate before moving to the next subsection. Phase 1's backend tasks (7.1–7.3) should complete and be verified before the app tasks that depend on them (7.4–7.5) start, since Browse/Saved/push all call those endpoints.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Stable ID contract breaks (recurring event reschedules, old favorited ID no longer resolves) | Centralize parsing in one helper (§7.1); show "event updated/removed" in-app rather than crashing |
| Breaking the public API breaks old installed app versions silently | Treat `/api/events` params/shape as append-only forever (§4); version via new endpoints only |
| Push is best-effort, not guaranteed delivery | Acceptable for MVP (not an emergency channel yet — that's Phase 2, with its own disclaimer requirement) |
| App Store review flags this as a "thin web wrapper" (Guideline 4.2) | Native nav + offline cache + push + favorites give it enough native substance; Widget (1b) adds more if needed |
| Admin auth gap (§6.1) | Fix before any app-driven traffic increase, independent of app timeline |

## 11. Definition of done for the MVP

- Phase 0 and Phase 1 verification criteria above all pass, with real output/evidence, not just "should work."
- Internal TestFlight build installed on Danny's device (and any local testers').
- Smoke test: offline launch shows cached events, Tonight push fires and deep-links correctly, favorites survive a restart, universal link from Safari opens the app.
- No regressions on the live website or its public API (spot-check `/api/events` and `/api/activities` still return identical shape to `docs/public-api.md`).

---

## Appendix A — Deferred phases (not specced, one paragraph each)

**Phase 1b (Widget):** WidgetKit/SwiftUI extension via `@bacons/apple-targets` Expo config plugin, sharing today's events through an App Group container. The one piece of real native Swift work in this project — needs EAS Build + a physical device, can't run in Expo Go. Sequenced after Phase 1's notification, same retention value, more native effort.

**Phase 2 (News & Alerts):** `NewsItem` model + `AlertSeverity` enum, severity-filtered push reusing Phase 1's plumbing, ingestion from existing `nyackvillage.ts`/`patch.ts` scrapers. Needs an explicit in-app disclaimer ("not an official emergency channel") and admin kill-switch before shipping — liability-sensitive, do not rush.

**Phase 3 (Utilities):** Trash/recycling calendar, parking rules, farmers-market schedule — mostly bundled JSON with an `AppConfig` override endpoint for fixing data without an app release. On-device local notification scheduling, no server push.

**Phase 4 (Dining/Business):** New `Business` model (don't overload the existing `Activity` model's unstructured `hours` text) with structured hours/lat/lng/status, "open now" computed logic. Largest curation burden and closest to monetization — build last, write no monetization code until there's a concrete plan.

## Appendix B — Open questions before an agent starts Phase 0

- Is the Apple Developer account enrolled yet? (Human step, blocks EAS Submit.)
- New repo name/location for the Expo app — confirmed as sibling repo, or nested in a `nyack-app/` directory?
- Who owns tone/review of the Tonight push one-liner copy before it ships to testers?
