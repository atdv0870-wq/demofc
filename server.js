import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { candles, price, TF_MS } from './lib/feed.js';
import { evaluate } from './lib/confluence.js';
import { record, sweep, report } from './lib/tracker.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const COOLDOWN = Number(process.env.COOLDOWN_MS || 45_000);

app.use(express.static(path.join(import.meta.dirname, 'public')));
app.use('/api', rateLimit({ windowMs: 60_000, max: 300 }));

const cooldowns = new Map();

app.get('/api/state', async (req, res) => {
  const symbol = (req.query.symbol || process.env.DEFAULT_SYMBOL || 'BTCUSDT').toUpperCase();
  const tf = TF_MS[req.query.tf] ? req.query.tf : '5m';

  try {
    const rows = await candles(symbol, tf);
    const ev = evaluate(rows);
    const last = rows.at(-1);

    const key = `${symbol}:${tf}`;
    let signalId = null;
    if (ev.fires && Date.now() > (cooldowns.get(key) || 0)) {
      signalId = record(symbol, tf, ev, last.close, TF_MS[tf]);
      cooldowns.set(key, Date.now() + COOLDOWN);
    }

    res.json({
      symbol, tf, price: last.close, change: +((last.close / rows.at(-2).close - 1) * 100).toFixed(3),
      atr: +(last.high - last.low).toFixed(2),
      signalId, ...ev,
      cooldownLeft: Math.max(0, (cooldowns.get(key) || 0) - Date.now())
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/candles', async (req, res) => {
  const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
  const tf = TF_MS[req.query.tf] ? req.query.tf : '5m';
  try {
    const rows = await candles(symbol, tf, 180);
    res.json(rows.map((r) => ({ time: Math.floor(r.time / 1000), open: r.open, high: r.high, low: r.low, close: r.close })));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/stats', (_req, res) => res.json(report()));
app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

setInterval(() => sweep().catch(() => {}), 5000);

app.listen(PORT, () => console.log(`BADSHAH on http://localhost:${PORT}`));