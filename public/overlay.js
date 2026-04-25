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
const stateCache = { lastJson: '' };

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
    return '0-0';
  }
  return `${player.h}-${player.ab} | 2B ${player.doubles} 3B ${player.triples} HR ${player.hr} BB ${player.bb} SO ${player.so} AVG ${avgText(player)}`;
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
  batterStrip.style.display = settings.showBatterStrip === false ? 'none' : '';
}

function renderState(root) {
  const { match } = getMatchData(root);
  if (!match?.state) {
    return;
  }

  const state = match.state;
  applySettings(state);

  els.homeTeam.textContent = state.homeTeam;
  els.awayTeam.textContent = state.awayTeam;
  els.gameStatus.textContent = state.gameStatus;
  els.matchName.textContent = match.name || 'PARTITA';
  els.inningState.textContent = `${state.half === 'top' ? 'TOP' : 'BOT'} ${state.inning}`;

  els.homeRuns.textContent = state.homeRuns;
  els.awayRuns.textContent = state.awayRuns;
  els.homeHits.textContent = state.homeHits;
  els.awayHits.textContent = state.awayHits;
  els.homeErrors.textContent = state.homeErrors;
  els.awayErrors.textContent = state.awayErrors;
  els.balls.textContent = state.balls;
  els.strikes.textContent = state.strikes;
  els.outs.textContent = state.outs;

  for (let i = 0; i < 9; i += 1) {
    document.getElementById(`homeI${i + 1}`).textContent = state.inningScores.home[i] ?? 0;
    document.getElementById(`awayI${i + 1}`).textContent = state.inningScores.away[i] ?? 0;
  }

  const awayBatter = findPlayerById(state.players?.away, state.currentBatterAwayId);
  const homeBatter = findPlayerById(state.players?.home, state.currentBatterHomeId);

  els.awayBatterName.textContent = awayBatter?.name || '-';
  els.homeBatterName.textContent = homeBatter?.name || '-';
  els.awayBatterLine.textContent = battingLine(awayBatter);
  els.homeBatterLine.textContent = battingLine(homeBatter);

  document.getElementById('awayBatterCard').style.outline = state.battingSide === 'away' ? '2px solid rgba(46, 242, 198, 0.8)' : 'none';
  document.getElementById('homeBatterCard').style.outline = state.battingSide === 'home' ? '2px solid rgba(46, 242, 198, 0.8)' : 'none';

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
