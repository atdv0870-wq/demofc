const BASE = 'https://api.binance.com/api/v3';

export const TF_MS = {
  '1m': 60_000, '3m': 180_000, '5m': 300_000,
  '15m': 900_000, '30m': 1_800_000, '1h': 3_600_000
};

const cache = new Map();
const TTL = 1200;

async function get(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

export async function candles(symbol, tf, limit = 220) {
  const raw = await get(`${BASE}/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`);
  return raw.map((k) => ({
    open: +k[1], high: +k[2], low: +k[3], close: +k[4],
    volume: +k[5], time: k[0]
  }));
}

export async function price(symbol) {
  const d = await get(`${BASE}/ticker/price?symbol=${symbol}`);
  return +d.price;
}

export function atrOf(rows, period = 14) {
  const slice = rows.slice(-period);
  let sum = 0;
  for (let i = 0; i < slice.length; i++) {
    const r = slice[i], prev = slice[i - 1] || r;
    sum += Math.max(r.high - r.low, Math.abs(r.high - prev.close), Math.abs(r.low - prev.close));
  }
  return sum / slice.length;
}