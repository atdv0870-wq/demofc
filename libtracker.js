import { insertSignal, pendingBefore, resolveSignal, recentSignals, stats, statsByGrade } from './db.js';
import { price } from './feed.js';

export function record(symbol, tf, ev, entry, expiryMs) {
  const mult = ev.grade === 'A' ? 1 : ev.grade === 'B' ? 2 : 3;
  const info = insertSignal.run({
    symbol, tf, dir: ev.dir, score: ev.score, grade: ev.grade,
    reasons: JSON.stringify(ev.engines.filter((e) => e.dir !== 0).map((e) => e.reason)),
    entry, expiry: Date.now() + expiryMs * mult, created: Date.now()
  });
  return info.lastInsertRowid;
}

export async function sweep() {
  const due = pendingBefore.all(Date.now());
  for (const s of due) {
    try {
      const now = await price(s.symbol);
      const outcome = Math.abs(now - s.entry) < s.entry * 0.00002
        ? 'push'
        : (s.dir === 'CALL' ? now > s.entry : now < s.entry) ? 'win' : 'loss';
      resolveSignal.run({ id: s.id, exit: now, outcome });
    } catch { /* leave pending, retry next sweep */ }
  }
}

export function report() {
  const s = stats.get() || {};
  const total = s.total || 0;
  const wins = s.wins || 0;
  return {
    total, wins, losses: s.losses || 0, pushes: s.pushes || 0,
    accuracy: total ? +(wins / total * 100).toFixed(1) : 0,
    byGrade: statsByGrade.all().map((g) => ({
      grade: g.grade, total: g.total,
      accuracy: g.total ? +(g.wins / g.total * 100).toFixed(1) : 0
    })),
    recent: recentSignals.all(25).map((r) => ({ ...r, reasons: JSON.parse(r.reasons || '[]') }))
  };
}