# PRD: Weather Road Trip App

**Author:** Marysia Kaminska
**Status:** v1 built and live — [github.com/marysiakam/roadtrip-weather-app](https://github.com/marysiakam/roadtrip-weather-app)
**Last updated:** July 21, 2026

This document reflects what the app actually does today, reorganized by theme.
Requirements below are ones that were built and verified working, not just planned.

## 1. Problem

Weather changes across a long drive. On a 6+ hour road trip, the town you leave
from, the towns you pass through, and your destination can all have completely
different conditions at completely different times — but existing weather apps
only show you a single location's forecast, not a timeline of what you'll
actually encounter along your route.

## 2. Goal

Let someone enter a start and end address and immediately see what the weather
will look like at each leg of their route, timed to when they'll actually be
there — plus a heads-up if any hazardous weather conditions are ahead.

## 3. Target user

Casual road trippers planning an occasional long drive (vacations, visiting
family, etc.). Not built for RV/camping or commuter use cases — those remain
future personas (see [Later](#8-later--not-yet-built)).

## 4. Platform

Responsive web app — single persistent shell (map + bottom sheet) that works
across mobile and desktop widths from the same codebase. Built to be portable
to a native app later; no native build in v1.

## 5. Requirements, by theme

### 5.1 Trip input & search

- Start and end address only — no manual multi-stop trip builder.
- **Map-first, single-shell design**: the map is the very first thing you see,
  even before typing anything. A floating pill ("Where's the road trip?")
  expands into the address/time form in the same bottom sheet used for
  results — there's no separate "input page" vs. "results page."
- **Default start address** is filled in automatically via browser geolocation
  (reverse-geocoded to a place name), falling back to Seattle, WA if
  geolocation is denied or unavailable.
- **Address autocomplete** is globally searchable (typing "Tokyo" or "Poznan"
  works) but ranks matches in the start address's country first, by running
  a country-scoped query and a global query in parallel and merging them
  (capped at 3 domestic results so same-name local businesses can't crowd out
  a genuine global destination). This solves "Las Vegas vs. Las Palmas,
  Spain" and "Bethlehem, PA vs. Bethlehem, Israel" without ever hiding
  legitimately global addresses.
- **Live preview pins** drop on the map as soon as a start/destination is
  picked from the dropdown (or resolved via geolocation) — the map reacts to
  what you're typing instead of staying inert until submit.
- **"Leave now"** button sets the departure field to the current time in one
  tap; the field also defaults to now on load.
- Submitting a trip sends the exact coordinates you picked from the dropdown
  (not just the typed text) to the server, so the backend can't silently
  re-geocode your selection to a different, wrong place with the same name.

### 5.2 Route & checkpoints

- App calculates the driving route and auto-generates checkpoints along it,
  evenly spaced by drive time across the *entire* trip (a fixed-interval
  scheme that clustered checkpoints near the start on long trips was found
  and fixed).
- Shows total miles, total drive time, and ETA based on the departure time.
- Route alternatives: requests a primary + 1 alternate from OpenRouteService.
  ORS's free-tier alternate-routes algorithm caps out around ~60 miles of
  route distance, so most real road trips only get a single route back — the
  Route tab says so plainly instead of implying a picker that isn't there.
- **Checkpoint naming** avoids falling back to a state-level label (e.g.
  "Wyoming, USA") on remote highway stretches by widening the reverse-geocode
  search radius/layers before falling back that far.
- **Manual checkpoints**, two ways to add one: (1) tap the map's "+" button to
  arm add-mode (shows "Tap the map where you'd like to stop"), then a single
  tap places it there; or (2) type an address in the sheet's "+ Add a stop"
  field (same autocomplete as start/end) and pick a suggestion. Both snap the
  point to the nearest spot on the actual route and compute its ETA/weather.
  Long-press-to-add was tried first and dropped — it wasn't a discoverable
  gesture (no visual cue it existed, and it reads as a context-menu gesture
  on most other apps).
- Drag any non-start/end checkpoint pin to reposition it (snaps to the
  nearest point on the route, recomputes ETA and weather). A one-time
  dismissible banner ("Drag any stop to move it · Tap + to add one") explains
  this the first time results load for a trip (a persistent grip-dot icon on
  each pin was tried too, but dropped for looking visually messy).
- Remove any custom or auto-generated stop (except start/end) with the × on
  its card.

### 5.3 Time & timezones

- Every displayed time (checkpoint ETA, arrival, hourly trend labels, route
  alternative arrival) is shown in **that location's own local time**, not
  the viewer's browser timezone — fixed a real bug where a trip entirely in
  Europe (e.g. Poznan → Berlin) displayed times converted back to the
  viewer's own timezone (e.g. Pacific), which made no sense for the place
  being described. Each checkpoint's local timezone comes from Open-Meteo
  (`timezone=auto`), resolved per-coordinate even within one batched request.
- When a route crosses from one timezone into another, a labeled divider
  ("Entering &lt;zone&gt; time") appears in the timeline right at the
  checkpoint where the change happens.
- The "Leaving at" field is explicitly labeled **"(your local time)"** —
  departure time is interpreted in the browser's own timezone, which is a
  deliberate simplification: it assumes you're planning from roughly where
  you are, and doesn't currently ask which timezone your entered departure
  time is meant to represent if you're planning a trip somewhere else
  entirely. Worth revisiting if remote trip-planning (not near your current
  location) becomes a real use case.

### 5.4 Weather display

- Each checkpoint shows the forecasted conditions at the estimated time
  you'll actually be there — not current conditions.
- Displayed as full-bleed, swipeable cards (a horizontal timeline on both
  mobile and desktop) with a dot-page indicator.
- Each card shows: place name, "Est. arrival" time (explicitly labeled as an
  estimate), temperature, condition icon, wind, and a compact ±6-hour trend
  strip (every 2 hours) so the surrounding forecast is visible without
  opening the full detail view.
- Condition icons are **day/night-aware** — clear/mostly-clear conditions
  show a moon instead of a sun when the forecasted hour is after dark.
- Tapping a card opens a full-screen detail view: an hourly (±2hr) trend
  strip, feels-like temperature, humidity, precipitation chance, and hazard
  reasoning if flagged.
- Map pins double as a weather-at-a-glance strip: each pin shows the actual
  condition emoji (or a hazard warning, which takes visual priority) so the
  whole route's weather distribution is visible on the map itself, not just
  in the card list.

### 5.5 Hazard alerts (in-app only)

- A checkpoint is flagged hazardous if any of:
  - Precipitation probability > 70%
  - Wind speed > 25 mph
  - Any winter weather (snow, freezing rain/drizzle)
  - Thunderstorms
- A dedicated **Hazards** tab (with a count badge) lists every flagged stop
  and why.
- Hazardous stops are visibly marked on both the checkpoint card and the map
  pin. No push notifications in v1.

### 5.6 Error handling

- Errors are classified as **user-fixable** (bad address, no nearby road,
  genuinely unreachable by car) vs. **system failures** (network/API
  issues), and shown with a matching tone — a calm amber banner for the
  former, red only for the latter — instead of one alarming red banner for
  everything.
- Specific, actionable messages replace generic ones, and name the actual
  places involved:
  - Address not found → *"We couldn't find 'X' — check the spelling, or try
    a nearby town instead."*
  - A geocoded point too far from any road (e.g. a park/summit/campground
    name) → retries with a much wider road-search radius first; if it still
    fails, explains that specifically rather than implying the whole route
    is impossible.
  - Genuinely unreachable by road (e.g. separated by an ocean) → names both
    places and suggests trying addresses connected by road.
- When a route had to reach more than half a mile to find a usable road, a
  dismissible notice says so (*"Routed to the nearest accessible road, ~X mi
  from Y"*) instead of silently landing somewhere the user didn't ask for.
- Ferry-inclusive routes (e.g. Seattle to an island via state ferry) already
  work with no special handling needed.

### 5.7 Visual design

- Light mode, system sans-serif typeface.
- Ink-black primary call-to-action button; the accent color is reserved for
  small highlights (chips, focus rings) rather than the main action.
- No boxed "card" chrome around the input form — fields sit directly on the
  sheet.
- The bottom sheet can be dragged between a peeked and expanded state; even
  fully expanded, a sliver of map stays visible so the map is never
  completely hidden.

## 6. Data sources

- **Weather:** [Open-Meteo](https://open-meteo.com/) — free, no API key,
  hourly forecasts including `is_day`, `apparent_temperature`, and
  `relative_humidity_2m`, called directly from the client.
- **Routing/geocoding:** [OpenRouteService](https://openrouteservice.org/) —
  free with an API key (kept server-side), built on OpenStreetMap. Used for
  geocoding, autocomplete, reverse geocoding, and driving directions.

Both avoid the credit-card-required, pay-as-you-go pricing of Google Maps and
most paid weather APIs.

## 7. Known limitations

- **ORS's free-tier alternate-routes cap (~60 miles)** means most real trips
  only get one route option, not a Google Maps–style picker.
- **Some named landmarks are genuinely undrivable** (e.g. Mount Rainier's
  actual summit coordinate has no road within 200km in OSM data) — this is
  correct behavior, not a bug, and the error message guides toward a nearby
  town/visitor center instead.
- **Very short, ambiguous search prefixes** (e.g. typing just "Las") may
  still show a non-ideal top result briefly; typing a couple more characters
  resolves it via normal text relevance.
- No accounts, so trips don't persist across sessions/devices.

## 8. Later (not yet built)

Roughly in order of likely value:

1. Push notifications for hazard alerts
2. "Best time to leave" recommendation (compare a few departure windows)
3. Packing/gear suggestions based on forecasted conditions
4. Save/reload past trips (needs basic accounts)
5. RV/camper persona features (campsite weather, towing wind warnings)
6. Native mobile app
7. Prettier README with screenshots/images

## 9. Out of scope

- User accounts / saved trips (session-only is fine)
- Push notifications
- Packing suggestions
- Rerouting logic (e.g. live re-routing around weather)
- Native mobile app

## 10. Success criteria

- ✅ Can enter two real addresses and get a route back in a few seconds.
- ✅ Weather timeline shows plausible, correctly-timed forecasts for
  multiple checkpoints on a 6+ hour route, evenly spaced across the whole
  drive.
- ✅ A checkpoint with genuinely bad forecasted weather visibly flags as a
  hazard, with a reason shown.
- ✅ Works on both desktop and phone browser widths from one codebase.
- ✅ Global addresses are searchable; addresses genuinely unreachable by
  road (or with no nearby road at all) fail with a clear, specific reason
  rather than a generic error.

---

## 11. Feedback log

Add a new row each time you try something in the browser app and want it
changed. One row per issue — don't batch unrelated notes together.

| Date | Screen/Flow | What I saw | What I want changed | Priority |
|------|-------------|------------|----------------------|----------|
| | | | | |

Priority: High / Med / Low. Leave resolved rows in place with a ✅ added to
Priority once fixed, so there's a history of what changed and why.
