# Nyack iOS app — scaffolding guide (separate `nyack-app` repo)

The app is a standalone Expo project that consumes the Nyack Today public API
(see [public-api.md](public-api.md)). It lives in its own repo, not in this one.

Prereqs: Node 18+, an Apple Developer account ($99/yr, needed for push + App
Store), and the Expo tooling (`npm i -g eas-cli`). Use a physical iPhone for
push testing (the simulator can't receive remote push).

---

## 1. Create the project

```bash
cd ~/Development
npx create-expo-app@latest nyack-app   # pick the "Navigation (TypeScript)" template
cd nyack-app
git init && git add -A && git commit -m "chore: bootstrap expo app"
```

This gives you expo-router (file-based routing), TypeScript, and a tab layout.

## 2. Install dependencies

```bash
# data + state
npx expo install @tanstack/react-query @react-native-async-storage/async-storage
npm install @tanstack/query-async-storage-persister @tanstack/react-query-persist-client zustand
# native capabilities
npx expo install expo-notifications expo-device expo-constants expo-linking expo-calendar
```

## 3. Configure `app.json` (scheme, notifications, EAS)

Set the deep-link scheme to `nyacktoday` so push payloads
(`nyacktoday://event/<id>`, which `/api/push/tonight` already sends) open the
right screen:

```jsonc
{
  "expo": {
    "name": "Nyack",
    "slug": "nyack-app",
    "scheme": "nyacktoday",
    "ios": {
      "bundleIdentifier": "today.nyack.app",
      "supportsTablet": false,
      "infoPlist": { "UIBackgroundModes": ["remote-notification"] }
    },
    "plugins": ["expo-notifications"]
  }
}
```

## 4. API client (points at production)

`src/api/client.ts`:

```ts
// Native apps aren't subject to browser CORS, so we call the API directly.
const BASE_URL = 'https://nyacktoday.com'

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`)
  return res.json()
}
```

`src/types/api.ts` — hand-mirror the JSON shape (keep it in sync with the
frozen contract; dates arrive as ISO strings):

```ts
export type Category =
  | 'MUSIC' | 'COMEDY' | 'MOVIES' | 'THEATER' | 'FAMILY_KIDS' | 'FOOD_DRINK'
  | 'SPORTS_RECREATION' | 'COMMUNITY_GOVERNMENT' | 'ART_GALLERIES'
  | 'CLASSES_WORKSHOPS' | 'OTHER'

export interface EventDTO {
  id: string            // opaque; recurring occurrences look like `${id}-YYYY-MM-DD`
  title: string
  description: string | null
  startDate: string     // ISO
  endDate: string | null
  venue: string
  address: string | null
  city: string
  isNyackProper: boolean
  category: Category
  price: string | null
  isFree: boolean
  isFamilyFriendly: boolean
  sourceUrl: string
  imageUrl: string | null
  isMarquee: boolean
}

export interface EventsResponse {
  events: EventDTO[]
  pagination: { total: number; limit: number; offset: number; hasMore: boolean }
}
```

`src/api/events.ts`:

```ts
import { apiGet } from './client'
import type { EventDTO, EventsResponse } from '../types/api'

export const fetchEvents = (qs = '') =>
  apiGet<EventsResponse>(`/api/events${qs ? `?${qs}` : ''}`)

export const fetchEvent = (id: string) =>
  apiGet<{ event: EventDTO }>(`/api/events/${encodeURIComponent(id)}`).then((r) => r.event)
```

## 5. TanStack Query with offline persistence

In the root `app/_layout.tsx`, wrap the app in a `PersistQueryClientProvider`
backed by AsyncStorage (`staleTime: 60_000` to match the API's cache headers) so
the app opens instantly with the last-known events.

## 6. Screens (expo-router)

```
app/
  _layout.tsx            # QueryClient + persistence + notification handlers
  (tabs)/_layout.tsx     # Today / Browse / Saved tabs
  (tabs)/index.tsx       # Today — fetchEvents('date=tonight')
  (tabs)/browse.tsx      # filters mapped to /api/events params + free-text search
  (tabs)/saved.tsx       # device-local favorites (Zustand + AsyncStorage)
  event/[id].tsx         # detail via fetchEvent(id); add-to-calendar + share
```

Favorites store (`src/stores/favorites.ts`): a Zustand store of event **ids**
persisted to AsyncStorage. Key on the opaque id from the API; when opening a
saved event, if `fetchEvent` 404s (a recurring schedule changed), show
"event updated or removed" instead of crashing.

## 7. Push registration (against `/api/devices`)

`src/push/register.ts`:

```ts
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'

const BASE_URL = 'https://nyacktoday.com'

export async function registerForPush() {
  if (!Device.isDevice) return
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data // ExponentPushToken[...]

  await fetch(`${BASE_URL}/api/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expoPushToken: token, platform: 'ios' }),
  })
}
```

Handle taps in `_layout.tsx`: read `response.notification.request.content.data.url`
(e.g. `nyacktoday://event/<id>`) and route to it via `expo-linking` / expo-router.
Call `PATCH /api/devices` when the user toggles notification prefs;
`DELETE /api/devices` if they turn everything off.

## 8. EAS build + push credentials

```bash
eas login
eas build:configure          # writes eas.json (development / preview / production)
eas credentials              # let Expo create/upload the APNs key (one time)
eas build --profile development --platform ios   # dev client for on-device testing
```

Then install the dev-client build on your iPhone, run `npx expo start --dev-client`,
grant notification permission, and confirm the token reaches `/api/devices`.

## 9. Verify end-to-end

- Today/Browse/detail render against production `/api/events`.
- Kill Wi-Fi → app still opens with persisted events (offline).
- Fire a test push: `POST /api/push/tonight` with `x-admin-password` (or wait for
  the 21:00 UTC cron) and confirm the notification arrives and its tap deep-links
  to the event detail screen.
- Favorites survive an app restart; a stale favorited id degrades gracefully.

---

### Deferred until the app exists (backend follow-ups)
- `public/.well-known/apple-app-site-association` for universal links — needs the
  Apple Team ID + `bundleIdentifier` above.
- The home-screen "Tonight in Nyack" widget (Phase 1b) — native WidgetKit via
  `@bacons/apple-targets`; real Swift, EAS Build only.
