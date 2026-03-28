# LeagueFams

A simple two-tier app (Node/Express backend + static HTML/JS frontend) that:

1. Accepts a list of Riot IDs (`gameName#tagLine`) and a date range.
2. Loads each player's matches from Riot Match-V5.
3. Finds the intersection of matches where **all selected summoners** participated.
4. Computes aggregate + per-game stats.
5. Displays game cards and per-summoner totals/averages in a simple UI.

## Architecture

- `backend/src/server.js`: API routes, input validation, environment loading, and startup.
- `backend/src/riotClient.js`: Riot API HTTP client.
- `backend/src/analyzeService.js`: mutual match intersection + statistics computation.
- `frontend/index.html`, `frontend/main.js`, `frontend/styles.css`: UI form, rendering, and styles.

## Data flow

1. UI posts `/api/analyze` with `summoners`, `start_date`, `end_date`, `platform`, and `region`.
2. Backend resolves each Riot ID to `puuid` via `Account-V1`.
3. Backend fetches match IDs per `puuid` within the requested date range.
4. Backend intersects all match sets to find mutual games.
5. Backend fetches each mutual match and extracts tracked participant stats.
6. Backend returns:
   - per-summoner totals + averages,
   - total wins/losses per summoner,
   - average game time,
   - per-game card payload.
7. UI renders summary table + game cards.

## API contract

`POST /api/analyze`

Example request:

```json
{
  "summoners": ["PlayerOne#NA1", "PlayerTwo#NA1"],
  "start_date": "2026-03-01",
  "end_date": "2026-03-28",
  "platform": "na1",
  "region": "americas"
}
```

## Setup

1. Copy env template and set your Riot key:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
npm --prefix backend install
```

## Run everything with one command

```bash
npm run dev
```

This starts:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5500`

## Notes

- `backend/src/server.js` loads environment variables from `backend/.env` first, then root `.env` as a fallback.
- Set `DEBUG_RIOT=true` in your `.env` to log full Riot request/response debug output (URL, params, masked token, status, response body) for troubleshooting 403s.
- This starter uses a simple sequential fetch strategy for clarity.
- Riot API rate limits apply; for production, add retries/backoff + caching.
- The match query is currently set to ranked games (`type=ranked`) and up to 100 matches per summoner.
