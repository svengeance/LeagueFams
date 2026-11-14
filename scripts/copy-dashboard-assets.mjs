import { cp } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);

// The collection index references match files and images by their site-relative paths.
await Promise.all(["data", "assets/champion", "assets/backgrounds"].map((directory) =>
  cp(new URL(directory, root), new URL(directory, output), { recursive: true })
));
