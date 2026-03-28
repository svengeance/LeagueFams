const DEFAULT_TIMEOUT_MS = 30000;

export class RiotApiError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'RiotApiError';
    this.statusCode = statusCode;
  }
}

function ensureRiotId(raw) {
  const trimmed = `${raw || ''}`.trim();
  if (!trimmed.includes('#')) {
    throw new RiotApiError(`'${raw}' is invalid. Use Riot ID format gameName#tagLine.`);
  }

  const [gameName, tagLine] = trimmed.split('#', 2);
  if (!gameName || !tagLine) {
    throw new RiotApiError(`'${raw}' is invalid. Use Riot ID format gameName#tagLine.`);
  }

  return { gameName, tagLine, riotId: `${gameName}#${tagLine}` };
}

async function riotGet(url, apiKey, params = {}) {
  const targetUrl = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      targetUrl.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: { 'X-Riot-Token': apiKey },
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new RiotApiError(
        `Riot API request failed (${response.status}) for ${targetUrl.pathname}: ${detail}`,
        response.status,
      );
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new RiotApiError('Riot API request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class RiotClient {
  constructor({ apiKey = process.env.RIOT_API_KEY } = {}) {
    if (!apiKey) {
      throw new RiotApiError('Missing RIOT_API_KEY environment variable.');
    }

    this.apiKey = apiKey;
  }

  async getIdentity(platform, riotId) {
    const { gameName, tagLine, riotId: normalizedRiotId } = ensureRiotId(riotId);
    const url = `https://${platform}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const payload = await riotGet(url, this.apiKey);
    return { riotId: normalizedRiotId, puuid: payload.puuid };
  }

  async getMatchIds(region, puuid, startDate, endDate, count = 100) {
    const startTime = Math.floor(new Date(`${startDate}T00:00:00.000Z`).getTime() / 1000);
    const endTime = Math.floor(new Date(`${endDate}T23:59:59.999Z`).getTime() / 1000);

    const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`;
    const params = {
      startTime,
      endTime,
      type: 'ranked',
      count,
      start: 0,
    };

    return riotGet(url, this.apiKey, params);
  }

  async getMatch(region, matchId) {
    const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    return riotGet(url, this.apiKey);
  }
}
