const params = new URLSearchParams(window.location.search);
const queryMatchId = params.get('matchId') || '';

const ids = [
  'homeTeam', 'awayTeam', 'gameStatus', 'inningState', 'matchName',
  'homeRuns', 'awayRuns', 'homeHits', 'awayHits', 'homeErrors', 'awayErrors',
  'balls', 'strikes', 'outs',
  'awayBatterName', 'homeBatterName', 'awayBatterLine', 'homeBatterLine',
];

const els = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const overlayRoot = document.getElementById('overlayRoot');
const batterStrip = document.querySelector('.batter-strip');
const ballsBox = document.getElementById('ballsBox');
const strikesBox = document.getElementById('strikesBox');
const outsBox = document.getElementById('outsBox');
const baseFirst = document.getElementById('baseFirst');
const baseSecond = document.getElementById('baseSecond');
const baseThird = document.getElementById('baseThird');
const stateCache = { lastJson: '', prevState: null, prevMatchName: '' };

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function pulseElement(element, pulseClass = 'pulse-change') {
  if (!element) {
    return;
  }
  element.classList.remove(pulseClass);
  void element.offsetWidth;
  element.classList.add(pulseClass);
}

function updateTextWithPulse(element, nextValue, previousValue) {
  if (!element) {
    return;
  }
  const nextText = String(nextValue ?? '');
  if (element.textContent !== nextText) {
    element.textContent = nextText;
  }
  if (previousValue !== undefined && String(previousValue ?? '') !== nextText) {
    pulseElement(element);
  }
}

function applyCountLevel(box, level, maxLevel) {
  if (!box) {
    return;
  }
  for (let i = 0; i <= maxLevel; i += 1) {
    box.classList.remove(`level-${i}`);
  }
  const normalized = Math.max(0, Math.min(Number(level || 0), maxLevel));
  box.classList.add(`level-${normalized}`);
}

function avgText(player) {
  const ab = Number(player?.ab || 0);
  const h = Number(player?.h || 0);
  if (ab <= 0) {
    return '.000';
  }
  return (h / ab).toFixed(3).replace('0.', '.');
}

function battingLine(player) {
  if (!player) {
    return 'AB 0  H 0  RBI 0  BB 0  SO 0  AVG .000';
  }
  return `AB ${player.ab}  H ${player.h}  RBI ${player.rbi}  BB ${player.bb}  SO ${player.so}  AVG ${avgText(player)}`;
}

function findPlayerById(players, playerId) {
  return (players || []).find((p) => p.id === playerId);
}

function getMatchData(root) {
  const activeMatchId = queryMatchId || root.activeMatchId || Object.keys(root.matches || {})[0] || '';
  const match = root.matches?.[activeMatchId] || null;
  return { activeMatchId, match };
}

function applySettings(state) {
  const settings = state?.settings || {};
  overlayRoot.classList.toggle('overlay-compact', Boolean(settings.compactOverlay));
  overlayRoot.classList.toggle('overlay-outs-only', settings.showBallsStrikes === false);
  batterStrip.style.display = settings.showBatterStrip === false ? 'none' : '';
}

function toggleBase(baseEl, occupied, previousOccupied) {
  if (!baseEl) {
    return;
  }
  baseEl.classList.toggle('occupied', Boolean(occupied));
  if (previousOccupied !== undefined && Boolean(previousOccupied) !== Boolean(occupied)) {
    pulseElement(baseEl, 'pulse-base');
  }
}

function renderState(root) {
  const { match } = getMatchData(root);
  if (!match?.state) {
    return;
  }

  const state = match.state;
  const prev = stateCache.prevState;
  applySettings(state);

  updateTextWithPulse(els.homeTeam, state.homeTeam, prev?.homeTeam);
  updateTextWithPulse(els.awayTeam, state.awayTeam, prev?.awayTeam);
  updateTextWithPulse(els.gameStatus, state.gameStatus, prev?.gameStatus);
  updateTextWithPulse(els.matchName, match.name || 'PARTITA', stateCache.prevMatchName || undefined);
  updateTextWithPulse(
    els.inningState,
    `${state.half === 'top' ? 'TOP' : 'BOT'} ${state.inning}`,
    prev ? `${prev.half === 'top' ? 'TOP' : 'BOT'} ${prev.inning}` : undefined,
  );

  updateTextWithPulse(els.homeRuns, state.homeRuns, prev?.homeRuns);
  updateTextWithPulse(els.awayRuns, state.awayRuns, prev?.awayRuns);
  updateTextWithPulse(els.homeHits, state.homeHits, prev?.homeHits);
  updateTextWithPulse(els.awayHits, state.awayHits, prev?.awayHits);
  updateTextWithPulse(els.homeErrors, state.homeErrors, prev?.homeErrors);
  updateTextWithPulse(els.awayErrors, state.awayErrors, prev?.awayErrors);
  updateTextWithPulse(els.balls, state.balls, prev?.balls);
  updateTextWithPulse(els.strikes, state.strikes, prev?.strikes);
  updateTextWithPulse(els.outs, state.outs, prev?.outs);

  applyCountLevel(ballsBox, state.balls, 3);
  applyCountLevel(strikesBox, state.strikes, 2);
  applyCountLevel(outsBox, state.outs, 2);

  if (prev && prev.balls !== state.balls) {
    pulseElement(ballsBox, 'pulse-box');
  }
  if (prev && prev.strikes !== state.strikes) {
    pulseElement(strikesBox, 'pulse-box');
  }
  if (prev && prev.outs !== state.outs) {
    pulseElement(outsBox, 'pulse-box');
  }

  toggleBase(baseFirst, state.baseRunners?.first, prev?.baseRunners?.first);
  toggleBase(baseSecond, state.baseRunners?.second, prev?.baseRunners?.second);
  toggleBase(baseThird, state.baseRunners?.third, prev?.baseRunners?.third);

  for (let i = 0; i < 9; i += 1) {
    const homeCell = document.getElementById(`homeI${i + 1}`);
    const awayCell = document.getElementById(`awayI${i + 1}`);
    const nextHome = state.inningScores.home[i] ?? 0;
    const nextAway = state.inningScores.away[i] ?? 0;
    const prevHome = prev?.inningScores?.home?.[i];
    const prevAway = prev?.inningScores?.away?.[i];
    updateTextWithPulse(homeCell, nextHome, prevHome);
    updateTextWithPulse(awayCell, nextAway, prevAway);
  }

  const awayBatter = findPlayerById(state.players?.away, state.currentBatterAwayId);
  const homeBatter = findPlayerById(state.players?.home, state.currentBatterHomeId);
  const prevAwayBatter = findPlayerById(prev?.players?.away, prev?.currentBatterAwayId);
  const prevHomeBatter = findPlayerById(prev?.players?.home, prev?.currentBatterHomeId);

  updateTextWithPulse(els.awayBatterName, awayBatter?.name || '-', prevAwayBatter?.name);
  updateTextWithPulse(els.homeBatterName, homeBatter?.name || '-', prevHomeBatter?.name);
  updateTextWithPulse(els.awayBatterLine, battingLine(awayBatter), battingLine(prevAwayBatter));
  updateTextWithPulse(els.homeBatterLine, battingLine(homeBatter), battingLine(prevHomeBatter));

  document.getElementById('awayBatterCard').style.outline = state.battingSide === 'away' ? '2px solid rgba(46, 242, 198, 0.8)' : 'none';
  document.getElementById('homeBatterCard').style.outline = state.battingSide === 'home' ? '2px solid rgba(46, 242, 198, 0.8)' : 'none';

  stateCache.prevState = cloneState(state);
  stateCache.prevMatchName = match.name || 'PARTITA';
  stateCache.lastJson = JSON.stringify(root);
}

async function refreshOverlay() {
  try {
    const root = await loadRoot();
    const json = JSON.stringify(root);
    if (json === stateCache.lastJson) {
      return;
    }
    renderState(root);
  } catch (error) {
    console.error('Overlay refresh failed', error);
  }
}

refreshOverlay();
setInterval(refreshOverlay, POLL_INTERVAL_MS);
