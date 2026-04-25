const express = require('express');
const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const compression = require('compression');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '';
const SCORER_PIN = process.env.SCORER_PIN || '';
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_SEC = clampTokenTtl(process.env.TOKEN_TTL_SEC, 60 * 60 * 12);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const DB_FILE = path.join(__dirname, 'data', 'scoreboard.db');

function clampTokenTtl(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(n), 60), 60 * 60 * 24 * 7);
}

const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function makePlayer(number, teamCode) {
  return {
    id: crypto.randomUUID(),
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
  return Array.from({ length: 9 }, (_, i) => makePlayer(i + 1, teamCode));
}

const defaultState = {
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
  currentBatterAwayId: '',
  currentBatterHomeId: '',
  players: {
    home: makeDefaultPlayers('HOME'),
    away: makeDefaultPlayers('AWAY'),
  },
};

defaultState.currentBatterAwayId = defaultState.players.away[0].id;
defaultState.currentBatterHomeId = defaultState.players.home[0].id;

function normalizeInningArray(values) {
  return Array.from({ length: 9 }, (_, i) => {
    const current = Number(values?.[i] ?? 0);
    return clamp(Number.isNaN(current) ? 0 : Math.round(current), 0, 99);
  });
}

function sanitizePlayer(input = {}, number = 0) {
  const safeAB = clamp(Math.round(Number(input.ab ?? 0) || 0), 0, 99);
  const safeH = clamp(Math.round(Number(input.h ?? 0) || 0), 0, safeAB);
  const safe2B = clamp(Math.round(Number(input.doubles ?? 0) || 0), 0, safeH);
  const safe3B = clamp(Math.round(Number(input.triples ?? 0) || 0), 0, safeH);
  const safeHR = clamp(Math.round(Number(input.hr ?? 0) || 0), 0, safeH);

  return {
    id: String(input.id || crypto.randomUUID()).slice(0, 60),
    number: clamp(Math.round(Number(input.number ?? number) || number), 0, 99),
    name: String(input.name || '').slice(0, 30),
    pos: String(input.pos || '').slice(0, 6).toUpperCase(),
    ab: safeAB,
    h: safeH,
    doubles: safe2B,
    triples: safe3B,
    hr: safeHR,
    bb: clamp(Math.round(Number(input.bb ?? 0) || 0), 0, 99),
    so: clamp(Math.round(Number(input.so ?? 0) || 0), 0, 99),
    rbi: clamp(Math.round(Number(input.rbi ?? 0) || 0), 0, 99),
  };
}

function sanitizePlayersArray(players = [], fallbackCode = 'TEAM') {
  const safe = Array.from({ length: 9 }, (_, i) => {
    const src = players[i] || makePlayer(i + 1, fallbackCode);
    return sanitizePlayer(src, i + 1);
  });

  return safe;
}

function ensureCurrentBatterId(id, teamPlayers) {
  const has = teamPlayers.some((p) => p.id === id);
  if (has) {
    return id;
  }
  return teamPlayers[0]?.id || '';
}

function sanitizeState(input = {}) {
  const home = normalizeInningArray(input.inningScores?.home);
  const away = normalizeInningArray(input.inningScores?.away);
  const homePlayers = sanitizePlayersArray(input.players?.home, 'HOME');
  const awayPlayers = sanitizePlayersArray(input.players?.away, 'AWAY');

  const safe = {
    homeTeam: String(input.homeTeam ?? defaultState.homeTeam).slice(0, 16).toUpperCase(),
    awayTeam: String(input.awayTeam ?? defaultState.awayTeam).slice(0, 16).toUpperCase(),
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
      home,
      away,
    },
    gameStatus: String(input.gameStatus ?? 'LIVE').slice(0, 24).toUpperCase(),
    battingSide: input.battingSide === 'home' ? 'home' : 'away',
    currentBatterAwayId: ensureCurrentBatterId(String(input.currentBatterAwayId || ''), awayPlayers),
    currentBatterHomeId: ensureCurrentBatterId(String(input.currentBatterHomeId || ''), homePlayers),
    players: {
      home: homePlayers,
      away: awayPlayers,
    },
  };

  const homeTotal = home.reduce((sum, val) => sum + val, 0);
  const awayTotal = away.reduce((sum, val) => sum + val, 0);
  safe.homeRuns = clamp(safe.homeRuns || homeTotal, 0, 99);
  safe.awayRuns = clamp(safe.awayRuns || awayTotal, 0, 99);

  return safe;
}

function getNowIso() {
  return new Date().toISOString();
}

function listMatches() {
  return db.prepare('SELECT id, name, created_at as createdAt, updated_at as updatedAt FROM matches ORDER BY datetime(created_at) DESC').all();
}

function getMatchById(matchId) {
  return db.prepare('SELECT id, name, state_json as stateJson FROM matches WHERE id = ?').get(matchId);
}

function saveMatchState(matchId, state) {
  const now = getNowIso();
  db.prepare('UPDATE matches SET state_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(state), now, matchId);
}

function createMatch(name = '') {
  const now = getNowIso();
  const id = crypto.randomUUID();
  const safeName = String(name || `Partita ${new Date().toLocaleString('it-IT')}`).slice(0, 40);
  const state = sanitizeState({ ...defaultState });

  db.prepare('INSERT INTO matches (id, name, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, safeName, JSON.stringify(state), now, now);
  return { id, name: safeName, state };
}

function getOrCreateInitialMatch() {
  const existing = db.prepare('SELECT id FROM matches ORDER BY datetime(created_at) ASC LIMIT 1').get();
  if (existing?.id) {
    return existing.id;
  }

  const created = createMatch('Partita 1');
  return created.id;
}

const fallbackMatchId = getOrCreateInitialMatch();

function loadStateByMatchId(matchId) {
  const row = getMatchById(matchId);
  if (!row) {
    return null;
  }

  try {
    return sanitizeState(JSON.parse(row.stateJson));
  } catch {
    return sanitizeState(defaultState);
  }
}

function roleFromPin(pin = '') {
  if (ADMIN_PIN && pin === ADMIN_PIN) {
    return 'admin';
  }
  if (SCORER_PIN && pin === SCORER_PIN) {
    return 'scorer';
  }
  if (!ADMIN_PIN && !SCORER_PIN) {
    return 'admin';
  }
  return 'viewer';
}

function canWrite(role) {
  return role === 'admin' || role === 'scorer';
}

function signValue(raw) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(raw).digest('base64url');
}

function createAuthToken(role) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const nonce = crypto.randomBytes(12).toString('base64url');
  const payload = `${role}.${exp}.${nonce}`;
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function verifyAuthToken(token = '') {
  const parts = String(token).split('.');
  if (parts.length !== 4) {
    return null;
  }

  const [role, expRaw, nonce, signature] = parts;
  if (!['admin', 'scorer'].includes(role)) {
    return null;
  }
  if (!nonce || nonce.length < 8) {
    return null;
  }

  const exp = Number(expRaw);
  if (!Number.isFinite(exp)) {
    return null;
  }
  if (Math.floor(Date.now() / 1000) >= exp) {
    return null;
  }

  const payload = `${role}.${expRaw}.${nonce}`;
  const expected = signValue(payload);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(signature);

  if (expectedBuf.length !== providedBuf.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return null;
  }

  return {
    role,
    exp,
  };
}

function roleFromAuth(payload = {}) {
  const auth = verifyAuthToken(payload.token);
  if (auth?.role) {
    return auth.role;
  }
  return roleFromPin(payload.pin);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
  },
});

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
}));

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/overlay', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/health', (_, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

io.on('connection', (socket) => {
  let currentMatchId = String(socket.handshake.query.matchId || '').trim() || fallbackMatchId;
  if (!getMatchById(currentMatchId)) {
    currentMatchId = fallbackMatchId;
  }

  socket.join(`match:${currentMatchId}`);

  const initialState = loadStateByMatchId(currentMatchId);
  socket.emit('scoreboard:matches', { matches: listMatches(), activeId: currentMatchId });
  socket.emit('scoreboard:state', { matchId: currentMatchId, state: initialState });

  socket.on('auth:login', (payload = {}, callback = () => {}) => {
    const role = roleFromPin(payload.pin);
    if (role !== 'admin' && role !== 'scorer') {
      callback({ ok: false, error: 'PIN non valido' });
      return;
    }

    const token = createAuthToken(role);
    callback({
      ok: true,
      role,
      token,
      expiresInSec: TOKEN_TTL_SEC,
    });
  });

  socket.on('scoreboard:subscribe', (payload = {}, callback = () => {}) => {
    const requestedId = String(payload.matchId || '').trim();
    if (!requestedId) {
      callback({ ok: false, error: 'matchId mancante' });
      return;
    }

    const row = getMatchById(requestedId);
    if (!row) {
      callback({ ok: false, error: 'Partita non trovata' });
      return;
    }

    socket.leave(`match:${currentMatchId}`);
    currentMatchId = requestedId;
    socket.join(`match:${currentMatchId}`);

    const state = loadStateByMatchId(currentMatchId);
    socket.emit('scoreboard:matches', { matches: listMatches(), activeId: currentMatchId });
    socket.emit('scoreboard:state', { matchId: currentMatchId, state });
    callback({ ok: true, matchId: currentMatchId, state });
  });

  socket.on('scoreboard:createMatch', (payload = {}, callback = () => {}) => {
    const role = roleFromAuth(payload);
    if (role !== 'admin') {
      callback({ ok: false, error: 'Permesso negato: ruolo admin richiesto' });
      return;
    }

    const created = createMatch(payload.name);
    io.emit('scoreboard:matches', { matches: listMatches() });
    callback({ ok: true, match: { id: created.id, name: created.name } });
  });

  socket.on('scoreboard:update', (payload = {}, callback = () => {}) => {
    const role = roleFromAuth(payload);
    if (!canWrite(role)) {
      callback({ ok: false, error: 'Permesso negato: pin non valido' });
      return;
    }

    const targetMatchId = String(payload.matchId || currentMatchId);
    const row = getMatchById(targetMatchId);
    if (!row) {
      callback({ ok: false, error: 'Partita non trovata' });
      return;
    }

    const currentState = loadStateByMatchId(targetMatchId) || sanitizeState(defaultState);
    const nextState = sanitizeState({
      ...currentState,
      ...payload.state,
      inningScores: {
        home: payload.state?.inningScores?.home ?? currentState.inningScores.home,
        away: payload.state?.inningScores?.away ?? currentState.inningScores.away,
      },
      players: {
        home: payload.state?.players?.home ?? currentState.players.home,
        away: payload.state?.players?.away ?? currentState.players.away,
      },
    });

    saveMatchState(targetMatchId, nextState);

    io.to(`match:${targetMatchId}`).emit('scoreboard:state', { matchId: targetMatchId, state: nextState });
    callback({ ok: true, state: nextState, role });
  });

  socket.on('scoreboard:reset', (payload = {}, callback = () => {}) => {
    const role = roleFromAuth(payload);
    if (!canWrite(role)) {
      callback({ ok: false, error: 'Permesso negato: pin non valido' });
      return;
    }

    const targetMatchId = String(payload.matchId || currentMatchId);
    const row = getMatchById(targetMatchId);
    if (!row) {
      callback({ ok: false, error: 'Partita non trovata' });
      return;
    }

    const resetState = sanitizeState({ ...defaultState });
    saveMatchState(targetMatchId, resetState);
    io.to(`match:${targetMatchId}`).emit('scoreboard:state', { matchId: targetMatchId, state: resetState });
    callback({ ok: true, state: resetState });
  });
});

server.listen(PORT, () => {
  console.log(`Scoreboard live su http://localhost:${PORT}`);
});
