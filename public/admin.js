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
const autoAdvanceBattersInput = document.getElementById('autoAdvanceBattersInput');
const autoSortRosterInput = document.getElementById('autoSortRosterInput');
const showBatterStripInput = document.getElementById('showBatterStripInput');
const compactOverlayInput = document.getElementById('compactOverlayInput');
const nextBatterBtn = document.getElementById('nextBatterBtn');
const singleBtn = document.getElementById('singleBtn');
const doubleBtn = document.getElementById('doubleBtn');
const tripleBtn = document.getElementById('tripleBtn');
const homeRunBtn = document.getElementById('homeRunBtn');
const walkBtn = document.getElementById('walkBtn');
const outBtn = document.getElementById('outBtn');

let rootState = null;
let currentMatchId = '';
let role = 'viewer';
let autoSaveTimer = null;
let lastSavedJson = '';

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

function avgText(hits, atBats) {
  if (!atBats) {
    return '.000';
  }
  return (hits / atBats).toFixed(3).replace('0.', '.');
}

function setFeedback(text, isError = false) {
  feedback.textContent = text;
  feedback.style.color = isError ? '#ff9aac' : '#b5c4e6';
}

function updateRoleUI() {
  roleStatus.textContent = role.toUpperCase();
}

function promptRole() {
  const typed = prompt('Inserisci un PIN locale per sbloccare l\'editor (opzionale):') || '';
  role = typed ? 'editor' : 'viewer';
  updateRoleUI();
  if (!typed) {
    setFeedback('Modalità sola lettura attiva', true);
  }
}

function createInningInputs() {
  inningsGrid.innerHTML = '';
  const labels = ['INN', ...Array.from({ length: 9 }, (_, index) => String(index + 1))];

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

  for (let index = 0; index < 9; index += 1) {
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.max = '99';
    input.id = `awayInning${index}`;
    inningsGrid.appendChild(input);
  }

  const homeLabel = document.createElement('div');
  homeLabel.className = 'head';
  homeLabel.textContent = 'HOME';
  inningsGrid.appendChild(homeLabel);

  for (let index = 0; index < 9; index += 1) {
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.max = '99';
    input.id = `homeInning${index}`;
    inningsGrid.appendChild(input);
  }
}

function rosterGridHtml(prefix) {
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

    ${Array.from({ length: 9 }, (_, index) => index)
      .map((index) => `
        <input id="${prefix}Number${index}" type="number" min="0" max="99" />
        <input id="${prefix}Name${index}" maxlength="30" />
        <input id="${prefix}Pos${index}" maxlength="6" />
        <input id="${prefix}AB${index}" type="number" min="0" max="99" />
        <input id="${prefix}H${index}" type="number" min="0" max="99" />
        <input id="${prefix}2B${index}" type="number" min="0" max="99" />
        <input id="${prefix}3B${index}" type="number" min="0" max="99" />
        <input id="${prefix}HR${index}" type="number" min="0" max="99" />
        <input id="${prefix}BB${index}" type="number" min="0" max="99" />
        <input id="${prefix}SO${index}" type="number" min="0" max="99" />
        <input id="${prefix}RBI${index}" type="number" min="0" max="99" />
        <div class="roster-avg" id="${prefix}AVG${index}">.000</div>
      `)
      .join('')}
  `;
}

function createRosterInputs() {
  awayRoster.innerHTML = rosterGridHtml('away');
  homeRoster.innerHTML = rosterGridHtml('home');

  ['away', 'home'].forEach((side) => {
    for (let index = 0; index < 9; index += 1) {
      const abEl = document.getElementById(`${side}AB${index}`);
      const hEl = document.getElementById(`${side}H${index}`);
      const avgEl = document.getElementById(`${side}AVG${index}`);
      const refreshAvg = () => {
        avgEl.textContent = avgText(Number(hEl.value || 0), Number(abEl.value || 0));
      };
      abEl.addEventListener('input', refreshAvg);
      hEl.addEventListener('input', refreshAvg);
    }
  });
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function quickAdjust(inputEl, delta, min, max) {
  inputEl.value = clampValue(num(inputEl.value, min) + delta, min, max);
  scheduleAutoSave();
}

function getSettingsFromForm() {
  return {
    autoAdvanceBatters: autoAdvanceBattersInput.checked,
    autoSortRosterByNumber: autoSortRosterInput.checked,
    showBatterStrip: showBatterStripInput.checked,
    compactOverlay: compactOverlayInput.checked,
  };
}

function fillMatches(root) {
  const matches = Object.values(root.matches || {});
  matchSelect.innerHTML = matches.map((match) => `<option value="${match.id}">${match.name}</option>`).join('');

  if (matches.some((match) => match.id === currentMatchId)) {
    matchSelect.value = currentMatchId;
  } else if (root.activeMatchId) {
    matchSelect.value = root.activeMatchId;
    currentMatchId = root.activeMatchId;
  } else if (matches[0]) {
    currentMatchId = matches[0].id;
    matchSelect.value = currentMatchId;
  }
}

function fillRoster(prefix, players) {
  for (let index = 0; index < 9; index += 1) {
    const player = players[index] || {};
    document.getElementById(`${prefix}Number${index}`).value = player.number ?? index + 1;
    document.getElementById(`${prefix}Name${index}`).value = player.name ?? '';
    document.getElementById(`${prefix}Pos${index}`).value = player.pos ?? '';
    document.getElementById(`${prefix}AB${index}`).value = player.ab ?? 0;
    document.getElementById(`${prefix}H${index}`).value = player.h ?? 0;
    document.getElementById(`${prefix}2B${index}`).value = player.doubles ?? 0;
    document.getElementById(`${prefix}3B${index}`).value = player.triples ?? 0;
    document.getElementById(`${prefix}HR${index}`).value = player.hr ?? 0;
    document.getElementById(`${prefix}BB${index}`).value = player.bb ?? 0;
    document.getElementById(`${prefix}SO${index}`).value = player.so ?? 0;
    document.getElementById(`${prefix}RBI${index}`).value = player.rbi ?? 0;
    document.getElementById(`${prefix}AVG${index}`).textContent = avgText(player.h ?? 0, player.ab ?? 0);
  }
}

function fillBatterSelect(selectEl, players, selectedId) {
  selectEl.innerHTML = players
    .map((player) => `<option value="${player.id}">${player.number}. ${player.name || 'SENZA NOME'} ${player.pos ? `(${player.pos})` : ''}</option>`)
    .join('');

  if (players.some((player) => player.id === selectedId)) {
    selectEl.value = selectedId;
  }
}

function fillForm(match, root) {
  const state = match.state;
  rootState = root;
  currentMatchId = match.id;

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

  autoAdvanceBattersInput.checked = state.settings?.autoAdvanceBatters ?? true;
  autoSortRosterInput.checked = state.settings?.autoSortRosterByNumber ?? true;
  showBatterStripInput.checked = state.settings?.showBatterStrip ?? true;
  compactOverlayInput.checked = state.settings?.compactOverlay ?? false;

  for (let index = 0; index < 9; index += 1) {
    document.getElementById(`awayInning${index}`).value = state.inningScores.away[index] ?? 0;
    document.getElementById(`homeInning${index}`).value = state.inningScores.home[index] ?? 0;
  }

  fillRoster('away', state.players?.away || []);
  fillRoster('home', state.players?.home || []);
  fillBatterSelect(currentBatterAwayInput, state.players?.away || [], state.currentBatterAwayId);
  fillBatterSelect(currentBatterHomeInput, state.players?.home || [], state.currentBatterHomeId);
  fillMatches(root);

  lastSavedJson = JSON.stringify({ root, matchId: currentMatchId });
}

function collectRoster(prefix, sourcePlayers) {
  return Array.from({ length: 9 }, (_, index) => ({
    id: sourcePlayers[index]?.id,
    number: num(document.getElementById(`${prefix}Number${index}`).value, index + 1),
    name: document.getElementById(`${prefix}Name${index}`).value,
    pos: document.getElementById(`${prefix}Pos${index}`).value,
    ab: num(document.getElementById(`${prefix}AB${index}`).value),
    h: num(document.getElementById(`${prefix}H${index}`).value),
    doubles: num(document.getElementById(`${prefix}2B${index}`).value),
    triples: num(document.getElementById(`${prefix}3B${index}`).value),
    hr: num(document.getElementById(`${prefix}HR${index}`).value),
    bb: num(document.getElementById(`${prefix}BB${index}`).value),
    so: num(document.getElementById(`${prefix}SO${index}`).value),
    rbi: num(document.getElementById(`${prefix}RBI${index}`).value),
  }));
}

function collectState() {
  const awayPlayers = collectRoster('away', rootState?.matches?.[currentMatchId]?.state?.players?.away || []);
  const homePlayers = collectRoster('home', rootState?.matches?.[currentMatchId]?.state?.players?.home || []);

  return {
    awayTeam: refs.awayTeam.value,
    homeTeam: refs.homeTeam.value,
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
    gameStatus: refs.gameStatus.value,
    battingSide: battingSideInput.value,
    currentBatterAwayId: currentBatterAwayInput.value,
    currentBatterHomeId: currentBatterHomeInput.value,
    settings: getSettingsFromForm(),
    inningScores: {
      away: Array.from({ length: 9 }, (_, index) => num(document.getElementById(`awayInning${index}`).value)),
      home: Array.from({ length: 9 }, (_, index) => num(document.getElementById(`homeInning${index}`).value)),
    },
    players: {
      away: awayPlayers,
      home: homePlayers,
    },
  };
}

async function refreshAdmin() {
  try {
    const root = await loadRoot();
    connStatus.textContent = 'online';

    const selectedMatch = root.matches[currentMatchId] || root.matches[root.activeMatchId] || Object.values(root.matches)[0];
    if (selectedMatch) {
      fillForm(selectedMatch, root);
    }
  } catch (error) {
    connStatus.textContent = 'offline';
    console.error(error);
  }
}

function scheduleAutoSave() {
  if (!autoSaveInput.checked || role === 'viewer') {
    return;
  }

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    pushUpdate();
  }, 700);
}

async function updateActiveMatch(matchId) {
  const root = await loadRoot();
  root.activeMatchId = matchId;
  await saveRoot(root);
}

async function pushUpdate() {
  if (role === 'viewer') {
    setFeedback('Modalità sola lettura', true);
    return;
  }

  if (!currentMatchId) {
    setFeedback('Nessuna partita selezionata', true);
    return;
  }

  try {
    await updateMatch(currentMatchId, (currentMatch) => {
      const nextState = sanitizeState({
        ...currentMatch.state,
        ...collectState(),
      });
      return {
        ...currentMatch,
        updatedAt: nowIso(),
        state: nextState,
      };
    });

    setFeedback('Aggiornato in Firebase ✔');
    await refreshAdmin();
  } catch (error) {
    setFeedback(error.message || 'Errore aggiornamento', true);
  }
}

async function createNewMatch() {
  try {
    await createMatch(newMatchName.value || 'Nuova partita');
    newMatchName.value = '';
    setFeedback('Nuova partita creata ✔');
    await refreshAdmin();
  } catch (error) {
    setFeedback(error.message || 'Errore creazione partita', true);
  }
}

async function resetCurrentMatch() {
  if (!currentMatchId) {
    setFeedback('Nessuna partita selezionata', true);
    return;
  }

  try {
    await resetMatch(currentMatchId);
    setFeedback('Reset eseguito ✔');
    await refreshAdmin();
  } catch (error) {
    setFeedback(error.message || 'Errore reset', true);
  }
}

async function saveSettingsOnly() {
  if (!currentMatchId) {
    return;
  }

  try {
    await updateMatch(currentMatchId, (currentMatch) => ({
      ...currentMatch,
      updatedAt: nowIso(),
      state: sanitizeState({
        ...currentMatch.state,
        settings: getSettingsFromForm(),
      }),
    }));
    await refreshAdmin();
  } catch (error) {
    console.error(error);
  }
}

async function advanceBatter(result = null) {
  if (!currentMatchId) {
    return;
  }

  try {
    await updateMatch(currentMatchId, (currentMatch) => {
      const baseState = sanitizeState({
        ...currentMatch.state,
        ...collectState(),
      });
      const side = baseState.battingSide;
      const nextState = result ? applyPlateAppearance(baseState, side, result) : withAdvancedBatter(baseState, side);
      return {
        ...currentMatch,
        updatedAt: nowIso(),
        state: sanitizeState(nextState),
      };
    });

    await refreshAdmin();
    setFeedback(result ? `Azione registrata: ${result}` : 'Battitore avanzato ✔');
  } catch (error) {
    setFeedback(error.message || 'Errore azione battitore', true);
  }
}

saveBtn.addEventListener('click', pushUpdate);
resetBtn.addEventListener('click', resetCurrentMatch);
createMatchBtn.addEventListener('click', createNewMatch);
changePinBtn.addEventListener('click', promptRole);
plusBallBtn.addEventListener('click', () => quickAdjust(refs.balls, 1, 0, 3));
plusStrikeBtn.addEventListener('click', () => quickAdjust(refs.strikes, 1, 0, 2));
plusOutBtn.addEventListener('click', () => quickAdjust(refs.outs, 1, 0, 2));
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

nextBatterBtn.addEventListener('click', () => advanceBatter());
singleBtn.addEventListener('click', () => advanceBatter('single'));
doubleBtn.addEventListener('click', () => advanceBatter('double'));
tripleBtn.addEventListener('click', () => advanceBatter('triple'));
homeRunBtn.addEventListener('click', () => advanceBatter('homeRun'));
walkBtn.addEventListener('click', () => advanceBatter('walk'));
outBtn.addEventListener('click', () => advanceBatter('out'));

autoAdvanceBattersInput.addEventListener('change', saveSettingsOnly);
autoSortRosterInput.addEventListener('change', saveSettingsOnly);
showBatterStripInput.addEventListener('change', saveSettingsOnly);
compactOverlayInput.addEventListener('change', saveSettingsOnly);

matchSelect.addEventListener('change', async () => {
  currentMatchId = matchSelect.value;
  await updateActiveMatch(currentMatchId);
  await refreshAdmin();
});

currentBatterAwayInput.addEventListener('change', scheduleAutoSave);
currentBatterHomeInput.addEventListener('change', scheduleAutoSave);
battingSideInput.addEventListener('change', scheduleAutoSave);

document.addEventListener('input', (event) => {
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
    return;
  }

  if (event.target.id === 'newMatchName') {
    return;
  }

  scheduleAutoSave();
});

createInningInputs();
createRosterInputs();
promptRole();
refreshAdmin();
setInterval(refreshAdmin, POLL_INTERVAL_MS);
