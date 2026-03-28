# LeagueFams

LeagueFams is a lightweight client-side dashboard for exploring League match JSON exports.

It currently supports:

- Automatically loading bundled match files from `data/game1.json`, `data/game2.json`, and so on until the next file returns `404`
- Uploading one or more `.json` files in the browser
- Rendering one card per game with result, duration, and player K / D / A
- Aggregating cumulative player totals and per-game averages

## Getting Started

This project is a small static frontend with a Vite-powered dev server.

1. Run `npm install`
2. Run `npm run dev`
3. Open the local URL Vite prints in the terminal
4. The page will automatically try to load bundled files from the [data](./data) directory
5. Upload additional JSON files if you want to append more games
6. Review the game cards and cumulative player stats table

## Scripts

- `npm run dev`: Starts the local development server with live reload
- `npm run build`: Creates a production build in `dist/`
- `npm run preview`: Serves the production build locally

## Bundled Data

The app currently boots by requesting:

- `data/game1.json`
- `data/game2.json`
- `data/game3.json`
- and so on until a request returns `404`

The repository also includes the original reference sample at [test/league-sample-data.json](./test/league-sample-data.json).

## Files

- [index.html](./index.html): Main page structure
- [styles.css](./styles.css): Visual styling and responsive layout
- [app.js](./app.js): Client-side parsing, aggregation, and rendering logic

## Notes

- All processing happens in the browser.
- No server-side components are required.
- The UI is intentionally simple so it can be refined iteratively.
