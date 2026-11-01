import { ENGINES } from './engines.js';
import { atrOf } from './feed.js';
import { percentile } from './indicators.js';

export const THRESHOLD = Number(process.env.THRESHOLD || 62);

export function evaluate(rows) {
  const ctx = {
    rows,
    closes: rows.map((r) => r.close),
    highs: rows.map((r) => r.high),
    lows: rows.map((r) => r.low),
    volumes: rows.map((r) => r.volume),
    price: rows.at(-1).close
  };

  const atrs = [];
  for (let i = 30; i < rows.length; i++) atrs.push(atrOf(rows.slice(i - 20, i)));
  const volPct = percentile(atrs, atrOf(rows));

  const results = ENGINES.map((e) => {
    const r = e.run(ctx);
    let weight = e.weight;
    if (e.group === 'trend' && volPct < 25) weight *= 0.6;
    return { id: e.id, name: e.name, dir: r.dir, reason: r.reason, strength: r.strength, weight };
  });

  const callVotes = results.filter((r) => r.dir === 1).reduce((a, r) => a + r.weight * r.strength, 0);
  const putVotes = results.filter((r) => r.dir === -1).reduce((a, r) => a + r.weight * r.strength, 0);
  const maxPossible = ENGINES.reduce((a, e) => a + e.weight, 0);

  const total = callVotes + putVotes;
  const dominant = callVotes >= putVotes ? 1 : -1;
  const dominantVotes = Math.max(callVotes, putVotes);

  let score = (dominantVotes / maxPossible) * 100;
  score += (dominantVotes - Math.min(callVotes, putVotes)) / maxPossible * 55;
  if (volPct < 15) score *= 0.82;
  if (volPct > 80) score *= 0.94;
  score = Math.max(0, Math.min(99, Math.round(score)));

  const agree = results.filter((r) => r.dir === dominant).length;
  const grade = score >= 82 && agree >= 5 ? 'A' : score >= 70 && agree >= 4 ? 'B' : score >= THRESHOLD ? 'C' : '-';

  return {
    dir: dominant === 1 ? 'CALL' : 'PUT',
    score,
    grade,
    agree,
    conflict: results.filter((r) => r.dir === -dominant && r.strength > 0.6).length,
    volatility: volPct,
    fires: score >= THRESHOLD && grade !== '-' && total > 0,
    engines: results
  };
}