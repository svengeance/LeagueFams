import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import { analyzeMutualGames } from './analyzeService.js';
import { RiotApiError, RiotClient } from './riotClient.js';

const app = express();
const port = Number(process.env.PORT || 8000);

app.use(cors());
app.use(express.json());

function normalizeSummoners(rawSummoners) {
  if (!Array.isArray(rawSummoners)) {
    throw new RiotApiError('summoners must be an array of Riot IDs.');
  }

  const cleaned = rawSummoners.map((value) => `${value || ''}`.trim()).filter(Boolean);
  if (!cleaned.length) {
    throw new RiotApiError('Provide at least one summoner.');
  }

  const seen = new Set();
  const unique = [];
  for (const summoner of cleaned) {
    const key = summoner.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(summoner);
  }

  return unique;
}

function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new RiotApiError('start_date and end_date are required (YYYY-MM-DD).');
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new RiotApiError('Invalid date format. Use YYYY-MM-DD.');
  }

  if (end < start) {
    throw new RiotApiError('end_date must be on/after start_date.');
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const requestBody = req.body || {};
    const request = {
      summoners: normalizeSummoners(requestBody.summoners),
      start_date: requestBody.start_date,
      end_date: requestBody.end_date,
      region: requestBody.region || 'americas',
      platform: requestBody.platform || 'na1',
    };

    validateDateRange(request.start_date, request.end_date);

    const riotClient = new RiotClient({ apiKey: process.env.RIOT_API_KEY });
    const payload = await analyzeMutualGames(request, riotClient);
    res.json(payload);
  } catch (error) {
    const status = error instanceof RiotApiError ? 400 : 500;
    res.status(status).json({
      detail: error instanceof Error ? error.message : 'Unexpected server error',
    });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`LeagueFams backend listening on http://localhost:${port}`);
});
