const socket = io();
const feedback = document.getElementById('feedback');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const inningsGrid = document.getElementById('inningsGrid');
const awayRoster = document.getElementById('awayRoster');
const homeRoster = document.getElementById('homeRoster');
const matchSelect = document.getElementById('matchSelect');
const newMatchName = document.getElementById('newMatchName');
const createMatchBtn = document.getElementById('createMatchBtn');
const battingSideInput = document.getElementById('battingSideInput');
const currentBatterAwayInput = document.getElementById('currentBatterAwayInput');
const currentBatterHomeInput = document.getElementById('currentBatterHomeInput');
const connStatus = document.getElementById('connStatus');
const roleStatus = document.getElementById('roleStatus');
const changePinBtn = document.getElementById('changePinBtn');
const autoSaveInput = document.getElementById('autoSaveInput');
const plusBallBtn = document.getElementById('plusBallBtn');
const plusStrikeBtn = document.getElementById('plusStrikeBtn');
const plusOutBtn = document.getElementById('plusOutBtn');
const resetCountBtn = document.getElementById('resetCountBtn');
const nextHalfBtn = document.getElementById('nextHalfBtn');

let currentState = null;
let currentMatchId = null;
let role = 'viewer';
let token = window.localStorage.getItem('scoreboard_auth_token') || '';
let autoSaveTimer = null;

const refs = {
  awayTeam: document.getElementById('awayTeamInput'),
  homeTeam: document.getElementById('homeTeamInput'),
  gameStatus: document.getElementById('gameStatusInput'),
  inning: document.getElementById('inningInput'),
  half: document.getElementById('halfInput'),
  balls: document.getElementById('ballsInput'),
  strikes: document.getElementById('strikesInput'),
  outs: document.getElementById('outsInput'),
  awayRuns: document.getElementById('awayRunsInput'),
  awayHits: document.getElementById('awayHitsInput'),
  awayErrors: document.getElementById('awayErrorsInput'),
  homeRuns: document.getElementById('homeRunsInput'),
  homeHits: document.getElementById('homeHitsInput'),
  homeErrors: document.getElementById('homeErrorsInput'),
};

function avgText(h, ab) {
  if (!ab) {
    return '.000';
  }
  return (h / ab).toFixed(3).replace('0.', '.');
}

function updateRoleUI() {
  roleStatus.textContent = role.toUpperCase();
}

function isWritableRole() {
  return role === 'admin' || role === 'scorer';
}

function authPayload() {
  return {
    token,
  };
}

function requestPinAndLogin() {
  const typedPin = prompt('Inserisci PIN admin/scorer:') || '';
  if (!typedPin) {
    role = 'viewer';
    token = '';
    window.localStorage.removeItem('scoreboard_auth_token');
    updateRoleUI();
    setFeedback('PIN non inserito: accesso sola lettura', true);
    return;
  }

  socket.emit('auth:login', { pin: typedPin }, (response) => {
    if (!response?.ok) {
      role = 'viewer';
      token = '';
      window.localStorage.removeItem('scoreboard_auth_token');
      updateRoleUI();
      setFeedback(response?.error || 'Login fallito', true);
      return;
    }

    role = response.role;
    token = response.token;
    window.localStorage.setItem('scoreboard_auth_token', token);
    updateRoleUI();
    setFeedback(`Login ok: ruolo ${role.toUpperCase()} ✔`);
  });
}

function ensureLoggedIn() {
  if (token) {
    const tokenRole = token.split('.')[0];
    role = tokenRole === 'admin' ? 'admin' : 'scorer';
    updateRoleUI();
    return;
  }

  requestPinAndLogin();
}

function createInningInputs() {
  inningsGrid.innerHTML = '';

  const labels = ['INN', ...Array.from({ length: 9 }, (_, i) => String(i + 1))];
  labels.forEach((label) => {
    const head = document.createElement('div');
    head.className = 'head';
    head.textContent = label;
    inningsGrid.appendChild(head);
  });

  const awayLabel = document.createElement('div');
  awayLabel.className = 'head';
  awayLabel.textContent = 'AWAY';
  inningsGrid.appendChild(awayLabel);

  for (let i = 0; i < 9; i += 1) {
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.max = '99';
    input.id = `awayInning${i}`;
    inningsGrid.appendChild(input);
  }

  const homeLabel = document.createElement('div');
  homeLabel.className = 'head';
  homeLabel.textContent = 'HOME';
  inningsGrid.appendChild(homeLabel);

  for (let i = 0; i < 9; i += 1) {
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.max = '99';
    input.id = `homeInning${i}`;
    inningsGrid.appendChild(input);
  }
}

function rosterRowHtml(prefix, index) {
  return `
    <div class="roster-head">#</div>
    <div class="roster-head">Nome</div>
    <div class="roster-head">Pos</div>
    <div class="roster-head">AB</div>
    <div class="roster-head">H</div>
    <div class="roster-head">2B</div>
    <div class="roster-head">3B</div>
    <div class="roster-head">HR</div>
    <div class="roster-head">BB</div>
    <div class="roster-head">SO</div>
    <div class="roster-head">RBI</div>
    <div class="roster-head">AVG</div>

    ${Array.from({ length: 9 }, (_, i) => i + 1)
      .map((rowNum) => {
        const r = rowNum - 1;
        return `
          <input id="${prefix}Number${r}" type="number" min="0" max="99" />
          <input id="${prefix}Name${r}" maxlength="30" />
          <input id="${prefix}Pos${r}" maxlength="6" />
          <input id="${prefix}AB${r}" type="number" min="0" max="99" />
          <input id="${prefix}H${r}" type="number" min="0" max="99" />
          <input id="${prefix}2B${r}" type="number" min="0" max="99" />
          <input id="${prefix}3B${r}" type="number" min="0" max="99" />
          <input id="${prefix}HR${r}" type="number" min="0" max="99" />
          <input id="${prefix}BB${r}" type="number" min="0" max="99" />
          <input id="${prefix}SO${r}" type="number" min="0" max="99" />
          <input id="${prefix}RBI${r}" type="number" min="0" max="99" />
          <div class="roster-avg" id="${prefix}AVG${r}">.000</div>
        `;
      })
      .join('')}
  `;
}

function createRosterInputs() {
  awayRoster.innerHTML = rosterRowHtml('away', 0);
  homeRoster.innerHTML = rosterRowHtml('home', 0);

  ['away', 'home'].forEach((side) => {
    for (let i = 0; i < 9; i += 1) {
      const abEl = document.getElementById(`${side}AB${i}`);
      const hEl = document.getElementById(`${side}H${i}`);
      const avgEl = document.getElementById(`${side}AVG${i}`);

      const refreshAvg = () => {
        const ab = Number(abEl.value || 0);
        const h = Number(hEl.value || 0);
        avgEl.textContent = avgText(h, ab);
      };

      abEl.addEventListener('input', refreshAvg);
      hEl.addEventListener('input', refreshAvg);
    }
  });
}

function fillCurrentBatterSelect(selectEl, players, selectedId) {
  const options = players
    .map((p) => `<option value="${p.id}">${p.number}. ${p.name || 'SENZA NOME'} ${p.pos ? `(${p.pos})` : ''}</option>`)
    .join('');

  selectEl.innerHTML = options;
  if (players.some((p) => p.id === selectedId)) {
    selectEl.value = selectedId;
  }
}

function fillRoster(prefix, players) {
  for (let i = 0; i < 9; i += 1) {
    const p = players[i] || {};
    document.getElementById(`${prefix}Number${i}`).value = p.number ?? i + 1;
    document.getElementById(`${prefix}Name${i}`).value = p.name ?? '';
    document.getElementById(`${prefix}Pos${i}`).value = p.pos ?? '';
    document.getElementById(`${prefix}AB${i}`).value = p.ab ?? 0;
    document.getElementById(`${prefix}H${i}`).value = p.h ?? 0;
    document.getElementById(`${prefix}2B${i}`).value = p.doubles ?? 0;
    document.getElementById(`${prefix}3B${i}`).value = p.triples ?? 0;
    document.getElementById(`${prefix}HR${i}`).value = p.hr ?? 0;
    document.getElementById(`${prefix}BB${i}`).value = p.bb ?? 0;
    document.getElementById(`${prefix}SO${i}`).value = p.so ?? 0;
    document.getElementById(`${prefix}RBI${i}`).value = p.rbi ?? 0;
    document.getElementById(`${prefix}AVG${i}`).textContent = avgText(p.h ?? 0, p.ab ?? 0);
  }
}

function collectRoster(prefix, sourcePlayers) {
  return Array.from({ length: 9 }, (_, i) => {
    const source = sourcePlayers[i] || {};
    return {
      id: source.id,
      number: num(document.getElementById(`${prefix}Number${i}`).value, i + 1),
      name: document.getElementById(`${prefix}Name${i}`).value,
      pos: document.getElementById(`${prefix}Pos${i}`).value,
      ab: num(document.getElementById(`${prefix}AB${i}`).value),
      h: num(document.getElementById(`${prefix}H${i}`).value),
      doubles: num(document.getElementById(`${prefix}2B${i}`).value),
      triples: num(document.getElementById(`${prefix}3B${i}`).value),
      hr: num(document.getElementById(`${prefix}HR${i}`).value),
      bb: num(document.getElementById(`${prefix}BB${i}`).value),
      so: num(document.getElementById(`${prefix}SO${i}`).value),
      rbi: num(document.getElementById(`${prefix}RBI${i}`).value),
    };
  });
}

function fillMatches(matches = [], activeId = null) {
  matchSelect.innerHTML = matches
    .map((m) => `<option value="${m.id}">${m.name}</option>`)
    .join('');

  if (activeId && matches.some((m) => m.id === activeId)) {
    matchSelect.value = activeId;
    currentMatchId = activeId;
    return;
  }

  if (currentMatchId && matches.some((m) => m.id === currentMatchId)) {
    matchSelect.value = currentMatchId;
    return;
  }

  if (matches[0]) {
    matchSelect.value = matches[0].id;
    currentMatchId = matches[0].id;
  }
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function quickAdjust(inputEl, delta, min, max) {
  const current = num(inputEl.value, min);
  inputEl.value = clampValue(current + delta, min, max);
}

function fillForm(payload) {
  const state = payload?.state || payload;
  if (payload?.matchId) {
    currentMatchId = payload.matchId;
  }

  currentState = state;
  refs.awayTeam.value = state.awayTeam;
  refs.homeTeam.value = state.homeTeam;
  refs.gameStatus.value = state.gameStatus;
  refs.inning.value = state.inning;
  refs.half.value = state.half;
  refs.balls.value = state.balls;
  refs.strikes.value = state.strikes;
  refs.outs.value = state.outs;

  refs.awayRuns.value = state.awayRuns;
  refs.awayHits.value = state.awayHits;
  refs.awayErrors.value = state.awayErrors;
  refs.homeRuns.value = state.homeRuns;
  refs.homeHits.value = state.homeHits;
  refs.homeErrors.value = state.homeErrors;
  battingSideInput.value = state.battingSide || 'away';

  for (let i = 0; i < 9; i += 1) {
    document.getElementById(`awayInning${i}`).value = state.inningScores.away[i] ?? 0;
    document.getElementById(`homeInning${i}`).value = state.inningScores.home[i] ?? 0;
  }

  fillRoster('away', state.players?.away || []);
  fillRoster('home', state.players?.home || []);
  fillCurrentBatterSelect(currentBatterAwayInput, state.players?.away || [], state.currentBatterAwayId);
  fillCurrentBatterSelect(currentBatterHomeInput, state.players?.home || [], state.currentBatterHomeId);
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function collectState() {
  const awayPlayers = collectRoster('away', currentState.players?.away || []);
  const homePlayers = collectRoster('home', currentState.players?.home || []);

  return {
    ...currentState,
    awayTeam: refs.awayTeam.value,
    homeTeam: refs.homeTeam.value,
    gameStatus: refs.gameStatus.value,
    inning: num(refs.inning.value, 1),
    half: refs.half.value,
    balls: num(refs.balls.value),
    strikes: num(refs.strikes.value),
    outs: num(refs.outs.value),
    awayRuns: num(refs.awayRuns.value),
    awayHits: num(refs.awayHits.value),
    awayErrors: num(refs.awayErrors.value),
    homeRuns: num(refs.homeRuns.value),
    homeHits: num(refs.homeHits.value),
    homeErrors: num(refs.homeErrors.value),
    battingSide: battingSideInput.value,
    currentBatterAwayId: currentBatterAwayInput.value,
    currentBatterHomeId: currentBatterHomeInput.value,
    inningScores: {
      away: Array.from({ length: 9 }, (_, i) => num(document.getElementById(`awayInning${i}`).value)),
      home: Array.from({ length: 9 }, (_, i) => num(document.getElementById(`homeInning${i}`).value)),
    },
    players: {
      away: awayPlayers,
      home: homePlayers,
    },
  };
}

function setFeedback(text, isError = false) {
  feedback.textContent = text;
  feedback.style.color = isError ? '#ff9aac' : '#b5c4e6';
}

function pushUpdate() {
  if (!isWritableRole()) {
    setFeedback('Ruolo viewer: modifica non consentita', true);
    return;
  }
  if (!currentMatchId) {
    setFeedback('Nessuna partita selezionata', true);
    return;
  }

  const state = collectState();
  socket.emit('scoreboard:update', { ...authPayload(), matchId: currentMatchId, state }, (response) => {
    if (!response?.ok) {
      if ((response?.error || '').toLowerCase().includes('pin')) {
        role = 'viewer';
        token = '';
        window.localStorage.removeItem('scoreboard_auth_token');
        updateRoleUI();
      }
      setFeedback(response?.error || 'Errore aggiornamento', true);
      return;
    }
    role = response.role || role;
    updateRoleUI();
    setFeedback('Aggiornato in diretta ✔');
  });
}

function scheduleAutoSave() {
  if (!autoSaveInput.checked || !isWritableRole()) {
    return;
  }

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    pushUpdate();
  }, 700);
}

saveBtn.addEventListener('click', () => {
  pushUpdate();
});

resetBtn.addEventListener('click', () => {
  if (!currentMatchId) {
    setFeedback('Nessuna partita selezionata', true);
    return;
  }

  if (!isWritableRole()) {
    setFeedback('Ruolo viewer: reset non consentito', true);
    return;
  }

  socket.emit('scoreboard:reset', { ...authPayload(), matchId: currentMatchId }, (response) => {
    if (!response?.ok) {
      setFeedback(response?.error || 'Errore reset', true);
      return;
    }
    setFeedback('Reset eseguito ✔');
  });
});

createMatchBtn.addEventListener('click', () => {
  socket.emit('scoreboard:createMatch', { ...authPayload(), name: newMatchName.value }, (response) => {
    if (!response?.ok) {
      setFeedback(response?.error || 'Errore creazione partita', true);
      return;
    }

    setFeedback('Nuova partita creata ✔');
    newMatchName.value = '';
    if (response.match?.id) {
      currentMatchId = response.match.id;
      socket.emit('scoreboard:subscribe', { matchId: currentMatchId }, () => {});
    }
  });
});

changePinBtn.addEventListener('click', () => {
  requestPinAndLogin();
});

plusBallBtn.addEventListener('click', () => {
  quickAdjust(refs.balls, 1, 0, 3);
  scheduleAutoSave();
});

plusStrikeBtn.addEventListener('click', () => {
  quickAdjust(refs.strikes, 1, 0, 2);
  scheduleAutoSave();
});

plusOutBtn.addEventListener('click', () => {
  quickAdjust(refs.outs, 1, 0, 2);
  scheduleAutoSave();
});

resetCountBtn.addEventListener('click', () => {
  refs.balls.value = 0;
  refs.strikes.value = 0;
  refs.outs.value = 0;
  scheduleAutoSave();
});

nextHalfBtn.addEventListener('click', () => {
  const half = refs.half.value === 'top' ? 'bottom' : 'top';
  refs.half.value = half;
  if (half === 'top') {
    refs.inning.value = clampValue(num(refs.inning.value, 1) + 1, 1, 9);
  }
  refs.balls.value = 0;
  refs.strikes.value = 0;
  refs.outs.value = 0;
  battingSideInput.value = half === 'top' ? 'away' : 'home';
  scheduleAutoSave();
});

document.addEventListener('input', (event) => {
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
    return;
  }

  if (event.target.id === 'newMatchName') {
    return;
  }

  scheduleAutoSave();
});

socket.on('connect', () => {
  connStatus.textContent = 'online';
  ensureLoggedIn();
});

socket.on('disconnect', () => {
  connStatus.textContent = 'offline';
});

matchSelect.addEventListener('change', () => {
  const nextId = matchSelect.value;
  if (!nextId) {
    return;
  }

  socket.emit('scoreboard:subscribe', { matchId: nextId }, (response) => {
    if (!response?.ok) {
      setFeedback(response?.error || 'Errore cambio partita', true);
      return;
    }
    currentMatchId = nextId;
    setFeedback('Partita caricata ✔');
  });
});

createInningInputs();
createRosterInputs();
updateRoleUI();

socket.on('scoreboard:state', fillForm);
socket.on('scoreboard:matches', (payload = {}) => {
  fillMatches(payload.matches || [], payload.activeId || null);
});
