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

function createDefaultSettings() {
  return {
    autoSortRosterByNumber: true,
    autoAdvanceBatters: true,
    showBallsStrikes: true,
    showBatterStrip: true,
    compactOverlay: false,
  };
}

function createDefaultBaseRunners() {
  return {
    first: false,
    second: false,
    third: false,
  };
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
    baseRunners: createDefaultBaseRunners(),
    inningScores: {
      home: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      away: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    gameStatus: 'LIVE',
    battingSide: 'away',
    currentBatterAwayIndex: 0,
    currentBatterHomeIndex: 0,
    currentBatterAwayId: awayPlayers[0].id,
    currentBatterHomeId: homePlayers[0].id,
    settings: createDefaultSettings(),
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

function sortPlayersByLineup(players = []) {
  return [...players].sort((left, right) => {
    const leftNumber = Number(left.number ?? 0);
    const rightNumber = Number(right.number ?? 0);
    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return String(left.name || '').localeCompare(String(right.name || ''));
  });
}

function sanitizeSettings(input = {}) {
  const defaultSettings = createDefaultSettings();
  return {
    autoSortRosterByNumber: Boolean(input.autoSortRosterByNumber ?? defaultSettings.autoSortRosterByNumber),
    autoAdvanceBatters: Boolean(input.autoAdvanceBatters ?? defaultSettings.autoAdvanceBatters),
    showBallsStrikes: Boolean(input.showBallsStrikes ?? defaultSettings.showBallsStrikes),
    showBatterStrip: Boolean(input.showBatterStrip ?? defaultSettings.showBatterStrip),
    compactOverlay: Boolean(input.compactOverlay ?? defaultSettings.compactOverlay),
  };
}

function sanitizeBaseRunners(input = {}) {
  const defaults = createDefaultBaseRunners();
  return {
    first: Boolean(input.first ?? defaults.first),
    second: Boolean(input.second ?? defaults.second),
    third: Boolean(input.third ?? defaults.third),
  };
}

function sanitizePlayersArray(players = [], fallbackCode = 'TEAM', sortRoster = true) {
  const sanitized = Array.from({ length: 9 }, (_, index) => sanitizePlayer(players[index] || makePlayer(index + 1, fallbackCode), index + 1));
  return sortRoster ? sortPlayersByLineup(sanitized) : sanitized;
}

function getPlayerIndex(players = [], playerId = '') {
  return players.findIndex((player) => player.id === playerId);
}

function getPlayerByIndex(players = [], index = 0) {
  return players[(index + players.length) % players.length] || null;
}

function advanceBatterIndex(players = [], currentIndex = 0) {
  if (!players.length) {
    return 0;
  }
  return (currentIndex + 1) % players.length;
}

function currentBatterFromState(state, side) {
  const players = side === 'home' ? state.players.home : state.players.away;
  const currentId = side === 'home' ? state.currentBatterHomeId : state.currentBatterAwayId;
  const currentIndex = getPlayerIndex(players, currentId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  return { players, currentId, currentIndex: safeIndex };
}

function withAdvancedBatter(state, side) {
  const nextState = clone(state);
  const { players, currentIndex } = currentBatterFromState(nextState, side);
  const nextIndex = advanceBatterIndex(players, currentIndex);
  const nextPlayer = getPlayerByIndex(players, nextIndex);

  if (side === 'home') {
    nextState.currentBatterHomeIndex = nextIndex;
    nextState.currentBatterHomeId = nextPlayer?.id || '';
  } else {
    nextState.currentBatterAwayIndex = nextIndex;
    nextState.currentBatterAwayId = nextPlayer?.id || '';
  }

  return nextState;
}

function currentInningIndex(state) {
  return clamp(Math.round(Number(state.inning || 1)) - 1, 0, 8);
}

function addRuns(state, side, runs) {
  const scored = Math.max(0, Math.round(Number(runs || 0)));
  if (!scored) {
    return;
  }

  const inningIndex = currentInningIndex(state);
  if (side === 'home') {
    state.homeRuns = clamp((state.homeRuns || 0) + scored, 0, 99);
    state.inningScores.home[inningIndex] = clamp((state.inningScores.home[inningIndex] || 0) + scored, 0, 99);
  } else {
    state.awayRuns = clamp((state.awayRuns || 0) + scored, 0, 99);
    state.inningScores.away[inningIndex] = clamp((state.inningScores.away[inningIndex] || 0) + scored, 0, 99);
  }
}

function changeHalfInning(state) {
  const nextHalf = state.half === 'top' ? 'bottom' : 'top';
  state.half = nextHalf;
  if (nextHalf === 'top') {
    state.inning = clamp((state.inning || 1) + 1, 1, 9);
  }
  state.battingSide = nextHalf === 'top' ? 'away' : 'home';
  state.outs = 0;
  state.balls = 0;
  state.strikes = 0;
  state.baseRunners = createDefaultBaseRunners();
}

function addOut(state, count = 1) {
  let remaining = Math.max(0, Math.round(Number(count || 0)));
  while (remaining > 0) {
    state.outs += 1;
    if (state.outs >= 3) {
      changeHalfInning(state);
      break;
    }
    remaining -= 1;
  }
}

function advanceRunnersByHit(baseRunners, hitBases) {
  const next = createDefaultBaseRunners();
  let runs = 0;

  if (baseRunners.third) {
    if (hitBases >= 1) {
      runs += 1;
    } else {
      next.third = true;
    }
  }

  if (baseRunners.second) {
    if (hitBases >= 2) {
      runs += 1;
    } else if (hitBases === 1) {
      next.third = true;
    }
  }

  if (baseRunners.first) {
    if (hitBases >= 3) {
      runs += 1;
    } else if (hitBases === 2) {
      next.third = true;
    } else if (hitBases === 1) {
      next.second = true;
    }
  }

  if (hitBases === 1) {
    next.first = true;
  } else if (hitBases === 2) {
    next.second = true;
  } else if (hitBases === 3) {
    next.third = true;
  } else if (hitBases >= 4) {
    runs += 1;
  }

  return { next, runs };
}

function advanceRunnersByWalk(baseRunners) {
  const next = {
    first: baseRunners.first,
    second: baseRunners.second,
    third: baseRunners.third,
  };
  let runs = 0;

  if (!baseRunners.first) {
    next.first = true;
    return { next, runs };
  }

  if (baseRunners.first && baseRunners.second && baseRunners.third) {
    runs += 1;
  }

  if (baseRunners.first && baseRunners.second) {
    next.third = true;
  }

  if (baseRunners.first) {
    next.second = true;
  }

  next.first = true;
  return { next, runs };
}

function applyAutomaticCountRules(state, side) {
  const nextState = clone(state);
  const players = side === 'home' ? nextState.players.home : nextState.players.away;
  const currentId = side === 'home' ? nextState.currentBatterHomeId : nextState.currentBatterAwayId;
  const currentIndex = getPlayerIndex(players, currentId) >= 0 ? getPlayerIndex(players, currentId) : 0;
  const batter = players[currentIndex];

  if (nextState.balls >= 4) {
    if (batter) {
      batter.bb = clamp((batter.bb || 0) + 1, 0, 99);
    }
    const walkResult = advanceRunnersByWalk(nextState.baseRunners || createDefaultBaseRunners());
    nextState.baseRunners = walkResult.next;
    addRuns(nextState, side, walkResult.runs);
    if (batter) {
      batter.rbi = clamp((batter.rbi || 0) + walkResult.runs, 0, 99);
    }
    nextState.balls = 0;
    nextState.strikes = 0;
    if (nextState.settings?.autoAdvanceBatters) {
      return withAdvancedBatter(nextState, side);
    }
  }

  if (nextState.strikes >= 3) {
    if (batter) {
      batter.ab = clamp((batter.ab || 0) + 1, 0, 99);
      batter.so = clamp((batter.so || 0) + 1, 0, 99);
    }
    nextState.balls = 0;
    nextState.strikes = 0;
    addOut(nextState, 1);
    if (nextState.settings?.autoAdvanceBatters) {
      return withAdvancedBatter(nextState, side);
    }
  }

  if (nextState.outs >= 3) {
    changeHalfInning(nextState);
  }

  return nextState;
}

function applyPlateAppearance(state, side, result) {
  const nextState = clone(state);
  const isHome = side === 'home';
  const players = isHome ? nextState.players.home : nextState.players.away;
  const currentId = isHome ? nextState.currentBatterHomeId : nextState.currentBatterAwayId;
  const currentIndex = getPlayerIndex(players, currentId) >= 0 ? getPlayerIndex(players, currentId) : 0;
  const batter = players[currentIndex];

  if (!batter) {
    return nextState;
  }

  if (result === 'single') {
    batter.ab += 1;
    batter.h += 1;
    const runners = advanceRunnersByHit(nextState.baseRunners || createDefaultBaseRunners(), 1);
    nextState.baseRunners = runners.next;
    addRuns(nextState, side, runners.runs);
    batter.rbi = clamp((batter.rbi || 0) + runners.runs, 0, 99);
    nextState.balls = 0;
    nextState.strikes = 0;
    if (isHome) nextState.homeHits += 1; else nextState.awayHits += 1;
  } else if (result === 'double') {
    batter.ab += 1;
    batter.h += 1;
    batter.doubles += 1;
    const runners = advanceRunnersByHit(nextState.baseRunners || createDefaultBaseRunners(), 2);
    nextState.baseRunners = runners.next;
    addRuns(nextState, side, runners.runs);
    batter.rbi = clamp((batter.rbi || 0) + runners.runs, 0, 99);
    nextState.balls = 0;
    nextState.strikes = 0;
    if (isHome) nextState.homeHits += 1; else nextState.awayHits += 1;
  } else if (result === 'triple') {
    batter.ab += 1;
    batter.h += 1;
    batter.triples += 1;
    const runners = advanceRunnersByHit(nextState.baseRunners || createDefaultBaseRunners(), 3);
    nextState.baseRunners = runners.next;
    addRuns(nextState, side, runners.runs);
    batter.rbi = clamp((batter.rbi || 0) + runners.runs, 0, 99);
    nextState.balls = 0;
    nextState.strikes = 0;
    if (isHome) nextState.homeHits += 1; else nextState.awayHits += 1;
  } else if (result === 'homeRun') {
    batter.ab += 1;
    batter.h += 1;
    batter.hr += 1;
    const runners = advanceRunnersByHit(nextState.baseRunners || createDefaultBaseRunners(), 4);
    nextState.baseRunners = runners.next;
    addRuns(nextState, side, runners.runs);
    batter.rbi = clamp((batter.rbi || 0) + runners.runs, 0, 99);
    nextState.balls = 0;
    nextState.strikes = 0;
    if (isHome) nextState.homeHits += 1; else nextState.awayHits += 1;
  } else if (result === 'walk') {
    batter.bb += 1;
    const runners = advanceRunnersByWalk(nextState.baseRunners || createDefaultBaseRunners());
    nextState.baseRunners = runners.next;
    addRuns(nextState, side, runners.runs);
    batter.rbi = clamp((batter.rbi || 0) + runners.runs, 0, 99);
    nextState.balls = 0;
    nextState.strikes = 0;
  } else if (result === 'out') {
    batter.ab += 1;
    batter.so += 1;
    addOut(nextState, 1);
    nextState.balls = 0;
    nextState.strikes = 0;
  }

  const nextSettings = nextState.settings || createDefaultSettings();
  if (nextSettings.autoAdvanceBatters) {
    return withAdvancedBatter(nextState, side);
  }

  return nextState;
}

function sanitizeState(input = {}) {
  const settings = sanitizeSettings(input.settings);
  const homePlayers = sanitizePlayersArray(input.players?.home, 'HOME', settings.autoSortRosterByNumber);
  const awayPlayers = sanitizePlayersArray(input.players?.away, 'AWAY', settings.autoSortRosterByNumber);
  const homeInnings = normalizeInningArray(input.inningScores?.home);
  const awayInnings = normalizeInningArray(input.inningScores?.away);
  const homeCurrentIndex = Math.max(0, getPlayerIndex(homePlayers, String(input.currentBatterHomeId || '')));
  const awayCurrentIndex = Math.max(0, getPlayerIndex(awayPlayers, String(input.currentBatterAwayId || '')));
  const homeCurrentPlayer = homePlayers[homeCurrentIndex] || homePlayers[0];
  const awayCurrentPlayer = awayPlayers[awayCurrentIndex] || awayPlayers[0];

  const rawOuts = Math.max(0, Math.round(Number(input.outs ?? 0) || 0));
  const rawBalls = Math.max(0, Math.round(Number(input.balls ?? 0) || 0));
  const rawStrikes = Math.max(0, Math.round(Number(input.strikes ?? 0) || 0));

  const state = {
    homeTeam: String(input.homeTeam ?? 'HOME').slice(0, 16).toUpperCase(),
    awayTeam: String(input.awayTeam ?? 'AWAY').slice(0, 16).toUpperCase(),
    inning: clamp(Math.round(Number(input.inning ?? 1) || 1), 1, 9),
    half: input.half === 'bottom' ? 'bottom' : 'top',
    balls: clamp(rawBalls, 0, 4),
    strikes: clamp(rawStrikes, 0, 3),
    outs: clamp(rawOuts, 0, 3),
    homeRuns: clamp(Math.round(Number(input.homeRuns ?? 0) || 0), 0, 99),
    awayRuns: clamp(Math.round(Number(input.awayRuns ?? 0) || 0), 0, 99),
    homeHits: clamp(Math.round(Number(input.homeHits ?? 0) || 0), 0, 99),
    awayHits: clamp(Math.round(Number(input.awayHits ?? 0) || 0), 0, 99),
    homeErrors: clamp(Math.round(Number(input.homeErrors ?? 0) || 0), 0, 99),
    awayErrors: clamp(Math.round(Number(input.awayErrors ?? 0) || 0), 0, 99),
    baseRunners: sanitizeBaseRunners(input.baseRunners),
    inningScores: {
      home: homeInnings,
      away: awayInnings,
    },
    gameStatus: String(input.gameStatus ?? 'LIVE').slice(0, 24).toUpperCase(),
    battingSide: input.battingSide === 'home' ? 'home' : 'away',
    currentBatterAwayIndex: awayCurrentIndex,
    currentBatterHomeIndex: homeCurrentIndex,
    currentBatterAwayId: awayCurrentPlayer?.id || awayPlayers[0].id,
    currentBatterHomeId: homeCurrentPlayer?.id || homePlayers[0].id,
    settings,
    players: {
      home: homePlayers,
      away: awayPlayers,
    },
  };

  const homeTotal = homeInnings.reduce((sum, value) => sum + value, 0);
  const awayTotal = awayInnings.reduce((sum, value) => sum + value, 0);

  state.homeRuns = state.homeRuns || homeTotal;
  state.awayRuns = state.awayRuns || awayTotal;
  const autoAdjusted = applyAutomaticCountRules(state, state.battingSide);
  autoAdjusted.outs = clamp(Math.round(Number(autoAdjusted.outs || 0)), 0, 2);
  autoAdjusted.balls = clamp(Math.round(Number(autoAdjusted.balls || 0)), 0, 3);
  autoAdjusted.strikes = clamp(Math.round(Number(autoAdjusted.strikes || 0)), 0, 2);
  autoAdjusted.baseRunners = sanitizeBaseRunners(autoAdjusted.baseRunners);

  return autoAdjusted;
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
