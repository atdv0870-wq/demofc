import { ema, rsi, macd, bollinger, adx, stoch } from './indicators.js';

/* Each engine: { id, name, weight, group, run(ctx) -> {dir, reason, strength} } */

export const ENGINES = [
  {
    id: 'trend_align', name: 'EMA stack alignment', weight: 18, group: 'trend',
    run(c) {
      const e9 = ema(c.closes, 9), e21 = ema(c.closes, 21), e50 = ema(c.closes, 50);
      const up = e9 > e21 && e21 > e50 && c.price > e21;
      const down = e9 < e21 && e21 < e50 && c.price < e21;
      if (up) return { dir: 1, reason: 'EMA 9>21>50 stacked long', strength: 0.9 };
      if (down) return { dir: -1, reason: 'EMA 9<21<50 stacked short', strength: 0.9 };
      return { dir: 0, reason: 'EMA stack flat', strength: 0.2 };
    }
  },
  {
    id: 'macd_mom', name: 'MACD momentum', weight: 14, group: 'momentum',
    run(c) {
      const m = macd(c.closes);
      const slope = m.hist - macd(c.closes.slice(0, -1)).hist;
      if (m.hist > 0 && slope > 0) return { dir: 1, reason: 'MACD histogram expanding up', strength: 0.8 };
      if (m.hist < 0 && slope < 0) return { dir: -1, reason: 'MACD histogram expanding down', strength: 0.8 };
      return { dir: 0, reason: 'MACD compressing', strength: 0.25 };
    }
  },
  {
    id: 'rsi_revert', name: 'RSI exhaustion', weight: 11, group: 'reversion',
    run(c) {
      const r = rsi(c.closes);
      if (r < 27) return { dir: 1, reason: `RSI ${r.toFixed(1)} oversold`, strength: 0.85 };
      if (r > 73) return { dir: -1, reason: `RSI ${r.toFixed(1)} overbought`, strength: 0.85 };
      return { dir: 0, reason: `RSI ${r.toFixed(1)} neutral`, strength: 0.2 };
    }
  },
  {
    id: 'bb_break', name: 'Bollinger break', weight: 13, group: 'volatility',
    run(c) {
      const b = bollinger(c.closes);
      if (c.price > b.upper) return { dir: -1, reason: 'Price above upper band (snap-back)', strength: 0.7 };
      if (c.price < b.lower) return { dir: 1, reason: 'Price below lower band (snap-back)', strength: 0.7 };
      return { dir: 0, reason: 'Inside bands', strength: 0.2 };
    }
  },
  {
    id: 'stoch_cross', name: 'Stochastic turn', weight: 10, group: 'reversion',
    run(c) {
      const s = stoch(c.rows), prev = stoch(c.rows.slice(0, -1));
      if (prev < 20 && s > prev) return { dir: 1, reason: 'Stoch turning up from oversold', strength: 0.75 };
      if (prev > 80 && s < prev) return { dir: -1, reason: 'Stoch turning down from overbought', strength: 0.75 };
      return { dir: 0, reason: 'Stoch mid-range', strength: 0.15 };
    }
  },
  {
    id: 'regime', name: 'ADX regime filter', weight: 12, group: 'filter',
    run(c) {
      const a = adx(c.rows);
      if (a > 32) return { dir: c.closes.at(-1) > ema(c.closes, 21) ? 1 : -1, reason: `ADX ${a.toFixed(0)} strong trend`, strength: 0.85 };
      if (a < 17) return { dir: 0, reason: `ADX ${a.toFixed(0)} chop — stand down`, strength: 0.1 };
      return { dir: 0, reason: `ADX ${a.toFixed(0)} mild`, strength: 0.35 };
    }
  },
  {
    id: 'pattern', name: 'Candle structure', weight: 12, group: 'structure',
    run(c) {
      const [a, b] = c.rows.slice(-2);
      const body = Math.abs(b.close - b.open);
      const range = b.high - b.low || 1;
      const bull = b.close > b.open, prevBear = a.close < a.open;
      if (prevBear && bull && b.close > a.open && b.close > a.close)
        return { dir: 1, reason: 'Bullish engulfing', strength: 0.8 };
      if (!prevBear && !bull && b.close < a.open && b.close < a.close)
        return { dir: -1, reason: 'Bearish engulfing', strength: 0.8 };
      const lowerWick = Math.min(b.open, b.close) - b.low;
      const upperWick = b.high - Math.max(b.open, b.close);
      if (lowerWick > body * 2 && lowerWick / range > 0.55)
        return { dir: 1, reason: 'Long lower wick rejection', strength: 0.7 };
      if (upperWick > body * 2 && upperWick / range > 0.55)
        return { dir: -1, reason: 'Long upper wick rejection', strength: 0.7 };
      return { dir: 0, reason: 'No pattern', strength: 0.1 };
    }
  },
  {
    id: 'volume', name: 'Volume expansion', weight: 9, group: 'flow',
    run(c) {
      const avg = c.volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;
      const last = c.volumes.at(-1);
      if (last > avg * 1.9) {
        const dir = c.closes.at(-1) > c.rows.at(-1).open ? 1 : -1;
        return { dir, reason: `Volume ${(last / avg).toFixed(1)}x avg`, strength: 0.75 };
      }
      return { dir: 0, reason: 'Volume normal', strength: 0.15 };
    }
  },
  {
    id: 'structure', name: 'Swing proximity', weight: 11, group: 'structure',
    run(c) {
      const hi = Math.max(...c.highs.slice(-40));
      const lo = Math.min(...c.lows.slice(-40));
      const nearHi = (hi - c.price) / c.price < 0.0012;
      const nearLo = (c.price - lo) / c.price < 0.0012;
      if (nearHi) return { dir: -1, reason: 'At 40-bar resistance', strength: 0.6 };
      if (nearLo) return { dir: 1, reason: 'At 40-bar support', strength: 0.6 };
      return { dir: 0, reason: 'Mid-range', strength: 0.1 };
    }
  }
];