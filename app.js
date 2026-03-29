const MINIMUM_GAME_SECONDS = 5 * 60;
const CHART_WIDTH = 960;
const CHART_HEIGHT = 420;
const CHART_MARGIN = { top: 28, right: 28, bottom: 56, left: 72 };
const PLAYER_COLORS = ["#f0d59c", "#6bc9ff", "#35d09a", "#ff8a6b", "#c89bff", "#ffcf5a", "#7ef0d3", "#ff77b7"];

const CHART_STATS = [
  { key: "kills", label: "Kills" },
  { key: "deaths", label: "Deaths" },
  { key: "assists", label: "Assists" },
  { key: "gold", label: "Gold" },
  { key: "largestMultiKill", label: "Largest Multi Kill" },
  { key: "totalDamageDealt", label: "Total Damage Dealt" },
  { key: "totalDamageTaken", label: "Total Damage Taken" },
  { key: "totalHeal", label: "Total Healed" }
];

const CHAMPION_NAME_OVERRIDES = {
  "Aurelion Sol": "AurelionSol",
  "Bel'Veth": "Belveth",
  "Cho'Gath": "Chogath",
  "Dr. Mundo": "DrMundo",
  "Jarvan IV": "JarvanIV",
  "Kai'Sa": "Kaisa",
  "Kha'Zix": "Khazix",
  "Kog'Maw": "KogMaw",
  "K'Sante": "KSante",
  "LeBlanc": "Leblanc",
  "Miss Fortune": "MissFortune",
  "Nunu & Willump": "Nunu",
  "Rek'Sai": "RekSai",
  "Renata Glasc": "Renata",
  "Tahm Kench": "TahmKench",
  "Twisted Fate": "TwistedFate",
  "Vel'Koz": "Velkoz",
  "Wukong": "MonkeyKing",
  "Xin Zhao": "XinZhao"
};

const state = {
  games: [],
  activeView: "totals",
  activeChartStat: "kills"
};

const scriptSource = document.querySelector('script[src$="app.js"]')?.src || window.location.href;
const assetBaseUrl = new URL(".", scriptSource);
const BUNDLED_INDEX_PATH = "data/generated/index.json";

const elements = {
  fileInput: document.querySelector("#fileInput"),
  dropzone: document.querySelector("#dropzone"),
  reloadBundledButton: document.querySelector("#reloadBundledButton"),
  clearButton: document.querySelector("#clearButton"),
  statusText: document.querySelector("#statusText"),
  overviewCards: document.querySelector("#overviewCards"),
  totalsTableBody: document.querySelector("#totalsTableBody"),
  gamesContainer: document.querySelector("#gamesContainer"),
  chartStage: document.querySelector("#chartStage"),
  chartLegend: document.querySelector("#chartLegend"),
  chartStatButtons: document.querySelector("#chartStatButtons"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  viewPanels: [...document.querySelectorAll(".view-panel")],
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

function formatGameDateLabel(gameDate) {
  if (!gameDate) {
    return "";
  }

  const parsed = new Date(gameDate);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(parsed);
}

function normalizeChampionAssetName(championName) {
  const trimmed = String(championName || "").trim();
  if (!trimmed) {
    return "";
  }

  if (CHAMPION_NAME_OVERRIDES[trimmed]) {
    return CHAMPION_NAME_OVERRIDES[trimmed];
  }

  return trimmed.replace(/[^A-Za-z0-9]/g, "");
}

function normalizeGame(rawGame, source, index) {
  const participants = Array.isArray(rawGame.participants) ? rawGame.participants : [];
  const parsedGameDate = rawGame.gameDate ? new Date(rawGame.gameDate) : null;
  const gameTimestamp = parsedGameDate && !Number.isNaN(parsedGameDate.getTime())
    ? parsedGameDate.getTime()
    : 0;
  const sourceGameId = rawGame.sourceGameId
    ? coerceNumber(rawGame.sourceGameId)
    : coerceNumber(String(rawGame.sourceReplayFile || "").replace(/^.*-/, "").replace(/\.rofl$/i, ""));
  const normalizedParticipants = participants.map((participant) => {
    const kills = coerceNumber(participant.CHAMPIONS_KILLED);
    const deaths = coerceNumber(participant.NUM_DEATHS);
    const assists = coerceNumber(participant.ASSISTS);
    const gold = coerceNumber(participant.GOLD_EARNED);
    const largestMultiKill = coerceNumber(participant.LARGEST_MULTI_KILL);
    const damageToChampions = coerceNumber(participant.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS);
    const totalDamageDealt = damageToChampions;
    const totalDamageTaken = coerceNumber(participant.TOTAL_DAMAGE_TAKEN);
    const totalHeal = coerceNumber(participant.TOTAL_HEAL);
    const won = String(participant.WIN || "").toLowerCase() === "win";
    const championName = participant.SKIN || participant.CHAMPION || participant.CHAMPION_NAME || "";
    const championAssetName = normalizeChampionAssetName(championName);

    return {
      name: participant.RIOT_ID_GAME_NAME || "Unknown player",
      championName,
      championAssetName,
      championIcon: championAssetName ? `assets/champion/${championAssetName}.png` : "",
      kills,
      deaths,
      assists,
      gold,
      largestMultiKill,
      damageToChampions,
      totalDamageDealt,
      totalDamageTaken,
      totalHeal,
      won,
      raw: participant
    };
  });

  const result = normalizedParticipants.some((participant) => participant.won) ? "Victory" : "Defeat";

  return {
    id: `${source}-${index}`,
    source,
    sourceGameId,
    gameDate: rawGame.gameDate || null,
    gameTimestamp,
    gameDateLabel: formatGameDateLabel(rawGame.gameDate),
    result,
    durationLabel: formatDuration(rawGame.gameDuration, participants),
    durationSeconds: normalizedParticipants[0]
      ? coerceNumber(normalizedParticipants[0].raw.TIME_PLAYED)
      : Math.round(coerceNumber(rawGame.gameDuration) / 1000),
    players: normalizedParticipants
  };
}

function filterEligibleGames(games) {
  return games.filter((game) => game.durationSeconds >= MINIMUM_GAME_SECONDS);
}

function sortGamesBySourceGameIdDesc(games) {
  return [...games].sort((left, right) => {
    if (right.sourceGameId !== left.sourceGameId) {
      return right.sourceGameId - left.sourceGameId;
    }

    return left.source.localeCompare(right.source);
  });
}

function sortGamesBySourceGameIdAsc(games) {
  return [...games].sort((left, right) => {
    if (left.sourceGameId !== right.sourceGameId) {
      return left.sourceGameId - right.sourceGameId;
    }

    return left.source.localeCompare(right.source);
  });
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
          assists: 0,
          totalDamageDealt: 0,
          totalDamageTaken: 0,
          totalHeal: 0,
          champions: new Map()
        });
      }

      const record = totals.get(player.name);
      record.games += 1;
      record.wins += player.won ? 1 : 0;
      record.kills += player.kills;
      record.deaths += player.deaths;
      record.assists += player.assists;
      record.totalDamageDealt += player.totalDamageDealt;
      record.totalDamageTaken += player.totalDamageTaken;
      record.totalHeal += player.totalHeal;
      if (player.championName) {
        const championRecord = record.champions.get(player.championName) || {
          championName: player.championName,
          championIcon: player.championIcon,
          count: 0
        };
        championRecord.count += 1;
        record.champions.set(player.championName, championRecord);
      }
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getPlayerColor(playerName, playerNames) {
  const index = playerNames.indexOf(playerName);
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

function getTopChampions(championMap) {
  return [...championMap.values()]
    .sort((left, right) => right.count - left.count || left.championName.localeCompare(right.championName))
    .slice(0, 3);
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
      detail: `${formatNumber(totalWins)} wins across all eligible records`
    },
    {
      label: "Unique players",
      value: formatNumber(totalPlayers),
      detail: "De-duplicated by Riot ID game name"
    },
    {
      label: "Avg. match length",
      value: formatDuration(averageGameLength * 1000, [{ TIME_PLAYED: Math.round(averageGameLength) }]),
      detail: "Short games under 5 minutes are excluded"
    },
    {
      label: "Top finisher",
      value: topFragger ? topFragger.name : "N/A",
      detail: topFragger ? `${formatNumber(topFragger.kills)} total kills` : "Load data to see player leaders"
    }
  ];

  elements.overviewCards.innerHTML = cards.map((card) => `
    <article class="summary-card">
      <span class="summary-label">${escapeHtml(card.label)}</span>
      <span class="summary-value">${escapeHtml(card.value)}</span>
      <div class="summary-detail">${escapeHtml(card.detail)}</div>
    </article>
  `).join("");
}

function renderTotals(totals) {
  if (totals.length === 0) {
    elements.totalsTableBody.innerHTML = `
      <tr>
        <td colspan="13">
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
      <td>${escapeHtml(player.name)}</td>
      <td>
        <div class="champion-stack">
          ${getTopChampions(player.champions).map((champion) => `
            <div class="champion-pill" title="${escapeHtml(champion.championName)} (${champion.count})">
              ${champion.championIcon ? `<img class="champion-pill-icon" src="${escapeHtml(champion.championIcon)}" alt="${escapeHtml(champion.championName)} icon">` : ""}
              <span>${escapeHtml(champion.championName)}</span>
              <span class="champion-pill-count">${champion.count}</span>
            </div>
          `).join("")}
        </div>
      </td>
      <td>${formatNumber(player.games)}</td>
      <td>${formatNumber(player.wins)}</td>
      <td>${formatNumber((player.wins / player.games) * 100, 1)}%</td>
      <td>${formatNumber(player.kills)}</td>
      <td>${formatNumber(player.deaths)}</td>
      <td>${formatNumber(player.assists)}</td>
      <td>
        <div class="kda-cell">
          <div class="kda-cell-main">${formatNumber(player.kills)} / ${formatNumber(player.deaths)} / ${formatNumber(player.assists)}</div>
          <div class="kda-cell-sub">Avg ${formatNumber(average(player.kills, player.games), 1)} / ${formatNumber(average(player.deaths, player.games), 1)} / ${formatNumber(average(player.assists, player.games), 1)}</div>
        </div>
      </td>
      <td>${formatNumber(player.totalDamageDealt)}</td>
      <td>${formatNumber(player.totalDamageTaken)}</td>
      <td>${formatNumber(player.totalHeal)}</td>
      <td>${kda(player)}</td>
    </tr>
  `).join("");
}

function renderGames(games) {
  const cardGames = sortGamesBySourceGameIdDesc(games);

  if (cardGames.length === 0) {
    elements.gamesContainer.innerHTML = elements.emptyStateTemplate.innerHTML;
    return;
  }

  elements.gamesContainer.innerHTML = cardGames.map((game, index) => `
    <article class="game-card">
      <header class="game-card-header">
        <div>
          <h3 class="game-title">Game ${cardGames.length - index}</h3>
          <div class="game-meta">
            <span class="pill ${game.result === "Victory" ? "pill-win" : "pill-loss"}">${escapeHtml(game.result)}</span>
            <span class="pill pill-neutral">${escapeHtml(game.durationLabel)}</span>
            ${game.gameDateLabel ? `<span class="pill pill-neutral">${escapeHtml(game.gameDateLabel)}</span>` : ""}
          </div>
        </div>
      </header>
      <div class="participants-list">
        ${game.players.map((player) => `
          <article class="participant-row">
            <div>
              <div class="participant-heading">
                ${player.championIcon ? `<img class="champion-icon" src="${escapeHtml(player.championIcon)}" alt="${escapeHtml(player.championName)} icon">` : ""}
                <div>
                  <p class="participant-name">${escapeHtml(player.name)}</p>
                  <p class="participant-subtext">${escapeHtml(player.championName || "Unknown champion")} | ${formatNumber(player.damageToChampions)} damage | ${formatNumber(player.gold)} gold</p>
                </div>
              </div>
            </div>
            <div class="kda-line">${player.kills} / ${player.deaths} / ${player.assists}</div>
          </article>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function niceMax(value) {
  if (value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / (10 ** exponent);
  let niceFraction = 1;

  if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }

  return niceFraction * (10 ** exponent);
}

function buildChartSeries(games, statKey) {
  const playerNames = [...new Set(games.flatMap((game) => game.players.map((player) => player.name)))];
  return playerNames.map((name) => ({
    name,
    color: getPlayerColor(name, playerNames),
    points: games.map((game, index) => {
      const player = game.players.find((entry) => entry.name === name);
      return {
        x: index + 1,
        y: player ? coerceNumber(player[statKey]) : null
      };
    })
  }));
}

function renderChart(games) {
  const chartGames = sortGamesBySourceGameIdAsc(games);

  if (games.length === 0) {
    elements.chartStage.innerHTML = `
      <div class="empty-state">
        <h3>No chart data yet</h3>
        <p>Load match files to compare player trends over time.</p>
      </div>
    `;
    elements.chartLegend.innerHTML = "";
    return;
  }

  const statConfig = CHART_STATS.find((stat) => stat.key === state.activeChartStat) || CHART_STATS[0];
  const series = buildChartSeries(chartGames, statConfig.key);
  const allValues = series.flatMap((player) => player.points.map((point) => point.y).filter((value) => value !== null));
  const maxValue = Math.max(...allValues, 0);
  const yMax = niceMax(maxValue);
  const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const innerHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const xStep = chartGames.length > 1 ? innerWidth / (chartGames.length - 1) : 0;
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, index) => (yMax / tickCount) * index);
  const xLabelCount = Math.min(chartGames.length, 6);
  const xIndices = new Set(
    Array.from({ length: xLabelCount }, (_, index) => {
      if (xLabelCount === 1) {
        return 0;
      }
      return Math.round((index / (xLabelCount - 1)) * (chartGames.length - 1));
    })
  );

  const xForIndex = (index) => CHART_MARGIN.left + (chartGames.length > 1 ? index * xStep : innerWidth / 2);
  const yForValue = (value) => CHART_MARGIN.top + innerHeight - (value / yMax) * innerHeight;

  const gridLines = yTicks.map((tick) => {
    const y = yForValue(tick);
    return `
      <line class="chart-grid-line" x1="${CHART_MARGIN.left}" y1="${y}" x2="${CHART_WIDTH - CHART_MARGIN.right}" y2="${y}"></line>
      <text class="chart-axis-label chart-axis-label-y" x="${CHART_MARGIN.left - 12}" y="${y + 4}">${formatNumber(tick)}</text>
    `;
  }).join("");

  const xLabels = chartGames.map((game, index) => {
    if (!xIndices.has(index)) {
      return "";
    }
    const x = xForIndex(index);
    return `
      <text class="chart-axis-label chart-axis-label-x" x="${x}" y="${CHART_HEIGHT - 18}">G${index + 1}</text>
    `;
  }).join("");

  const hoverColumns = chartGames.map((game, index) => {
    const centerX = xForIndex(index);
    const previousX = index === 0 ? CHART_MARGIN.left : xForIndex(index - 1);
    const nextX = index === chartGames.length - 1 ? CHART_WIDTH - CHART_MARGIN.right : xForIndex(index + 1);
    const leftX = index === 0 ? CHART_MARGIN.left : centerX - ((centerX - previousX) / 2);
    const rightX = index === chartGames.length - 1 ? CHART_WIDTH - CHART_MARGIN.right : centerX + ((nextX - centerX) / 2);
    const columnWidth = Math.max(rightX - leftX, 18);
    const tooltipRows = series
      .map((player) => {
        const point = player.points[index];
        if (!point || point.y === null) {
          return null;
        }
        return {
          name: player.name,
          color: player.color,
          value: formatNumber(point.y),
          championIcon: game.players.find((entry) => entry.name === player.name)?.championIcon || "",
          championName: game.players.find((entry) => entry.name === player.name)?.championName || ""
        };
      })
      .filter(Boolean);

    const tooltipHeight = 34 + (tooltipRows.length * 18);
    const tooltipWidth = 184;
    const tooltipX = Math.min(
      Math.max(centerX + 14, CHART_MARGIN.left + 8),
      CHART_WIDTH - CHART_MARGIN.right - tooltipWidth
    );
    const tooltipY = Math.max(CHART_MARGIN.top + 8, 18);

    const tooltipContent = tooltipRows.map((row, rowIndex) => `
      <g transform="translate(${tooltipX + 14}, ${tooltipY + 34 + (rowIndex * 18)})">
        <circle r="4" cx="0" cy="-4" fill="${row.color}"></circle>
        ${row.championIcon ? `<image class="chart-tooltip-champion-icon" href="${escapeHtml(row.championIcon)}" x="10" y="-12" width="12" height="12" preserveAspectRatio="xMidYMid slice"></image>` : ""}
        <text class="chart-shared-tooltip-line" x="${row.championIcon ? 28 : 10}" y="0">${escapeHtml(row.name)}: ${row.value}</text>
      </g>
    `).join("");

    return `
      <g class="chart-hover-column">
        <rect
          class="chart-hover-hit"
          x="${leftX}"
          y="${CHART_MARGIN.top}"
          width="${columnWidth}"
          height="${innerHeight}"
        ></rect>
        <line
          class="chart-hover-line"
          x1="${centerX}"
          y1="${CHART_MARGIN.top}"
          x2="${centerX}"
          y2="${CHART_HEIGHT - CHART_MARGIN.bottom}"
        ></line>
        <g class="chart-shared-tooltip">
          <rect
            class="chart-tooltip-box"
            x="${tooltipX}"
            y="${tooltipY}"
            width="${tooltipWidth}"
            height="${tooltipHeight}"
            rx="10"
            ry="10"
          ></rect>
          <text class="chart-tooltip-title" x="${tooltipX + 14}" y="${tooltipY + 20}">Game ${index + 1}</text>
          ${tooltipContent}
        </g>
      </g>
    `;
  }).join("");

  const lineMarkup = series.map((player) => {
    const validPoints = player.points.filter((point) => point.y !== null);
    const polylinePoints = validPoints.map((point) => {
      const x = xForIndex(point.x - 1);
      const y = yForValue(point.y);
      return `${x},${y}`;
    }).join(" ");

    const dots = validPoints.map((point) => {
      const x = xForIndex(point.x - 1);
      const y = yForValue(point.y);
      return `<circle class="chart-dot" cx="${x}" cy="${y}" r="4" fill="${player.color}"></circle>`;
    }).join("");

    return `
      <g>
        <polyline class="chart-line" points="${polylinePoints}" stroke="${player.color}"></polyline>
        ${dots}
      </g>
    `;
  }).join("");

  elements.chartStage.innerHTML = `
    <div class="chart-card">
      <svg class="chart-svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="${escapeHtml(statConfig.label)} line chart">
        ${gridLines}
        <line class="chart-axis-line" x1="${CHART_MARGIN.left}" y1="${CHART_MARGIN.top}" x2="${CHART_MARGIN.left}" y2="${CHART_HEIGHT - CHART_MARGIN.bottom}"></line>
        <line class="chart-axis-line" x1="${CHART_MARGIN.left}" y1="${CHART_HEIGHT - CHART_MARGIN.bottom}" x2="${CHART_WIDTH - CHART_MARGIN.right}" y2="${CHART_HEIGHT - CHART_MARGIN.bottom}"></line>
        ${xLabels}
        ${lineMarkup}
        ${hoverColumns}
      </svg>
    </div>
  `;

  elements.chartLegend.innerHTML = series.map((player) => `
    <div class="legend-chip">
      <span class="legend-swatch" style="background:${player.color}"></span>
      <span>${escapeHtml(player.name)}</span>
    </div>
  `).join("");
}

function renderTabs() {
  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.view === state.activeView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  elements.viewPanels.forEach((panel) => {
    const isActive = panel.dataset.view === state.activeView;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });
}

function renderChartStatButtons() {
  elements.chartStatButtons.innerHTML = CHART_STATS.map((stat) => `
    <button
      class="chart-stat-button ${stat.key === state.activeChartStat ? "is-active" : ""}"
      type="button"
      data-stat-key="${stat.key}"
    >
      ${escapeHtml(stat.label)}
    </button>
  `).join("");

  [...elements.chartStatButtons.querySelectorAll(".chart-stat-button")].forEach((button) => {
    button.addEventListener("click", () => {
      state.activeChartStat = button.dataset.statKey;
      renderChartStatButtons();
      renderChart(state.games);
    });
  });
}

function render() {
  const totals = aggregatePlayers(state.games);
  renderChartStatButtons();
  renderOverview(state.games, totals);
  renderTotals(totals);
  renderChart(state.games);
  renderGames(state.games);
  renderTabs();
}

function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.style.color = isError ? "var(--loss)" : "var(--muted)";
}

function replaceGames(games, sourceLabel) {
  state.games = [...games];
  render();
  const gameLabel = state.games.length === 1 ? "game" : "games";
  setStatus(`Loaded ${state.games.length} ${gameLabel} from ${sourceLabel}.`);
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
      const games = filterEligibleGames(extractGames(payload, file.name));

      if (games.length === 0) {
        throw new Error("No eligible games found in file.");
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
  const indexUrl = new URL(BUNDLED_INDEX_PATH, assetBaseUrl);

  try {
    const indexResponse = await fetch(indexUrl, { cache: "no-store" });
    if (!indexResponse.ok) {
      throw new Error(`Request failed with status ${indexResponse.status}`);
    }

    const manifest = await indexResponse.json();
    if (!Array.isArray(manifest)) {
      throw new Error("Bundled data index was not an array.");
    }

    for (const entry of manifest) {
      const relativeFile = typeof entry === "string" ? entry : entry?.file;
      if (!relativeFile) {
        continue;
      }

      const fileUrl = new URL(relativeFile, indexUrl);
      const response = await fetch(fileUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed loading ${relativeFile}: status ${response.status}`);
      }

      const payload = await response.json();
      const games = filterEligibleGames(extractGames(payload, relativeFile));
      loadedGames.push(...games);
    }
  } catch (error) {
    setStatus(`Could not load bundled data index from ${BUNDLED_INDEX_PATH}. ${error.message}`, true);
    return;
  }

  if (loadedGames.length === 0) {
    setStatus(`No eligible bundled games were found in ${BUNDLED_INDEX_PATH}.`, true);
    return;
  }

  replaceGames(loadedGames, `${BUNDLED_INDEX_PATH}`);
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

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    renderTabs();
  });
});

installDropzone();
render();
loadBundledGames();
