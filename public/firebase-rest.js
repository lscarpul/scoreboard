const FIREBASE_ROOT_URL = `${FIREBASE_DB_URL.replace(/\/$/, '')}/${SCOREBOARD_DB_PATH}`;

function createId(prefix = 'id') {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function nowIso() {
  return new Date().toISOString();
}

function makePlayer(number, teamCode) {
  return {
    id: createId(`player-${teamCode.toLowerCase()}`),
    number,
    name: `${teamCode} ${number}`,
    pos: '',
    ab: 0,
    h: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    bb: 0,
    so: 0,
    rbi: 0,
  };
}

function makeDefaultPlayers(teamCode) {
  return Array.from({ length: 9 }, (_, index) => makePlayer(index + 1, teamCode));
}

function createDefaultState() {
  const homePlayers = makeDefaultPlayers('HOME');
  const awayPlayers = makeDefaultPlayers('AWAY');

  return {
    homeTeam: 'HOME',
    awayTeam: 'AWAY',
    inning: 1,
    half: 'top',
    balls: 0,
    strikes: 0,
    outs: 0,
    homeRuns: 0,
    awayRuns: 0,
    homeHits: 0,
    awayHits: 0,
    homeErrors: 0,
    awayErrors: 0,
    inningScores: {
      home: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      away: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    gameStatus: 'LIVE',
    battingSide: 'away',
    currentBatterAwayId: awayPlayers[0].id,
    currentBatterHomeId: homePlayers[0].id,
    players: {
      home: homePlayers,
      away: awayPlayers,
    },
  };
}

function normalizeInningArray(values) {
  return Array.from({ length: 9 }, (_, index) => {
    const current = Number(values?.[index] ?? 0);
    return clamp(Number.isNaN(current) ? 0 : Math.round(current), 0, 99);
  });
}

function sanitizePlayer(input = {}, number = 0) {
  const ab = clamp(Math.round(Number(input.ab ?? 0) || 0), 0, 99);
  const hits = clamp(Math.round(Number(input.h ?? 0) || 0), 0, ab);
  const doubles = clamp(Math.round(Number(input.doubles ?? 0) || 0), 0, hits);
  const triples = clamp(Math.round(Number(input.triples ?? 0) || 0), 0, hits);
  const homeRuns = clamp(Math.round(Number(input.hr ?? 0) || 0), 0, hits);

  return {
    id: String(input.id || createId('player')).slice(0, 80),
    number: clamp(Math.round(Number(input.number ?? number) || number), 0, 99),
    name: String(input.name || '').slice(0, 30),
    pos: String(input.pos || '').slice(0, 6).toUpperCase(),
    ab,
    h: hits,
    doubles,
    triples,
    hr: homeRuns,
    bb: clamp(Math.round(Number(input.bb ?? 0) || 0), 0, 99),
    so: clamp(Math.round(Number(input.so ?? 0) || 0), 0, 99),
    rbi: clamp(Math.round(Number(input.rbi ?? 0) || 0), 0, 99),
  };
}

function sanitizePlayersArray(players = [], fallbackCode = 'TEAM') {
  return Array.from({ length: 9 }, (_, index) => sanitizePlayer(players[index] || makePlayer(index + 1, fallbackCode), index + 1));
}

function sanitizeState(input = {}) {
  const homePlayers = sanitizePlayersArray(input.players?.home, 'HOME');
  const awayPlayers = sanitizePlayersArray(input.players?.away, 'AWAY');
  const homeInnings = normalizeInningArray(input.inningScores?.home);
  const awayInnings = normalizeInningArray(input.inningScores?.away);

  const state = {
    homeTeam: String(input.homeTeam ?? 'HOME').slice(0, 16).toUpperCase(),
    awayTeam: String(input.awayTeam ?? 'AWAY').slice(0, 16).toUpperCase(),
    inning: clamp(Math.round(Number(input.inning ?? 1) || 1), 1, 9),
    half: input.half === 'bottom' ? 'bottom' : 'top',
    balls: clamp(Math.round(Number(input.balls ?? 0) || 0), 0, 3),
    strikes: clamp(Math.round(Number(input.strikes ?? 0) || 0), 0, 2),
    outs: clamp(Math.round(Number(input.outs ?? 0) || 0), 0, 2),
    homeRuns: clamp(Math.round(Number(input.homeRuns ?? 0) || 0), 0, 99),
    awayRuns: clamp(Math.round(Number(input.awayRuns ?? 0) || 0), 0, 99),
    homeHits: clamp(Math.round(Number(input.homeHits ?? 0) || 0), 0, 99),
    awayHits: clamp(Math.round(Number(input.awayHits ?? 0) || 0), 0, 99),
    homeErrors: clamp(Math.round(Number(input.homeErrors ?? 0) || 0), 0, 99),
    awayErrors: clamp(Math.round(Number(input.awayErrors ?? 0) || 0), 0, 99),
    inningScores: {
      home: homeInnings,
      away: awayInnings,
    },
    gameStatus: String(input.gameStatus ?? 'LIVE').slice(0, 24).toUpperCase(),
    battingSide: input.battingSide === 'home' ? 'home' : 'away',
    currentBatterAwayId: String(input.currentBatterAwayId || awayPlayers[0].id),
    currentBatterHomeId: String(input.currentBatterHomeId || homePlayers[0].id),
    players: {
      home: homePlayers,
      away: awayPlayers,
    },
  };

  const homeTotal = homeInnings.reduce((sum, value) => sum + value, 0);
  const awayTotal = awayInnings.reduce((sum, value) => sum + value, 0);

  state.homeRuns = state.homeRuns || homeTotal;
  state.awayRuns = state.awayRuns || awayTotal;

  return state;
}

function sanitizeMatch(input = {}, fallbackName = 'Partita') {
  return {
    id: String(input.id || createId('match')),
    name: String(input.name || fallbackName).slice(0, 40),
    createdAt: String(input.createdAt || nowIso()),
    updatedAt: String(input.updatedAt || nowIso()),
    state: sanitizeState(input.state || createDefaultState()),
  };
}

function createDefaultRoot() {
  const match = sanitizeMatch({ name: 'Partita 1', state: createDefaultState() }, 'Partita 1');
  return {
    activeMatchId: match.id,
    matches: {
      [match.id]: match,
    },
    updatedAt: nowIso(),
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function loadRoot() {
  const root = await fetchJson(`${FIREBASE_ROOT_URL}.json`);
  if (!root || typeof root !== 'object' || !root.matches) {
    const defaultRoot = createDefaultRoot();
    await saveRoot(defaultRoot);
    return defaultRoot;
  }

  const matches = Object.fromEntries(
    Object.entries(root.matches || {}).map(([id, match]) => [id, sanitizeMatch({ id, ...match }, match?.name || 'Partita')])
  );

  return {
    activeMatchId: String(root.activeMatchId || Object.keys(matches)[0] || ''),
    matches,
    updatedAt: String(root.updatedAt || nowIso()),
  };
}

async function saveRoot(root) {
  const normalized = {
    activeMatchId: String(root.activeMatchId || ''),
    matches: root.matches || {},
    updatedAt: nowIso(),
  };

  await fetchJson(`${FIREBASE_ROOT_URL}.json`, {
    method: 'PUT',
    body: JSON.stringify(normalized),
  });

  return normalized;
}

async function updateMatch(matchId, updateFn) {
  const root = await loadRoot();
  const currentMatch = root.matches[matchId];
  if (!currentMatch) {
    throw new Error('Partita non trovata');
  }

  const nextMatch = sanitizeMatch(updateFn(currentMatch), currentMatch.name);
  root.matches[matchId] = nextMatch;
  root.updatedAt = nowIso();
  await saveRoot(root);
  return root;
}

async function createMatch(name) {
  const root = await loadRoot();
  const match = sanitizeMatch({ name: String(name || 'Nuova partita'), state: createDefaultState() }, name || 'Nuova partita');
  root.matches[match.id] = match;
  root.activeMatchId = match.id;
  root.updatedAt = nowIso();
  await saveRoot(root);
  return root;
}

async function resetMatch(matchId) {
  return updateMatch(matchId, (match) => ({
    ...match,
    updatedAt: nowIso(),
    state: createDefaultState(),
  }));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function averageText(hits, atBats) {
  if (!atBats) {
    return '.000';
  }
  return (hits / atBats).toFixed(3).replace('0.', '.');
}

function batterLine(player) {
  if (!player) {
    return '0-0';
  }

  return `${player.h}-${player.ab} | 2B ${player.doubles} 3B ${player.triples} HR ${player.hr} BB ${player.bb} SO ${player.so} AVG ${averageText(player.h, player.ab)}`;
}
