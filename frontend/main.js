const form = document.getElementById("analyze-form");
const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");
const gamesEl = document.getElementById("games");

const API_BASE = "http://localhost:8000";

function secondsToClock(seconds) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
}

function renderStats(stats) {
  if (!stats.length) {
    statsEl.innerHTML = "";
    return;
  }

  const rows = stats
    .map(
      (s) => `
      <tr>
        <td>${s.summoner}</td>
        <td>${s.wins}</td>
        <td>${s.losses}</td>
        <td>${s.total_damage_output} (${s.avg_damage_output.toFixed(1)})</td>
        <td>${s.total_healing_shielding} (${s.avg_healing_shielding.toFixed(1)})</td>
        <td>${s.total_damage_taken} (${s.avg_damage_taken.toFixed(1)})</td>
        <td>${s.total_kills} (${s.avg_kills.toFixed(1)})</td>
        <td>${s.total_deaths} (${s.avg_deaths.toFixed(1)})</td>
        <td>${s.total_assists} (${s.avg_assists.toFixed(1)})</td>
      </tr>
    `
    )
    .join("");

  statsEl.innerHTML = `
    <div class="card">
      <h2>Aggregate Stats</h2>
      <table class="stat-table">
        <thead>
          <tr>
            <th>Summoner</th><th>Wins</th><th>Losses</th><th>Damage</th><th>Heal/Shield</th><th>Taken</th><th>Kills</th><th>Deaths</th><th>Assists</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderGames(games) {
  gamesEl.innerHTML = games
    .map((g) => {
      const parts = g.participants
        .map(
          (p) => `
        <li>
          <strong>${p.summoner}</strong> (${p.champion}) — ${p.win ? "Win" : "Loss"}<br/>
          Dmg: ${p.damage_output} | Heal/Shield: ${p.healing_shielding} | Taken: ${p.damage_taken}<br/>
          K/D/A: ${p.kills}/${p.deaths}/${p.assists}
        </li>`
        )
        .join("");

      const endedAt = g.game_end_timestamp
        ? new Date(g.game_end_timestamp).toLocaleString()
        : "Unknown";

      return `
        <article class="game-card">
          <h3>${g.match_id}</h3>
          <p><strong>Duration:</strong> ${secondsToClock(g.game_duration_seconds)}</p>
          <p><strong>Ended:</strong> ${endedAt}</p>
          <ul>${parts}</ul>
        </article>
      `;
    })
    .join("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const summoners = document
    .getElementById("summoners")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const payload = {
    summoners,
    start_date: document.getElementById("start-date").value,
    end_date: document.getElementById("end-date").value,
    platform: document.getElementById("platform").value,
    region: document.getElementById("region").value,
  };

  statusEl.textContent = "Loading...";
  statsEl.innerHTML = "";
  gamesEl.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to analyze games.");
    }

    const data = await response.json();
    statusEl.innerHTML = `
      <div class="card">
        Found <strong>${data.mutual_match_count}</strong> mutual matches.<br/>
        Average game duration: <strong>${secondsToClock(data.average_game_time_seconds)}</strong>
      </div>
    `;

    renderStats(data.stats_by_summoner);
    renderGames(data.games);
  } catch (error) {
    statusEl.innerHTML = `<div class="card">Error: ${error.message}</div>`;
  }
});
