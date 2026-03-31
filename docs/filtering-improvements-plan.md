# Implementation Plan: Smart Fallback & Date Picker

## Overview
Improve the event filtering UX by adding:
1. **Smart Fallback**: Auto-show "this week" when "tonight" has no events
2. **Date Picker**: Allow users to select specific dates via calendar

## Feature 1: Smart Fallback

### Goal
Prevent empty "tonight" landing experience by automatically falling back to "this week" with a helpful banner.

### Implementation Details

**Component**: `/Users/danielfenjves/Development/nyack-today/src/app/page.tsx`

**Logic Flow**:
1. On initial load with `dateFilter === 'tonight'`
2. After fetching tonight's events, check if `events.length === 0`
3. If empty:
   - Set `showFallback` state to true
   - Fetch "this week" events automatically
   - Display banner above event list
4. Keep "Tonight" tab visually selected to maintain context

**State Management**:
```typescript
const [showFallback, setShowFallback] = useState(false);
const [fallbackMessage, setFallbackMessage] = useState('');
```

**Banner Component**: Create inline or extract to `/Users/danielfenjves/Development/nyack-today/src/components/FallbackBanner.tsx`
- Yellow/orange info banner (matches brand)
- Message: "Nothing tonight — showing this week's events"
- Dismissible with X button (stores dismissal in sessionStorage)
- Positioned above EventList component

**Edge Cases**:
- User manually switches from Tonight to another tab → hide banner, clear fallback state
- User returns to Tonight tab after dismissing banner → don't re-show fallback
- "This week" is also empty → show original empty state with no fallback

### Files to Modify
- `/Users/danielfenjves/Development/nyack-today/src/app/page.tsx` (main logic)
- Potentially `/Users/danielfenjves/Development/nyack-today/src/components/FallbackBanner.tsx` (new component)

---

## Feature 2: Date Picker

### Goal
Allow users to select any specific date within the next 3 months via an interactive calendar.

### Implementation Details

#### Component Architecture

**New Components**:
1. `/Users/danielfenjves/Development/nyack-today/src/components/DatePicker.tsx`
   - Calendar icon button (lucide-react `CalendarIcon`)
   - Integrates with DateTabs component
   - Handles popover/bottom sheet toggle

2. `/Users/danielfenjves/Development/nyack-today/src/components/DatePickerPopover.tsx`
   - Wraps `react-day-picker` calendar
   - Desktop: Popover anchored to calendar button
   - Mobile: Bottom sheet (using `vaul` library)
   - Date range: Today → 3 months from now

**Modified Components**:
1. `/Users/danielfenjves/Development/nyack-today/src/components/DateTabs.tsx`
   - Add calendar button at end of tabs row
   - When custom date selected: hide preset tabs, show custom date pill
   - Custom pill: "Mar 28" with X button to clear

2. `/Users/danielfenjves/Development/nyack-today/src/app/page.tsx`
   - Add `customDate` state (Date | null)
   - When customDate set: override dateFilter logic
   - Pass customDate to API as query param

#### Date Utilities

**File**: `/Users/danielfenjves/Development/nyack-today/src/lib/utils/dates.ts`

**New Functions**:
```typescript
// Get date range for a specific date (midnight to 11:59:59 PM Eastern)
export function getCustomDateRange(date: Date): DateRange {
  // Convert to Eastern timezone
  // Return { start: Date, end: Date }
}

// Format custom date for display pill (e.g., "Mar 28")
export function formatCustomDatePill(date: Date): string {
  // Return "MMM d" format
}

// Get max selectable date (3 months from now)
export function getMaxSelectableDate(): Date {
  // Return date 3 months in future
}
```

#### API Changes

**File**: `/Users/danielfenjves/Development/nyack-today/src/app/api/events/route.ts`

**Query Parameter Handling**:
- Current: `?date=tonight|tomorrow|weekend|week|month`
- New: `?date=custom&customDate=2026-03-28`

**Logic**:
```typescript
if (dateFilter === 'custom' && customDateParam) {
  const customDate = new Date(customDateParam);
  const { start, end } = getCustomDateRange(customDate);
  where.startDate = { gte: start, lte: end };
}
```

#### UI/UX Flow

**Desktop Flow**:
1. User clicks calendar icon at end of DateTabs
2. Popover opens with `react-day-picker` calendar
3. User selects date (e.g., March 28)
4. Popover closes
5. DateTabs transforms: preset tabs hidden, "Mar 28" pill shown with X
6. Events filtered to show only March 28 events
7. Clicking X clears custom date, restores preset tabs

**Mobile Flow**:
1. User taps calendar icon
2. Bottom sheet slides up with calendar (`vaul` drawer)
3. User selects date
4. Sheet slides down
5. Same pill/filtering behavior as desktop

#### State Management

**In page.tsx**:
```typescript
const [customDate, setCustomDate] = useState<Date | null>(null);

// When customDate is set, use it instead of dateFilter
const effectiveDateFilter = customDate ? 'custom' : dateFilter;

// Build query string
const queryString = customDate
  ? `date=custom&customDate=${customDate.toISOString()}`
  : `date=${dateFilter}`;
```

**Passing to Components**:
- DateTabs: `<DateTabs customDate={customDate} onCustomDateClear={() => setCustomDate(null)} onCustomDateSelect={setCustomDate} />`

#### Dependencies to Add

```bash
npm install react-day-picker vaul
```

**Libraries**:
- `react-day-picker` (v9.x): Calendar component with excellent a11y
- `vaul`: Performant bottom sheet/drawer for mobile

#### Styling

**Calendar Styling**:
- Match existing orange theme (`--color-orange-500`)
- Use stone neutral grays for non-selected dates
- Selected date: orange background with white text
- Today indicator: orange border

**Bottom Sheet**:
- Handle overlay (iOS-style pill at top)
- Smooth spring animation
- Backdrop overlay (semi-transparent black)

### Files to Create
- `/Users/danielfenjves/Development/nyack-today/src/components/DatePicker.tsx`
- `/Users/danielfenjves/Development/nyack-today/src/components/DatePickerPopover.tsx`

### Files to Modify
- `/Users/danielfenjves/Development/nyack-today/src/components/DateTabs.tsx`
- `/Users/danielfenjves/Development/nyack-today/src/app/page.tsx`
- `/Users/danielfenjves/Development/nyack-today/src/lib/utils/dates.ts`
- `/Users/danielfenjves/Development/nyack-today/src/app/api/events/route.ts`
- `/Users/danielfenjves/Development/nyack-today/src/app/globals.css` (calendar styling)

---

## Implementation Order

### Phase 1: Smart Fallback (Simpler, foundational)
1. Add fallback state to `page.tsx`
2. Implement fallback logic in useEffect
3. Create FallbackBanner component
4. Test edge cases (empty week, tab switching)

### Phase 2: Date Picker Foundation
1. Install dependencies (`react-day-picker`, `vaul`)
2. Add utility functions to `dates.ts`
3. Update API route to handle custom dates
4. Test API with custom date queries

### Phase 3: Date Picker UI
1. Create DatePicker button component
2. Create DatePickerPopover with desktop popover
3. Add bottom sheet for mobile
4. Integrate into DateTabs
5. Implement custom date pill UI
6. Add calendar theme styling

### Phase 4: Polish & Testing
1. Test mobile responsiveness
2. Test accessibility (keyboard navigation, screen readers)
3. Test edge cases (date boundaries, timezone handling)
4. Polish animations and transitions

---

## Critical Files Summary

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/app/page.tsx` | Modify | Add fallback + customDate state, fetch logic |
| `src/components/DateTabs.tsx` | Modify | Integrate calendar button, show/hide pills |
| `src/lib/utils/dates.ts` | Modify | Add custom date utilities |
| `src/app/api/events/route.ts` | Modify | Handle custom date queries |
| `src/components/FallbackBanner.tsx` | Create | Show fallback message |
| `src/components/DatePicker.tsx` | Create | Calendar button component |
| `src/components/DatePickerPopover.tsx` | Create | Calendar popover/drawer |
| `src/app/globals.css` | Modify | Calendar theme styling |

---

## Verification & Testing

### Manual Testing Checklist

**Smart Fallback**:
- [ ] Visit site at a time when tonight has no events → see "this week" with banner
- [ ] Dismiss banner → doesn't reappear on tab switch
- [ ] Switch to Tomorrow tab → banner disappears
- [ ] Return to Tonight tab → fallback remembered, no re-fetch
- [ ] Test when both tonight AND this week are empty → see standard empty state

**Date Picker - Desktop**:
- [ ] Click calendar icon → popover opens
- [ ] Select a date 2 weeks from now → events for that day shown
- [ ] DateTabs replaced with "Mar 28" pill
- [ ] Click X on pill → returns to preset tabs
- [ ] Select date beyond 3 months → disabled/not selectable
- [ ] Keyboard navigation works (Tab, Enter, Arrows)

**Date Picker - Mobile**:
- [ ] Tap calendar icon → bottom sheet slides up
- [ ] Select date → sheet closes, pill appears
- [ ] Swipe down to dismiss → sheet closes without selection
- [ ] Touch outside → sheet dismisses

**API Testing**:
- [ ] Query `GET /api/events?date=custom&customDate=2026-03-28` → returns correct events
- [ ] Events scoped to single day (midnight - 11:59:59 PM Eastern)
- [ ] Timezone handling correct for DST transitions

**Cross-Browser**:
- [ ] Safari (mobile & desktop)
- [ ] Chrome
- [ ] Firefox

### Automated Testing (Future)
- Unit tests for date utility functions
- Integration tests for API route with custom dates
- Component tests for DatePicker interactions
