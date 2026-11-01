export const sma = (v, p) => v.slice(-p).reduce((a, b) => a + b, 0) / p;

export function ema(v, p) {
  const k = 2 / (p + 1);
  let out = v[0];
  for (let i = 1; i < v.length; i++) out = v[i] * k + out * (1 - k);
  return out;
}

export function rsi(v, p = 14) {
  let gain = 0, loss = 0;
  for (let i = v.length - p; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  if (!loss) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export function macd(v, fast = 12, slow = 26, sig = 9) {
  const line = ema(v, fast) - ema(v, slow);
  const signal = ema(v.slice(-sig * 2), sig);
  return { line, signal, hist: line - signal };
}

export function bollinger(v, p = 20, mult = 2) {
  const mean = sma(v, p);
  const sd = Math.sqrt(v.slice(-p).reduce((a, x) => a + (x - mean) ** 2, 0) / p);
  return { upper: mean + sd * mult, mid: mean, lower: mean - sd * mult, width: (sd * mult * 2) / mean };
}

export function adx(rows, p = 14) {
  const slice = rows.slice(-p - 1);
  let plus = 0, minus = 0, tr = 0;
  for (let i = 1; i < slice.length; i++) {
    const up = slice[i].high - slice[i - 1].high;
    const dn = slice[i - 1].low - slice[i].low;
    if (up > dn && up > 0) plus += up;
    if (dn > up && dn > 0) minus += dn;
    tr += Math.max(slice[i].high - slice[i].low,
      Math.abs(slice[i].high - slice[i - 1].close),
      Math.abs(slice[i].low - slice[i - 1].close));
  }
  if (!tr) return 0;
  const pdi = (plus / tr) * 100, mdi = (minus / tr) * 100;
  const dx = Math.abs(pdi - mdi) / (pdi + mdi || 1) * 100;
  return dx;
}

export function stoch(rows, p = 14) {
  const slice = rows.slice(-p);
  const hi = Math.max(...slice.map((r) => r.high));
  const lo = Math.min(...slice.map((r) => r.low));
  const c = slice.at(-1).close;
  return hi === lo ? 50 : ((c - lo) / (hi - lo)) * 100;
}

export const percentile = (arr, val) => {
  const below = arr.filter((x) => x < val).length;
  return (below / arr.length) * 100;
};