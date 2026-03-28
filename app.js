const state = {
  games: []
};

const scriptSource = document.querySelector('script[src$="app.js"]')?.src || window.location.href;
const assetBaseUrl = new URL(".", scriptSource);

const elements = {
  fileInput: document.querySelector("#fileInput"),
  dropzone: document.querySelector("#dropzone"),
  reloadBundledButton: document.querySelector("#reloadBundledButton"),
  clearButton: document.querySelector("#clearButton"),
  statusText: document.querySelector("#statusText"),
  overviewCards: document.querySelector("#overviewCards"),
  gamesContainer: document.querySelector("#gamesContainer"),
  totalsTableBody: document.querySelector("#totalsTableBody"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate")
};

function coerceNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDuration(rawDuration, participants) {
  const secondsFromParticipants = participants.find((participant) => coerceNumber(participant.TIME_PLAYED) > 0);
  const seconds = secondsFromParticipants
    ? coerceNumber(secondsFromParticipants.TIME_PLAYED)
    : Math.round(coerceNumber(rawDuration) / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function normalizeGame(rawGame, source, index) {
  const participants = Array.isArray(rawGame.participants) ? rawGame.participants : [];
  const normalizedParticipants = participants.map((participant) => {
    const kills = coerceNumber(participant.CHAMPIONS_KILLED);
    const deaths = coerceNumber(participant.NUM_DEATHS);
    const assists = coerceNumber(participant.ASSISTS);
    const damage = coerceNumber(participant.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS);
    const gold = coerceNumber(participant.GOLD_EARNED);
    const won = String(participant.WIN || "").toLowerCase() === "win";
    return {
      name: participant.RIOT_ID_GAME_NAME || "Unknown player",
      kills,
      deaths,
      assists,
      damage,
      gold,
      won,
      raw: participant
    };
  });

  const participantsWithOutcome = normalizedParticipants.filter((participant) => participant.won).length;
  const result = participantsWithOutcome > 0 ? "Victory" : "Defeat";

  return {
    id: `${source}-${index}`,
    source,
    result,
    durationLabel: formatDuration(rawGame.gameDuration, participants),
    durationSeconds: normalizedParticipants[0] ? coerceNumber(normalizedParticipants[0].raw.TIME_PLAYED) : Math.round(coerceNumber(rawGame.gameDuration) / 1000),
    players: normalizedParticipants
  };
}

function extractGames(payload, source) {
  if (Array.isArray(payload)) {
    return payload.flatMap((item, index) => extractGames(item, `${source} - ${index + 1}`));
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.participants)) {
    return [normalizeGame(payload, source, 1)];
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload).flatMap(([key, value]) => extractGames(value, `${source} - ${key}`));
  }

  return [];
}

function aggregatePlayers(games) {
  const totals = new Map();

  games.forEach((game) => {
    game.players.forEach((player) => {
      if (!totals.has(player.name)) {
        totals.set(player.name, {
          name: player.name,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0
        });
      }

      const record = totals.get(player.name);
      record.games += 1;
      record.wins += player.won ? 1 : 0;
      record.kills += player.kills;
      record.deaths += player.deaths;
      record.assists += player.assists;
    });
  });

  return [...totals.values()].sort((left, right) => {
    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }
    return right.kills - left.kills;
  });
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function average(total, games) {
  return games === 0 ? 0 : total / games;
}

function kda(player) {
  return ((player.kills + player.assists) / Math.max(player.deaths, 1)).toFixed(2);
}

function renderOverview(games, totals) {
  if (games.length === 0) {
    elements.overviewCards.innerHTML = "";
    return;
  }

  const totalPlayers = new Set(games.flatMap((game) => game.players.map((player) => player.name))).size;
  const totalWins = games.filter((game) => game.result === "Victory").length;
  const totalDuration = games.reduce((sum, game) => sum + game.durationSeconds, 0);
  const averageGameLength = totalDuration / Math.max(games.length, 1);
  const topFragger = totals[0];

  const cards = [
    {
      label: "Games loaded",
      value: formatNumber(games.length),
      detail: `${formatNumber(totalWins)} wins across all uploaded records`
    },
    {
      label: "Unique players",
      value: formatNumber(totalPlayers),
      detail: "De-duplicated by Riot ID game name"
    },
    {
      label: "Avg. match length",
      value: formatDuration(averageGameLength * 1000, [{ TIME_PLAYED: Math.round(averageGameLength) }]),
      detail: "Calculated from each game's reported time played"
    },
    {
      label: "Top finisher",
      value: topFragger ? topFragger.name : "N/A",
      detail: topFragger ? `${formatNumber(topFragger.kills)} total kills` : "Load data to see player leaders"
    }
  ];

  elements.overviewCards.innerHTML = cards.map((card) => `
    <article class="summary-card">
      <span class="summary-label">${card.label}</span>
      <span class="summary-value">${card.value}</span>
      <div class="summary-detail">${card.detail}</div>
    </article>
  `).join("");
}

function renderGames(games) {
  if (games.length === 0) {
    elements.gamesContainer.innerHTML = elements.emptyStateTemplate.innerHTML;
    return;
  }

  elements.gamesContainer.innerHTML = games.map((game, index) => `
    <article class="game-card">
      <header class="game-card-header">
        <div>
          <h3 class="game-title">Game ${index + 1}</h3>
          <div class="game-meta">
            <span class="pill ${game.result === "Victory" ? "pill-win" : "pill-loss"}">${game.result}</span>
            <span class="pill pill-neutral">${game.durationLabel}</span>
          </div>
        </div>
        <span class="pill pill-neutral">${game.source}</span>
      </header>
      <div class="participants-list">
        ${game.players.map((player) => `
          <article class="participant-row">
            <div>
              <p class="participant-name">${player.name}</p>
              <p class="participant-subtext">${formatNumber(player.damage)} damage to champions | ${formatNumber(player.gold)} gold earned</p>
            </div>
            <div class="kda-line">${player.kills} / ${player.deaths} / ${player.assists}</div>
          </article>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderTotals(totals) {
  if (totals.length === 0) {
    elements.totalsTableBody.innerHTML = `
      <tr>
        <td colspan="11">
          <div class="empty-state">
            <h3>No cumulative stats yet</h3>
            <p>Load match files to compute totals and per-game averages.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  elements.totalsTableBody.innerHTML = totals.map((player) => `
    <tr>
      <td>${player.name}</td>
      <td>${formatNumber(player.games)}</td>
      <td>${formatNumber(player.wins)}</td>
      <td>${formatNumber((player.wins / player.games) * 100, 1)}%</td>
      <td>${formatNumber(player.kills)}</td>
      <td>${formatNumber(player.deaths)}</td>
      <td>${formatNumber(player.assists)}</td>
      <td>${formatNumber(average(player.kills, player.games), 1)}</td>
      <td>${formatNumber(average(player.deaths, player.games), 1)}</td>
      <td>${formatNumber(average(player.assists, player.games), 1)}</td>
      <td>${kda(player)}</td>
    </tr>
  `).join("");
}

function render() {
  const totals = aggregatePlayers(state.games);
  renderOverview(state.games, totals);
  renderGames(state.games);
  renderTotals(totals);
}

function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.style.color = isError ? "var(--loss)" : "var(--muted)";
}

function replaceGames(games, sourceLabel) {
  state.games = games;
  render();
  const gameLabel = games.length === 1 ? "game" : "games";
  setStatus(`Loaded ${games.length} ${gameLabel} from ${sourceLabel}.`);
}

function addGames(games, sourceLabel) {
  state.games = [...state.games, ...games];
  render();
  const gameLabel = games.length === 1 ? "game" : "games";
  setStatus(`Added ${games.length} ${gameLabel} from ${sourceLabel}. Total loaded games: ${state.games.length}.`);
}

async function loadFiles(fileList) {
  const files = [...fileList];
  if (files.length === 0) {
    return;
  }

  const loadedGames = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const games = extractGames(payload, file.name);

      if (games.length === 0) {
        throw new Error("No games found in file.");
      }

      loadedGames.push(...games);
    } catch (error) {
      setStatus(`Could not load ${file.name}: ${error.message}`, true);
      return;
    }
  }

  addGames(loadedGames, files.length === 1 ? files[0].name : `${files.length} files`);
  elements.fileInput.value = "";
}

async function loadBundledGames() {
  const loadedGames = [];
  let index = 1;

  setStatus("Loading bundled data from data/game{x}.json ...");

  while (true) {
    const relativeSource = `data/game${index}.json`;
    const sourceUrl = new URL(relativeSource, assetBaseUrl);

    try {
      const response = await fetch(sourceUrl, { cache: "no-store" });

      if (response.status === 404) {
        break;
      }

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = await response.json();
      const games = extractGames(payload, `game${index}.json`);

      if (games.length === 0) {
        throw new Error("No games found in file.");
      }

      loadedGames.push(...games);
      index += 1;
    } catch (error) {
      if (loadedGames.length > 0) {
        replaceGames(loadedGames, `bundled data files 1-${index - 1}`);
        setStatus(`Loaded ${loadedGames.length} bundled games, then stopped at ${relativeSource}. ${error.message}`, true);
        return;
      }

      setStatus(`Could not load bundled data from ${relativeSource}. ${error.message}`, true);
      return;
    }
  }

  if (loadedGames.length === 0) {
    setStatus("No bundled data files were found under data/.", true);
    return;
  }

  replaceGames(loadedGames, `bundled data files 1-${Math.max(index - 1, 0)}`);
}

function installDropzone() {
  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove("is-dragover");
    });
  });

  elements.dropzone.addEventListener("drop", (event) => {
    loadFiles(event.dataTransfer.files);
  });
}

elements.fileInput.addEventListener("change", (event) => {
  loadFiles(event.target.files);
});

elements.reloadBundledButton.addEventListener("click", () => {
  loadBundledGames();
});

elements.clearButton.addEventListener("click", () => {
  state.games = [];
  render();
  setStatus("Cleared all loaded game data.");
});

installDropzone();
render();
loadBundledGames();
