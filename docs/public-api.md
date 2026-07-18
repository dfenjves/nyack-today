# Public API contract (iOS app + external clients)

These endpoints are consumed by the Nyack iOS app and are a **stable, append-only
contract**. Installed app versions call them for years, so:

- **Never rename or repurpose** an existing query param or response field.
- **Never change** the meaning of an existing value (e.g. `date=tonight`).
- Add capability via **new params or new endpoints**, never by mutating these.
- Treat every event `id` as **opaque** (see stable ids below).

All responses set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

---

## `GET /api/events`

List events. Recurring events are expanded into per-occurrence instances.

| Param | Values | Meaning |
|---|---|---|
| `date` | `tonight` \| `tomorrow` \| `weekend` \| `week` \| `custom` | Date window. Omit for the default ~30-day upcoming window. |
| `customDate` | ISO date | Only with `date=custom`. |
| `category` | `Category` enum | Filter to one category. |
| `free` | `true` | Free events only. |
| `familyFriendly` | `true` | Family-friendly only. |
| `nyackOnly` | `true` | Nyack-proper only. |
| `nearbyOnly` | `true` | Non-Nyack only. |
| `marquee` | `true` | Featured/marquee events only. |
| `limit` | int (default 50, one-time cap 100) | Page size. |
| `offset` | int (default 0) | Pagination offset. |

Response:

```json
{
  "events": [ /* Event objects */ ],
  "pagination": { "total": 0, "limit": 50, "offset": 0, "hasMore": true }
}
```

Note: `pagination.total` is `offset + events.length` (not a true count) and
`hasMore` is heuristic. Clients should paginate by advancing `offset` until a
short page is returned.

## `GET /api/events/[id]`

Single event by its stable id. Returns `{ "event": Event }` or `404`.

## `GET /api/activities`

Always-available activities directory. Param `category` (or `ALL`). Returns
`{ "activities": [ /* Activity objects */ ] }`.

---

## Stable event ids

The `id` on every event is opaque and comes in two shapes:

- **One-time event** — the Prisma cuid, e.g. `cmqs0ncrt0008l2042hg5pbvv`.
- **Recurring occurrence** — `${parentId}-${YYYY-MM-DD}`, e.g.
  `cmqs...-2026-07-21`. The date suffix is the occurrence's **UTC** date.

Both resolve via `GET /api/events/[id]`. The app keys favorites and deep links
on this id. If a recurring event's schedule later changes, a previously-saved
occurrence id may stop resolving (returns 404) — clients must degrade
gracefully (show "event updated or removed"), never crash.

Parse/format logic lives in one place: `getEventByStableId` in
`src/lib/utils/events-query.ts` and the id synthesis in
`src/lib/utils/recurrence.ts`. Keep them in sync.

---

## Push notifications (device-facing)

- `POST /api/devices` — register/refresh a device (idempotent upsert on
  `expoPushToken`). `PATCH` updates notification prefs; `DELETE` deactivates.
- Push payloads include `data.url` as a deep link, e.g.
  `nyacktoday://event/<stableId>`.

Cron/admin-only (not for the app): `POST /api/push/tonight` (also a daily Vercel
cron), `POST /api/push/send` (admin ad-hoc, `x-admin-password`).
