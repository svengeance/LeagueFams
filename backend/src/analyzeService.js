function summarizeParticipant(participant, riotId) {
  const healingShielding = Number(participant.totalHeal || 0) + Number(participant.totalDamageShieldedOnTeammates || 0);

  return {
    summoner: riotId,
    champion: participant.championName || 'Unknown',
    win: Boolean(participant.win),
    damage_output: Number(participant.totalDamageDealtToChampions || 0),
    healing_shielding: healingShielding,
    damage_taken: Number(participant.totalDamageTaken || 0),
    kills: Number(participant.kills || 0),
    deaths: Number(participant.deaths || 0),
    assists: Number(participant.assists || 0),
  };
}

function buildEmptyTotals() {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    damage: 0,
    healing: 0,
    taken: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
  };
}

export async function analyzeMutualGames(request, riotClient) {
  const identities = [];
  for (const summoner of request.summoners) {
    identities.push(await riotClient.getIdentity(request.platform, summoner));
  }

  const matchesByPuuid = new Map();
  for (const identity of identities) {
    const matchIds = await riotClient.getMatchIds(
      request.region,
      identity.puuid,
      request.start_date,
      request.end_date,
    );

    matchesByPuuid.set(identity.puuid, new Set(matchIds));
  }

  if (matchesByPuuid.size === 0) {
    return {
      queried_summoners: request.summoners,
      mutual_match_count: 0,
      average_game_time_seconds: 0,
      games: [],
      stats_by_summoner: [],
    };
  }

  const matchIdSets = [...matchesByPuuid.values()];
  const mutualMatchIds = [...matchIdSets[0]].filter((matchId) => matchIdSets.every((set) => set.has(matchId)));

  const puuidToName = new Map(identities.map((identity) => [identity.puuid, identity.riotId]));
  const targetPuuids = new Set([...puuidToName.keys()]);
  const statTotals = new Map(request.summoners.map((s) => [s, buildEmptyTotals()]));
  const durations = [];
  const games = [];

  for (const matchId of mutualMatchIds) {
    const match = await riotClient.getMatch(request.region, matchId);
    const info = match.info || {};
    const participants = Array.isArray(info.participants) ? info.participants : [];
    const participantMap = new Map(participants.map((p) => [p.puuid, p]));

    const hasAllTrackedPlayers = [...targetPuuids].every((puuid) => participantMap.has(puuid));
    if (!hasAllTrackedPlayers) {
      continue;
    }

    const participantSummaries = [];
    for (const puuid of targetPuuids) {
      const riotId = puuidToName.get(puuid);
      const summary = summarizeParticipant(participantMap.get(puuid), riotId);
      participantSummaries.push(summary);

      const totals = statTotals.get(riotId) || buildEmptyTotals();
      totals.games += 1;
      totals.wins += summary.win ? 1 : 0;
      totals.losses += summary.win ? 0 : 1;
      totals.damage += summary.damage_output;
      totals.healing += summary.healing_shielding;
      totals.taken += summary.damage_taken;
      totals.kills += summary.kills;
      totals.deaths += summary.deaths;
      totals.assists += summary.assists;
      statTotals.set(riotId, totals);
    }

    const duration = Number(info.gameDuration || 0);
    durations.push(duration);

    games.push({
      match_id: match.metadata?.matchId || matchId,
      game_duration_seconds: duration,
      game_end_timestamp: Number(info.gameEndTimestamp || 0),
      participants: participantSummaries.sort((a, b) => a.summoner.localeCompare(b.summoner)),
    });
  }

  const statsBySummoner = request.summoners.map((summoner) => {
    const totals = statTotals.get(summoner) || buildEmptyTotals();
    const gamesPlayed = Math.max(totals.games, 1);
    return {
      summoner,
      games: totals.games,
      wins: totals.wins,
      losses: totals.losses,
      total_damage_output: totals.damage,
      avg_damage_output: totals.damage / gamesPlayed,
      total_healing_shielding: totals.healing,
      avg_healing_shielding: totals.healing / gamesPlayed,
      total_damage_taken: totals.taken,
      avg_damage_taken: totals.taken / gamesPlayed,
      total_kills: totals.kills,
      avg_kills: totals.kills / gamesPlayed,
      total_deaths: totals.deaths,
      avg_deaths: totals.deaths / gamesPlayed,
      total_assists: totals.assists,
      avg_assists: totals.assists / gamesPlayed,
    };
  });

  const averageGameTime = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;

  return {
    queried_summoners: request.summoners,
    mutual_match_count: games.length,
    average_game_time_seconds: averageGameTime,
    games: games.sort((a, b) => b.game_end_timestamp - a.game_end_timestamp),
    stats_by_summoner: statsBySummoner,
  };
}
