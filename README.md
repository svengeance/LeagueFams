# LeagueFams

LeagueFams is a lightweight client-side dashboard for exploring League match JSON exports.

It currently supports:

- Automatically loading bundled match files for the selected collection
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

The app reads the collection list from [data/index.json](./data/index.json) and loads the match files for the selected collection.

The replay conversion script also writes that manifest automatically when you run:

- `npm run parse-rofl -- <input-directory> <collection-name> [summoner1,summoner2,...]`

The repository also includes the original reference sample at [test/league-sample-data.json](./test/league-sample-data.json).

Set `trackedPlayers` on a collection in `data/index.json` to limit player totals and charts to those Riot ID game names. Game cards use both rosters and team totals from the replay export. For both teams to appear on the cards, import the full replay by omitting the optional summoner list.

## Collection backgrounds

Add an image to `assets/backgrounds/` and set `background` on its collection in `data/index.json`. Use a path relative to the site, such as `assets/backgrounds/aram-nature.png`. If you also have a compressed WebP copy, set `backgroundWebp` to its path. The browser tries the WebP first, then the original. The shared ARAM placeholder appears when neither image is available. Reimporting replays preserves these settings.

The game cards scroll within their panel. The background art moves slightly with the card list and stays still when reduced motion is enabled.

## Files

- [index.html](./index.html): Main page structure
- [styles.css](./styles.css): Visual styling and responsive layout
- [app.js](./app.js): Client-side parsing, aggregation, and rendering logic

## Notes

- All processing happens in the browser.
- No server-side components are required.
- The UI is intentionally simple so it can be refined iteratively.
