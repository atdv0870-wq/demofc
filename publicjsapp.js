const $ = (s) => document.querySelector(s);
const chartEl = $('#chart');
const chart = LightweightCharts.createChart(chartEl, {
  layout: { background: { color: '#101018' }, textColor: '#8f8ba3' },
  grid: { vertLines: { color: '#1c1c2a' }, horzLines: { color: '#1c1c2a' } },
  rightPriceScale: { borderColor: '#26263a' },
  timeScale: { borderColor: '#26263a', timeVisible: true }
});
const series = chart.addCandlestickSeries({
  upColor: '#22c55e', downColor: '#ef4444', borderVisible: false,
  wickUpColor: '#22c55e', wickDownColor: '#ef4444'
});
new ResizeObserver(() => chart.applyOptions({
  width: chartEl.clientWidth, height: chartEl.clientHeight
})).observe(chartEl);

const params = () => ({ symbol: $('#symbol').value, tf: $('#tf').value });
let loading = false;

async function drawChart() {
  const q = new URLSearchParams(params());
  const res = await fetch(`/api/candles?${q}`);
  if (!res.ok) return;
  series.setData(await res.json());
  chart.timeScale().fitContent();
}

function paint(ev, data) {
  const dir = $('#dir');
  dir.textContent = ev.fires ? ev.dir : 'WAIT';
  dir.className = `signal__dir ${ev.fires ? ev.dir.toLowerCase() : ''}`;
  $('#confFill').style.width = `${ev.score}%`;
  $('#score').textContent = ev.score;
  $('#grade').textContent = ev.grade;
  $('#agree').textContent = ev.agree;
  $('#vol').textContent = ev.volatility.toFixed(0);
  $('#hint').textContent = ev.fires
    ? `${ev.dir} setup · ${ev.conflict} conflicting engine(s) · ${ev.grade} grade`
    : ev.score >= 40 ? 'Confluence building — below threshold' : 'No edge, standing down';
  $('#px').textContent = data.price;
  $('#chg').textContent = `${data.change > 0 ? '+' : ''}${data.change}%`;
  $('#chg').style.color = data.change >= 0 ? 'var(--up)' : 'var(--dn)';
  $('#cool').textContent = `${Math.ceil(data.cooldownLeft / 1000)}s`;

  $('#engineRows').innerHTML = ev.engines.map((e) => `
    <tr>
      <td>${e.name}</td>
      <td class="${e.dir === 1 ? 'bias-up' : e.dir === -1 ? 'bias-dn' : 'bias-flat'}">
        ${e.dir === 1 ? '? CALL' : e.dir === -1 ? '? PUT' : '—'}</td>
      <td>${e.reason}</td>
    </tr>`).join('');

  if (ev.fires) {
    series.setMarkers([{
      time: Math.floor(Date.now() / 1000), position: ev.dir === 'CALL' ? 'belowBar' : 'aboveBar',
      color: ev.dir === 'CALL' ? '#22c55e' : '#ef4444',
      shape: ev.dir === 'CALL' ? 'arrowUp' : 'arrowDown', text: `${ev.dir} ${ev.score}`
    }]);
    beep();
  }
}

async function tick() {
  if (loading) return;
  loading = true;
  try {
    const q = new URLSearchParams(params());
    const res = await fetch(`/api/state?${q}`);
    if (res.ok) paint(await res.json(), await res.json().catch(() => null) || {});
  } catch {}
  loading = false;
}

async function refreshState() {
  if (loading) return;
  loading = true;
  try {
    const res = await fetch(`/api/state?${new URLSearchParams(params())}`);
    if (res.ok) {
      const data = await res.json();
      paint(data, data);
    }
  } catch {}
  loading = false;
}

async function loadStats() {
  const res = await fetch('/api/stats');
  if (!res.ok) return;
  const s = await res.json();
  $('#acc').textContent = `${s.accuracy}%`;
  $('#total').textContent = s.total;
  $('#gradeRows').innerHTML = s.byGrade.map((g) => `
    <div class="gradecard"><b>${g.grade}</b><span>${g.accuracy}% of ${g.total}</span></div>`).join('')
    || '<p class="disclaimer">No resolved signals yet.</p>';
  $('#logRows').innerHTML = s.recent.map((r) => `
    <tr>
      <td>${new Date(r.created).toLocaleTimeString()}</td>
      <td>${r.symbol}</td>
      <td class="${r.dir === 'CALL' ? 'bias-up' : 'bias-dn'}">${r.dir}</td>
      <td>${r.score}</td><td>${r.entry}</td>
      <td>${r.exit ?? '—'}</td>
      <td class="res-${r.outcome || 'pending'}">${r.outcome ?? 'pending'}</td>
    </tr>`).join('');
}

let audioCtx;
function beep() {
  audioCtx ??= new AudioContext();
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
  g.gain.setValueAtTime(0.05, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
  o.start(); o.stop(audioCtx.currentTime + 0.18);
}

$('#symbol').onchange = () => { drawChart(); refreshState(); };
$('#tf').onchange = () => { drawChart(); refreshState(); };

drawChart();
refreshState();
loadStats();
setInterval(refreshState, 2500);
setInterval(loadStats, 6000);