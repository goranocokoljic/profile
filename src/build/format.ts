// Formatters and small numeric helpers, ported function-for-function from
// design-reference/dashboard/index.html. Pure: no DOM, safe to unit-test.

export const fmtInt = (n: number): string => n.toLocaleString('en-US');

export function fmtUsd(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1000) return '$' + Math.round(v).toLocaleString('en-US');
  if (v >= 100) return '$' + v.toFixed(0);
  return '$' + v.toFixed(2);
}

export function fmtDur(sec: number | null | undefined): string {
  if (sec == null || isNaN(sec)) return '—';
  if (sec < 60) return Math.round(sec) + 's';
  const m = sec / 60;
  if (m < 60) return Math.round(m) + 'm';
  const h = Math.floor(sec / 3600);
  const rm = Math.round((sec - h * 3600) / 60);
  return h + 'h ' + (rm > 0 ? rm + 'm' : '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDay(d: Date): string {
  return MONTHS[d.getMonth()] + ' ' + d.getDate();
}

export function fmtDateTime(d: Date): string {
  return fmtDay(d) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function fmtCtx(tokens: number | null | undefined): string {
  if (tokens == null) return '—';
  return Math.round(tokens / 1000) + 'k';
}

export function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function dayKey(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  let step = mag;
  for (const m of [1, 2, 5, 10]) {
    if (rough <= m * mag) {
      step = m * mag;
      break;
    }
  }
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** White or dark ink by fill luminance, for labels set inside a coloured fill. */
export function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 150 ? '#0b0b0b' : '#ffffff';
}

export function shortModel(m: string | null | undefined): string {
  return m ? m.replace(/^claude-/, '') : '—';
}
