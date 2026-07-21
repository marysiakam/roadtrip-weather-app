# Roadtrip Weather

> 🚧 **Work in progress.** Built with the assistance of [Claude](https://claude.com) (Anthropic's AI). Features, structure, and this README are still evolving.

Enter a start and end address and see the forecasted weather at each leg of
your drive, timed to when you'll actually be there — with a heads-up if
anything hazardous is coming.

## Architecture

- `server/` — Express API. Holds the OpenRouteService API key server-side and
  proxies geocoding/routing calls to it. Computes checkpoints along the route
  and returns them with place names.
- `client/` — React (Vite) app. Takes the checkpoints from the server and
  calls Open-Meteo directly (no API key required) to get hourly forecasts,
  matches each checkpoint's ETA to the nearest forecast hour, and flags
  hazards.

## Setup

### 1. Get a free OpenRouteService API key

Sign up at [openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup)
and create a token. It's free and doesn't require a credit card.

### 2. Configure the server

```
cd server
cp .env.example .env
```

Edit `server/.env` and paste your key into `ORS_API_KEY`.

### 3. Install dependencies

```
cd server && npm install
cd ../client && npm install
```

### 4. Run both apps (two terminals)

```
cd server && npm run dev
```

```
cd client && npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

## Hazard thresholds (v1)

A checkpoint is flagged hazardous if any of the following are forecast:

- Precipitation probability > 70%
- Wind speed > 25 mph
- Any winter weather (snow, freezing rain/drizzle)
- Thunderstorms

## Notes on v1 scope

Per the PRD: no accounts/saved trips, no manual waypoint editing, no push
notifications, no rerouting. Single departure time only. Checkpoints are
generated at ~1-hour driving intervals (plus start/end), capped at 12 to
keep the free-tier API calls reasonable on very long routes.
