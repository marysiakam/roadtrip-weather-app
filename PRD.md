# PRD: Weather Road Trip App

**Author:** Marysia Kaminska
**Date:** July 20, 2026
**Status:** Draft — v1 Minimal Scope

## 1. Problem

Weather changes across a long drive. On a 6+ hour road trip, the town you leave from, the towns you pass through, and your destination can all have completely different conditions at completely different times — but existing weather apps only show you a single location's forecast, not a timeline of what you'll actually encounter along your route.

## 2. Goal

Let someone enter a start and end address and immediately see what the weather will look like at each leg of their route, timed to when they'll actually be there — plus a heads-up if any hazardous weather conditions are ahead.

## 3. Target user (v1)

Casual road trippers planning an occasional long drive (vacations, visiting family, etc.). Not built yet for RV/camping or commuter use cases — those are future personas and future feature additions.

## 4. Requirements: v1

Keep this version small and shippable for a web app. Everything else goes in section 6 (Later).

### 4.0 Visuals
- Light mode
- Input fields should be transparent for a sleeker look
- Font: Alef
- Title: Weather along the  way 
- Subtitle: See weather and road conditions at each stage of your road trip 

### 4.1 Trip input

- User enters a start address and an end address only (no manual waypoint picking in v1).
- Address input bar has dropdown with addresses so a user inputs a correct address
- Addresses globally should be accepted but if its not doable by road trip i.e. European city to US city .., should say not a valid 
- The "Leave At" input bar should have an option to say "Leave Now" as well, and the current date/time should be populated 
- App calculates the driving route and auto-generates checkpoints along it (e.g., every ~1 hour of driving, or at towns the route passes through).

### 4.2 Routie finding 
- Similar to google maps, show various route options (user can select) but shoudl default to one of them based on road conditions, similar google maps alogirthm 
- should show total miles, total time, ETA based on departure time as well 

### 4.2 Route weather timeline

- For each checkpoint, show the forecasted conditions at the estimated time the user will be there — not just "right now."
- Checkpoints should be evenly spread out across drive, not just at tail or front legs. 
- User should have ability to press down on city and add their own checkpoint 
- Assume a single departure time (user enters "leaving at ___") to calculate arrival estimates at each checkpoint.
- Display as a simple horizontal timeline or list: town/checkpoint name, ETA, temperature, condition icon (rain/snow/clear/etc.), wind.
- Make it visually clearer that you can swipe right.scroll right to see all the timelines 
- Make it clearer that is the time the app estimates you will get through those towns 

### 4.3 Hazard alerts (in-app only)

- Flag any checkpoint with hazardous conditions: heavy rain, snow/ice, high wind, severe storm warnings at the top 
- Shown as a visible banner/badge in the app when the trip is loaded — no push notifications in v1.

### 4.4 Out of scope for v1

- User accounts / saved trips (session-only is fine)
- Manual waypoint editing
- Push notifications
- Packing suggestions
- Rerouting logic
- Native mobile app (build responsive web first)

## 5. Platform

Responsive web app (mobile-friendly layout), built to be portable to native mobile later. No mobile-specific build in v1.

## 6. Later (post-MVP, once table stakes work)

Roughly in order of likely value:

1. Manual waypoints / multi-stop trip builder
2. Push notifications for hazard alerts
3. "Best time to leave" recommendation (compare a few departure windows)
4. Packing/gear suggestions based on forecasted conditions
5. Save/reload past trips (needs basic accounts)
6. RV/camper persona features (campsite weather, towing wind warnings)
7. Native mobile app

## 7. Suggested data sources (free tier, good for MVP)

- **Weather:** [Open-Meteo](https://open-meteo.com/) — free, no API key required, up to 10,000 calls/day for non-commercial use. Gives hourly forecasts, which is exactly what's needed to match forecasts to ETAs.
- **Routing/geocoding:** [OpenRouteService](https://openrouteservice.org/) — free with an API key, built on OpenStreetMap. Handles address-to-coordinates geocoding, route calculation, and can return route geometry to derive checkpoints.

Both avoid the credit-card-required, pay-as-you-go pricing that Google Maps and most paid weather APIs now use, which matters for a weekend practice project.

## 8. Success criteria for v1

- Can enter two real addresses and get a route back in under a few seconds.
- Weather timeline shows plausible, correctly-timed forecasts for at least 3–5 checkpoints on a 6+ hour route.
- A checkpoint with genuinely bad forecasted weather (test with a real storm system) visibly flags as a hazard.
- Works on both desktop and phone browser widths.

## 9. Open questions to resolve while building

- How exactly to space checkpoints (fixed time interval vs. actual towns along the route)?
- What counts as "hazardous" — pick simple thresholds to start (e.g., >70% precip chance, wind >25mph, any winter weather) rather than pulling in a separate alerts API.
- Single departure time is simplest for v1 — confirm that's acceptable vs. "leaving now."

---

## 10. Feedback log — add notes here as you test the app and mocks

Add a new row each time you try something in the browser app or review a mock. Claude Code should read this section before making UX changes.

| Date | Screen/Flow | What I saw | What I want changed | Priority |
|------|-------------|------------|----------------------|----------|
| | | | | |

**How to use this:**
- One row per issue or observation — don't batch multiple unrelated notes into one row.
- "Screen/Flow" = which part (e.g., trip input form, timeline view, hazard banner).
- Priority: High / Med / Low, so Claude Code can triage if there's a backlog of feedback.
- Leave resolved rows in place but add a ✅ to "Priority" once fixed, so there's a history of what changed and why.
