# LeagueFams

LeagueFams is a lightweight client-side dashboard for exploring League match JSON exports.

It currently supports:

- Uploading one or more `.json` files in the browser
- Rendering one card per game with result, duration, and player K / D / A
- Aggregating cumulative player totals and per-game averages
- Loading the provided sample dataset for quick testing

## Getting Started

This project has no build step and no backend.

1. Open [index.html](./index.html) in a browser.
2. Click `Load sample data` to see the included example, or upload your own JSON files.
3. Review the game cards and cumulative player stats table.

## Sample Data

The repository includes a sample dataset at [test/league-sample-data.json](./test/league-sample-data.json).

The current UI uses that structure as the baseline for parsing uploaded files.

## Files

- [index.html](./index.html): Main page structure
- [styles.css](./styles.css): Visual styling and responsive layout
- [app.js](./app.js): Client-side parsing, aggregation, and rendering logic

## Notes

- All processing happens in the browser.
- No server-side components are required.
- The UI is intentionally simple so it can be refined iteratively.
