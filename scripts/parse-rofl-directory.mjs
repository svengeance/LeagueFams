import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROFLReader } from "rofl-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const inputDirArg = process.argv[2];
const outputDirArg = process.argv[3];
const summonerFilterArg = process.argv[4];

if (!inputDirArg) {
  console.error("Usage: npm run parse-rofl -- <input-directory> [output-directory] [summoner1,summoner2,...]");
  process.exit(1);
}

const inputDir = path.resolve(projectRoot, inputDirArg);
const outputDir = path.resolve(projectRoot, outputDirArg || "data/generated");
const requestedSummonerNames = new Set(
  (summonerFilterArg || "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
);

const DATE_CANDIDATE_KEYS = [
  "GAME_CREATION",
  "GAME_CREATION_DATE",
  "GAME_START_TIME",
  "GAME_DATE",
  "MATCH_CREATION",
  "CREATION_TIME",
  "END_OF_GAME",
  "GAME_END_TIMESTAMP"
];

const PARTICIPANT_HINT_KEYS = [
  "RIOT_ID_GAME_NAME",
  "NAME",
  "CHAMPIONS_KILLED",
  "NUM_DEATHS",
  "ASSISTS",
  "WIN"
];

function coerceNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isProbablyParticipant(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return false;
  }

  return PARTICIPANT_HINT_KEYS.some((key) => key in entry);
}

function normalizeParticipant(entry) {
  const normalized = { ...entry };

  if (!normalized.RIOT_ID_GAME_NAME) {
    normalized.RIOT_ID_GAME_NAME = normalized.NAME || normalized.SUMMONER_NAME || normalized.SUMMONERNAME || "Unknown player";
  }

  return normalized;
}

function getComparableSummonerName(participant) {
  return String(participant.RIOT_ID_GAME_NAME || "")
    .split("#")[0]
    .trim()
    .toLowerCase();
}

function inferGameDateFromStats(statsJson) {
  for (const entry of statsJson) {
    for (const key of DATE_CANDIDATE_KEYS) {
      if (!(key in entry)) {
        continue;
      }

      const rawValue = entry[key];
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        continue;
      }

      const numeric = coerceNumber(rawValue);
      if (numeric !== null) {
        const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
        const date = new Date(millis);
        if (!Number.isNaN(date.getTime())) {
          return { date, source: key };
        }
      }

      const parsed = new Date(String(rawValue));
      if (!Number.isNaN(parsed.getTime())) {
        return { date: parsed, source: key };
      }
    }
  }

  return null;
}

function inferResult(participants) {
  const winCount = participants.filter((participant) => String(participant.WIN || "").toLowerCase() === "win").length;
  const lossCount = participants.filter((participant) => String(participant.WIN || "").toLowerCase() === "fail").length;

  if (winCount > lossCount) {
    return "win";
  }

  if (lossCount > winCount) {
    return "loss";
  }

  const firstKnownResult = participants.find((participant) => participant.WIN);
  if (firstKnownResult) {
    return String(firstKnownResult.WIN).toLowerCase() === "win" ? "win" : "loss";
  }

  return "unknown";
}

function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

function formatDurationForFilename(durationMilliseconds) {
  const totalSeconds = Math.max(0, Math.round(Number(durationMilliseconds) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h-${String(minutes).padStart(2, "0")}m-${String(seconds).padStart(2, "0")}s`;
  }

  return `${minutes}m-${String(seconds).padStart(2, "0")}s`;
}

async function parseReplayFile(filePath) {
  const reader = new ROFLReader(filePath);
  const metadata = reader.getMetadata();
  const statsJson = Array.isArray(metadata.statsJson) ? metadata.statsJson : [];
  const participants = statsJson
    .filter(isProbablyParticipant)
    .map(normalizeParticipant)
    .filter((participant) => {
      if (requestedSummonerNames.size === 0) {
        return true;
      }

      return requestedSummonerNames.has(getComparableSummonerName(participant));
    });

  if (participants.length === 0) {
    throw new Error(
      requestedSummonerNames.size === 0
        ? "Replay metadata did not contain participant stats."
        : "Replay metadata did not contain any of the requested summoner names."
    );
  }

  const inferredDate = inferGameDateFromStats(statsJson);
  const fileStat = await fs.stat(filePath);
  const gameDate = inferredDate?.date || fileStat.mtime;
  const gameDateSource = inferredDate?.source || "filesystem-mtime";

  return {
    gameDuration: metadata.gameLength,
    gameDate: gameDate.toISOString(),
    gameDateSource,
    sourceReplayFile: path.basename(filePath),
    participants
  };
}

async function main() {
  const inputEntries = await fs.readdir(inputDir, { withFileTypes: true });
  const roflFiles = inputEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".rofl"))
    .map((entry) => path.join(inputDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (roflFiles.length === 0) {
    console.error(`No .rofl files found in ${inputDir}`);
    process.exit(1);
  }

  if (requestedSummonerNames.size > 0) {
    console.log(`Filtering participants to: ${[...requestedSummonerNames].join(", ")}`);
  }

  await fs.mkdir(outputDir, { recursive: true });

  let convertedCount = 0;
  const manifestEntries = [];

  for (const roflFile of roflFiles) {
    try {
      const replayData = await parseReplayFile(roflFile);
      const datedName = `${formatDateForFilename(new Date(replayData.gameDate))}-${formatDurationForFilename(replayData.gameDuration)}.json`;
      const outputPath = path.join(outputDir, datedName);

      await fs.writeFile(outputPath, `${JSON.stringify(replayData, null, 2)}\n`, "utf8");
      manifestEntries.push({
        file: path.basename(outputPath),
        gameDate: replayData.gameDate,
        gameDuration: replayData.gameDuration,
        sourceReplayFile: replayData.sourceReplayFile
      });
      convertedCount += 1;
      console.log(`Parsed ${path.basename(roflFile)} -> ${path.relative(projectRoot, outputPath)}`);
    } catch (error) {
      console.error(`Failed to parse ${path.basename(roflFile)}: ${error.message}`);
    }
  }

  if (convertedCount === 0) {
    console.error("No replay files were converted successfully.");
    process.exit(1);
  }

  const sortedManifestEntries = manifestEntries.sort((left, right) => left.file.localeCompare(right.file));
  const manifestPath = path.join(outputDir, "index.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(sortedManifestEntries, null, 2)}\n`, "utf8");
  console.log(`Wrote manifest -> ${path.relative(projectRoot, manifestPath)}`);

  console.log(`Converted ${convertedCount} replay file(s) into ${path.relative(projectRoot, outputDir)}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
