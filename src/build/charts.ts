// Chart cards, ported from the reference script: billed cost per day,
// cycle-1 findings trend, phase medians with the est-cost share bar, and
// findings by severity. Every card has a table twin behind its toggle.

import { h, s, roundedRightRect, roundedTopRect, type TipRow, type Tooltip } from './dom';
import { fmtDay, fmtDur, fmtInt, fmtUsd, inkFor, niceTicks } from './format';
import {
  costByDay,
  cycleOneTrend,
  phaseStats,
  severityByDay,
  SEVERITIES,
  TREND_WINDOW,
  type CostDay,
  type SevDay,
  type TaskRow,
  type TrendPoint,
} from './stats';
import type { PhaseName } from './types';

export interface View {
  /** Resolved value of a dashboard colour variable on the dashboard root. */
  cssVar(name: string): string;
  tip: Tooltip;
  /** Chart card ids currently showing their table twin. */
  tableMode: Set<string>;
  rerender(): void;
}

export const PHASE_VAR: Record<PhaseName, string> = {
  read: '--series-1',
  branch: '--series-2',
  implement: '--series-3',
  'build+test': '--series-4',
  pr: '--series-5',
  review: '--series-6',
  merge: '--series-7',
};

const SEV_VAR: Record<string, string> = {
  critical: '--sev-critical',
  high: '--sev-high',
  medium: '--sev-medium',
  low: '--sev-low',
  style: '--sev-style',
};

type Cell = Node | string;

export interface Col {
  label: string;
  num?: boolean;
}

interface LegendItem {
  label: string;
  color: string;
  type?: 'line';
}

interface CardConfig {
  id: string;
  title: string;
  legend?: LegendItem[];
  note?: string;
  table: { cols: Col[]; rows: Cell[][] };
  renderChart(el: HTMLElement): void;
}

const EMPTY_RANGE = 'No data in this range.';

/* --------------------------------------------------------- generic card */
export function renderCard(cardEl: HTMLElement, cfg: CardConfig, view: View): void {
  cardEl.textContent = '';
  const showTable = view.tableMode.has(cfg.id);
  cardEl.append(
    h(
      'div',
      { class: 'card-head' },
      h('h2', null, cfg.title),
      h('span', { class: 'spacer' }),
      h(
        'button',
        {
          type: 'button',
          class: 'tbl-toggle',
          'data-fk': `tbl-${cfg.id}`,
          onclick: () => {
            if (showTable) view.tableMode.delete(cfg.id);
            else view.tableMode.add(cfg.id);
            view.rerender();
          },
        },
        showTable ? 'chart' : 'table',
      ),
    ),
  );
  if (cfg.legend && cfg.legend.length > 1 && !showTable) {
    const lg = h('div', { class: 'legend' });
    for (const item of cfg.legend) {
      const sw = h('span', { class: item.type === 'line' ? 'ln' : 'sw' });
      sw.style.background = item.color;
      lg.append(h('span', { class: 'item' }, sw, item.label));
    }
    cardEl.append(lg);
  }
  const body = h('div', { class: 'chart-body' });
  cardEl.append(body);
  if (showTable) body.append(dataTable(cfg.table.cols, cfg.table.rows));
  else cfg.renderChart(body);
  if (cfg.note) cardEl.append(h('div', { class: 'footnote' }, cfg.note));
}

export function dataTable(cols: Col[], rows: Cell[][]): HTMLElement {
  if (!rows.length) return h('div', { class: 'empty' }, EMPTY_RANGE);
  const cls = (c: Col) => (c.num ? 'num' : undefined);
  const thead = h('thead', null, h('tr', null, cols.map((c) => h('th', { class: cls(c) }, c.label))));
  const tbody = h(
    'tbody',
    null,
    rows.map((r) => h('tr', null, r.map((cell, i) => h('td', { class: cls(cols[i]) }, cell)))),
  );
  // Wide tables scroll inside their card rather than widening the page at 390px.
  // The table holds nothing focusable, so the scroller itself takes focus:
  // keyboard users can then scroll it with the arrow keys.
  return h('div', { class: 'scroll-x', tabindex: '0' }, h('table', { class: 'data' }, thead, tbody));
}

function chartWidth(container: HTMLElement): number {
  return Math.max(320, container.clientWidth || 560);
}

function svgRoot(W: number, HGT: number, label: string, extra: Record<string, string | number> = {}): SVGSVGElement {
  return s('svg', { width: W, height: HGT, viewBox: `0 0 ${W} ${HGT}`, role: 'img', 'aria-label': label, ...extra });
}

/** Horizontal grid, y-axis labels and the baseline shared by the column and line charts. */
function yAxis(
  svg: SVGSVGElement,
  view: View,
  ticks: number[],
  y: (v: number) => number,
  x1: number,
  x2: number,
  fmt: (v: number) => string,
): void {
  for (const tv of ticks) {
    svg.append(s('line', { x1, x2, y1: y(tv), y2: y(tv), stroke: view.cssVar('--grid'), 'stroke-width': 1 }));
    svg.append(
      s('text', { x: x1 - 7, y: y(tv) + 4, 'text-anchor': 'end', 'font-size': 11, fill: view.cssVar('--text-muted'), class: 'tnum' }, fmt(tv)),
    );
  }
  svg.append(s('line', { x1, x2, y1: y(0), y2: y(0), stroke: view.cssVar('--baseline'), 'stroke-width': 1 }));
}

/* ---------------------------------------------------- chart: cost / day */
export function renderCostCard(el: HTMLElement, tasks: TaskRow[], view: View): void {
  const days = costByDay(tasks);
  const title = 'Billed cost per day';
  renderCard(
    el,
    {
      id: 'cost',
      title,
      note: 'Totals use billed_cost_usd (authoritative). Hover a column for the day’s runs.',
      table: {
        cols: [{ label: 'Date' }, { label: 'Runs', num: true }, { label: 'Issues' }, { label: 'Billed cost', num: true }],
        rows: days.filter((d) => d.runs > 0).map((d) => [fmtDay(d.date), String(d.runs), d.issues.join(', '), fmtUsd(d.value)]),
      },
      renderChart: (body) =>
        columnChart(body, days, view, title, (d) => [
          { color: view.cssVar('--series-1'), value: fmtUsd(d.value), label: 'billed' },
          { value: String(d.runs), label: d.runs === 1 ? 'run' : 'runs' },
          ...(d.issues.length ? [{ value: '', label: d.issues.join(', ') }] : []),
        ]),
    },
    view,
  );
}

function columnChart(container: HTMLElement, days: CostDay[], view: View, label: string, tipRows: (d: CostDay) => TipRow[]): void {
  if (!days.length) {
    container.append(h('div', { class: 'empty' }, EMPTY_RANGE));
    return;
  }
  const color = view.cssVar('--series-1');
  const W = chartWidth(container);
  const M = { t: 14, r: 8, b: 26, l: 44 };
  const plotW = W - M.l - M.r;
  const plotH = 190;
  const HGT = plotH + M.t + M.b;
  const maxV = Math.max(...days.map((d) => d.value), 0.001);
  const ticks = niceTicks(maxV, 4);
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => M.t + plotH - (v / yMax) * plotH;
  const band = plotW / days.length;
  const barW = Math.min(24, Math.max(2, band - 3));
  const svg = svgRoot(W, HGT, label);
  yAxis(svg, view, ticks, y, M.l, W - M.r, fmtUsd);
  const every = Math.max(1, Math.ceil(days.length / 8));
  const lift = (i: number) => {
    unlift();
    svg.querySelector(`[data-col="${i}"]`)?.setAttribute('opacity', '0.75');
  };
  const unlift = () => svg.querySelectorAll('[data-col]').forEach((p) => p.removeAttribute('opacity'));
  days.forEach((d, i) => {
    const cx = M.l + band * i + band / 2;
    if (i % every === 0) {
      svg.append(s('text', { x: cx, y: HGT - 8, 'text-anchor': 'middle', 'font-size': 11, fill: view.cssVar('--text-muted') }, fmtDay(d.date)));
    }
    if (d.value > 0) {
      const bh = (d.value / yMax) * plotH;
      svg.append(s('path', { d: roundedTopRect(cx - barW / 2, y(d.value), barW, bh, 4), fill: color, 'data-col': i }));
    }
    svg.append(
      s('rect', {
        x: M.l + band * i,
        y: M.t,
        width: band,
        height: plotH,
        fill: 'transparent',
        tabindex: d.runs ? 0 : -1,
        onpointermove: ((e: PointerEvent) => {
          lift(i);
          view.tip.show(e, fmtDay(d.date), tipRows(d));
        }) as EventListener,
        onpointerleave: () => {
          unlift();
          view.tip.hide();
        },
        onfocus: ((e: FocusEvent) => {
          lift(i);
          view.tip.showAtFocus(e, null, 30, fmtDay(d.date), tipRows(d));
        }) as EventListener,
        onblur: () => {
          unlift();
          view.tip.hide();
        },
      }),
    );
  });
  container.append(svg);
}

/* ------------------------------------------ chart: findings by severity */
export function renderSevCard(el: HTMLElement, tasks: TaskRow[], view: View): void {
  const days = severityByDay(tasks);
  const legend = SEVERITIES.map((k) => ({ label: k, color: view.cssVar(SEV_VAR[k]) }));
  const title = 'Review findings by severity per day';
  renderCard(
    el,
    {
      id: 'sev',
      title,
      legend,
      note: 'Darker = more severe. Counts are per-task totals across all review cycles.',
      table: {
        cols: [{ label: 'Date' }, ...SEVERITIES.map((k) => ({ label: k, num: true })), { label: 'Total', num: true }],
        rows: days.filter((d) => d.total > 0).map((d) => [fmtDay(d.date), ...SEVERITIES.map((k) => String(d.sums[k])), String(d.total)]),
      },
      renderChart: (body) => stackedColumns(body, days, legend, view, title),
    },
    view,
  );
}

function stackedColumns(container: HTMLElement, days: SevDay[], legend: LegendItem[], view: View, label: string): void {
  if (!days.length) {
    container.append(h('div', { class: 'empty' }, EMPTY_RANGE));
    return;
  }
  const W = chartWidth(container);
  const M = { t: 14, r: 8, b: 26, l: 36 };
  const plotW = W - M.l - M.r;
  const plotH = 176;
  const HGT = plotH + M.t + M.b;
  const maxV = Math.max(...days.map((d) => d.total), 1);
  const ticks = niceTicks(maxV, 4);
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => M.t + plotH - (v / yMax) * plotH;
  const band = plotW / days.length;
  const barW = Math.min(24, Math.max(2, band - 3));
  const svg = svgRoot(W, HGT, label);
  yAxis(svg, view, ticks, y, M.l, W - M.r, fmtInt);
  const every = Math.max(1, Math.ceil(days.length / 8));
  const lift = (i: number) => {
    unlift();
    svg.querySelectorAll(`[data-col="${i}"]`).forEach((p) => p.setAttribute('opacity', '0.8'));
  };
  const unlift = () => svg.querySelectorAll('[data-col]').forEach((p) => p.removeAttribute('opacity'));
  days.forEach((d, i) => {
    const cx = M.l + band * i + band / 2;
    if (i % every === 0) {
      svg.append(s('text', { x: cx, y: HGT - 8, 'text-anchor': 'middle', 'font-size': 11, fill: view.cssVar('--text-muted') }, fmtDay(d.date)));
    }
    // Most severe at the baseline, working upward; 2px surface gaps between segments.
    let acc = 0;
    const segs = SEVERITIES.map((k, si) => ({ v: d.sums[k], color: legend[si].color })).filter((x) => x.v > 0);
    segs.forEach((seg, si) => {
      const y1 = y(acc);
      acc += seg.v;
      const y0 = y(acc);
      const isBottom = si === 0;
      const isTop = si === segs.length - 1;
      const top = y0 + (isTop ? 0 : 1);
      const bottom = y1 - (isBottom ? 0 : 1);
      const hgt = Math.max(0.5, bottom - top);
      if (isTop) svg.append(s('path', { d: roundedTopRect(cx - barW / 2, top, barW, hgt, 3), fill: seg.color, 'data-col': i }));
      else svg.append(s('rect', { x: cx - barW / 2, y: top, width: barW, height: hgt, fill: seg.color, 'data-col': i }));
    });
    const rows = (): TipRow[] => [
      ...SEVERITIES.map((k, si) => ({ color: legend[si].color, value: String(d.sums[k]), label: k })),
      { value: String(d.total), label: 'total' },
    ];
    svg.append(
      s('rect', {
        x: M.l + band * i,
        y: M.t,
        width: band,
        height: plotH,
        fill: 'transparent',
        tabindex: d.total ? 0 : -1,
        onpointermove: ((e: PointerEvent) => {
          lift(i);
          view.tip.show(e, fmtDay(d.date), rows());
        }) as EventListener,
        onpointerleave: () => {
          unlift();
          view.tip.hide();
        },
        onfocus: ((e: FocusEvent) => {
          lift(i);
          view.tip.showAtFocus(e, null, 30, fmtDay(d.date), rows());
        }) as EventListener,
        onblur: () => {
          unlift();
          view.tip.hide();
        },
      }),
    );
  });
  container.append(svg);
}

/* --------------------------------------------------- chart: phase medians */
export function renderPhasesCard(el: HTMLElement, tasks: TaskRow[], view: View): void {
  const perPhase = phaseStats(tasks).map((p) => ({ ...p, color: view.cssVar(PHASE_VAR[p.name]) }));
  const title = 'Where the time goes (median per phase)';
  renderCard(
    el,
    {
      id: 'phases',
      title,
      note: 'Bottom bar: average share of estimated cost per phase — estimates show proportions only; all $ totals elsewhere use billed cost.',
      table: {
        cols: [{ label: 'Phase' }, { label: 'Median time', num: true }, { label: 'Total time', num: true }, { label: 'Avg est-cost share', num: true }],
        rows: perPhase.map((p) => [p.name, fmtDur(p.median), fmtDur(p.total), (p.share * 100).toFixed(1) + '%']),
      },
      renderChart: (body) => {
        hBarChart(body, perPhase.map((p) => ({ label: p.name, value: p.median || 0 })), view, title);
        shareBar(body, perPhase, view);
      },
    },
    view,
  );
}

function hBarChart(container: HTMLElement, items: { label: string; value: number }[], view: View, label: string): void {
  const color = view.cssVar('--series-1');
  const W = chartWidth(container);
  const M = { t: 4, r: 56, b: 4, l: 86 };
  const rowH = 26;
  const barH = 16;
  const HGT = M.t + items.length * rowH + M.b;
  const plotW = W - M.l - M.r;
  const maxV = Math.max(...items.map((i) => i.value), 0.001);
  const svg = svgRoot(W, HGT, label);
  svg.append(s('line', { x1: M.l, x2: M.l, y1: M.t, y2: HGT - M.b, stroke: view.cssVar('--baseline'), 'stroke-width': 1 }));
  items.forEach((it, i) => {
    const cy = M.t + rowH * i + rowH / 2;
    const w = Math.max(1, (it.value / maxV) * plotW);
    const tip: TipRow[] = [{ color, value: fmtDur(it.value), label: 'median' }];
    svg.append(s('text', { x: M.l - 8, y: cy + 4, 'text-anchor': 'end', 'font-size': 12, fill: view.cssVar('--text-secondary') }, it.label));
    svg.append(s('path', { d: roundedRightRect(M.l, cy - barH / 2, w, barH, 4), fill: color, 'data-row': i }));
    svg.append(s('text', { x: M.l + w + 7, y: cy + 4, 'font-size': 11.5, fill: view.cssVar('--text-secondary'), class: 'tnum' }, fmtDur(it.value)));
    svg.append(
      s('rect', {
        x: 0,
        y: cy - rowH / 2,
        width: W,
        height: rowH,
        fill: 'transparent',
        tabindex: 0,
        onpointermove: ((e: PointerEvent) => view.tip.show(e, it.label, tip)) as EventListener,
        onpointerleave: () => view.tip.hide(),
        onfocus: ((e: FocusEvent) => view.tip.showAtFocus(e, 120, 10, it.label, tip)) as EventListener,
        onblur: () => view.tip.hide(),
      }),
    );
  });
  container.append(svg);
}

function shareBar(container: HTMLElement, perPhase: { name: string; share: number; color: string }[], view: View): void {
  const W = chartWidth(container);
  const barH = 20;
  const HGT = barH + 30;
  const caption = 'Avg est-cost share by phase';
  const svg = svgRoot(W, HGT, caption);
  svg.append(s('text', { x: 0, y: 12, 'font-size': 11.5, fill: view.cssVar('--text-muted') }, caption));
  let x = 0;
  const segs = perPhase.filter((p) => p.share > 0.002);
  segs.forEach((p, i) => {
    const w = Math.max(1, p.share * W - (i < segs.length - 1 ? 2 : 0));
    const y0 = 18;
    const tip: TipRow[] = [{ color: p.color, value: (p.share * 100).toFixed(1) + '%', label: 'of estimated cost' }];
    svg.append(
      s('rect', {
        x,
        y: y0,
        width: w,
        height: barH,
        fill: p.color,
        rx: 2,
        tabindex: 0,
        onpointermove: ((e: PointerEvent) => view.tip.show(e, p.name, tip)) as EventListener,
        onpointerleave: () => view.tip.hide(),
        onfocus: ((e: FocusEvent) => view.tip.showAtFocus(e, null, 24, p.name, tip)) as EventListener,
        onblur: () => view.tip.hide(),
      }),
    );
    const pctText = Math.round(p.share * 100) + '%';
    if (w > pctText.length * 7 + 10) {
      svg.append(s('text', { x: x + w / 2, y: y0 + 14, 'text-anchor': 'middle', 'font-size': 11, fill: inkFor(p.color) }, pctText));
    }
    x += w + 2;
  });
  container.append(svg);
}

/* ------------------------------------------ chart: cycle-1 findings trend */
/** `note` is the dataset's footnote from site.ts: how far the trend can be read. */
export function renderTrendCard(el: HTMLElement, tasks: TaskRow[], view: View, note: string): void {
  const pts = cycleOneTrend(tasks);
  const raw = view.cssVar('--deemph');
  const acc = view.cssVar('--series-1');
  const title = 'Findings in review cycle 1 per run';
  renderCard(
    el,
    {
      id: 'trend',
      title,
      legend: [
        { label: 'per run', color: raw, type: 'line' },
        { label: `rolling avg (${TREND_WINDOW} runs)`, color: acc, type: 'line' },
      ],
      note,
      table: {
        cols: [{ label: 'Issue' }, { label: 'Date' }, { label: 'Cycle-1 findings', num: true }, { label: 'Rolling avg', num: true }],
        rows: pts.map((p) => ['#' + p.issue, fmtDay(p.date), String(p.v), p.roll.toFixed(1)]),
      },
      renderChart: (body) => lineChart(body, pts, { raw, acc }, view, title),
    },
    view,
  );
}

function lineChart(container: HTMLElement, pts: TrendPoint[], colors: { raw: string; acc: string }, view: View, label: string): void {
  if (pts.length < 2) {
    container.append(h('div', { class: 'empty' }, 'Not enough runs in this range.'));
    return;
  }
  const W = chartWidth(container);
  const M = { t: 14, r: 12, b: 26, l: 34 };
  const plotW = W - M.l - M.r;
  const plotH = 190;
  const HGT = plotH + M.t + M.b;
  const maxV = Math.max(...pts.map((p) => p.v), 1);
  const ticks = niceTicks(maxV, 4);
  const yMax = ticks[ticks.length - 1];
  const x = (i: number) => M.l + (i / (pts.length - 1)) * plotW;
  const y = (v: number) => M.t + plotH - (v / yMax) * plotH;
  const surface = view.cssVar('--surface-1');
  const svg = svgRoot(W, HGT, label, { tabindex: 0 });
  yAxis(svg, view, ticks, y, M.l, W - M.r, fmtInt);
  const every = Math.max(1, Math.ceil(pts.length / 7));
  pts.forEach((p, i) => {
    if (i % every === 0) {
      svg.append(s('text', { x: x(i), y: HGT - 8, 'text-anchor': 'middle', 'font-size': 11, fill: view.cssVar('--text-muted') }, fmtDay(p.date)));
    }
  });
  const path = (series: (p: TrendPoint) => number) =>
    'M' + pts.map((p, i) => `${x(i).toFixed(1)},${y(series(p)).toFixed(1)}`).join(' L');
  const stroke = { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  svg.append(s('path', { d: path((p) => p.v), stroke: colors.raw, 'stroke-width': 2, ...stroke }));
  svg.append(s('path', { d: path((p) => p.roll), stroke: colors.acc, 'stroke-width': 2.5, ...stroke }));
  // End marker + direct label on the emphasis series.
  const last = pts[pts.length - 1];
  svg.append(s('circle', { cx: x(pts.length - 1), cy: y(last.roll), r: 4.5, fill: colors.acc, stroke: surface, 'stroke-width': 2 }));
  svg.append(
    s(
      'text',
      { x: x(pts.length - 1) - 8, y: y(last.roll) - 9, 'text-anchor': 'end', 'font-size': 11.5, fill: view.cssVar('--text-secondary'), class: 'tnum' },
      last.roll.toFixed(1),
    ),
  );

  const hidden = { visibility: 'hidden' };
  const hair = s('line', { y1: M.t, y2: M.t + plotH, stroke: view.cssVar('--baseline'), 'stroke-width': 1, ...hidden });
  const dotR = s('circle', { r: 4.5, fill: colors.raw, stroke: surface, 'stroke-width': 2, ...hidden });
  const dotA = s('circle', { r: 4.5, fill: colors.acc, stroke: surface, 'stroke-width': 2, ...hidden });
  svg.append(hair, dotR, dotA);
  let focusIdx: number | null = null;
  const place = (el: SVGElement, attrs: Record<string, number | string>) => {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  };
  function showAt(i: number, evt: { clientX: number; clientY: number }): void {
    const p = pts[i];
    place(hair, { x1: x(i), x2: x(i), visibility: 'visible' });
    place(dotR, { cx: x(i), cy: y(p.v), visibility: 'visible' });
    place(dotA, { cx: x(i), cy: y(p.roll), visibility: 'visible' });
    view.tip.show(evt, `#${p.issue} · ${fmtDay(p.date)}`, [
      { color: colors.raw, value: String(p.v), label: 'cycle-1 findings' },
      { color: colors.acc, value: p.roll.toFixed(1), label: 'rolling avg' },
    ]);
  }
  function hideMarkers(): void {
    for (const el of [hair, dotR, dotA]) el.setAttribute('visibility', 'hidden');
    view.tip.hide();
  }
  svg.append(
    s('rect', {
      x: M.l,
      y: M.t,
      width: plotW,
      height: plotH,
      fill: 'transparent',
      onpointermove: ((e: PointerEvent) => {
        const rect = svg.getBoundingClientRect();
        const px = e.clientX - rect.left;
        showAt(Math.max(0, Math.min(pts.length - 1, Math.round(((px - M.l) / plotW) * (pts.length - 1)))), e);
      }) as EventListener,
      onpointerleave: hideMarkers,
    }),
  );
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    focusIdx =
      focusIdx == null ? pts.length - 1 : Math.max(0, Math.min(pts.length - 1, focusIdx + (e.key === 'ArrowRight' ? 1 : -1)));
    const rect = svg.getBoundingClientRect();
    showAt(focusIdx, { clientX: rect.left + x(focusIdx), clientY: rect.top + 40 });
  });
  svg.addEventListener('blur', () => {
    focusIdx = null;
    hideMarkers();
  });
  container.append(svg);
}
