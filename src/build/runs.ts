// Runs table with expandable rows, and the epics table, ported from the
// reference script. Issue and PR cells link to GitHub only when the dataset
// carries `meta` for that issue (the site dataset); otherwise they stay plain.

import { dataTable, PHASE_VAR, type View } from './charts';
import { h, s } from './dom';
import { fmtCtx, fmtDateTime, fmtDur, fmtInt, fmtUsd, shortModel } from './format';
import { PHASE_ORDER, type Dated, type TaskRow } from './stats';
import type { Dispositions, Epic, IssueMeta, Phase, Task } from './types';

export type SortKey = 'issue' | 'ts' | 'attempt' | 'outcome' | 'model_ran' | 'total_sec' | 'billed_cost_usd' | '_cycles' | '_pr';

export interface RunsState {
  sort: { key: SortKey; dir: 1 | -1 };
  expanded: Set<string>;
}

type Meta = Record<string, IssueMeta> | undefined;

interface RunCol {
  key: SortKey | '_chev' | '_findings';
  label: string;
  sortable: boolean;
  num?: boolean;
}

const RUN_COLS: RunCol[] = [
  { key: '_chev', label: '', sortable: false },
  { key: 'issue', label: 'Issue', sortable: true },
  { key: 'ts', label: 'Date', sortable: true },
  { key: 'attempt', label: 'Att.', sortable: true, num: true },
  { key: 'outcome', label: 'Outcome', sortable: true },
  { key: 'model_ran', label: 'Model', sortable: true },
  { key: 'total_sec', label: 'Duration', sortable: true, num: true },
  { key: 'billed_cost_usd', label: 'Billed', sortable: true, num: true },
  { key: '_cycles', label: 'Cycles', sortable: true, num: true },
  { key: '_findings', label: 'Findings', sortable: false },
];

// Only for datasets with issue meta: the merged PR, after the issue.
const PR_COL: RunCol = { key: '_pr', label: 'PR', sortable: true, num: true };

export function runColumns(meta: Meta): RunCol[] {
  return meta ? [...RUN_COLS.slice(0, 2), PR_COL, ...RUN_COLS.slice(2)] : RUN_COLS;
}

export function runSortVal(t: TaskRow, key: SortKey, meta: Meta): number | string {
  if (key === '_cycles') return t.review ? t.review.cycles_run : -1;
  if (key === '_pr') return meta?.[t.issue]?.pr ?? -1;
  if (key === 'ts') return t.date.getTime();
  const v = t[key];
  return v == null ? -Infinity : v;
}

export function sortRuns(tasks: TaskRow[], sort: RunsState['sort'], meta: Meta): TaskRow[] {
  return [...tasks].sort((a, b) => {
    const av = runSortVal(a, sort.key, meta);
    const bv = runSortVal(b, sort.key, meta);
    return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
  });
}

function outcomeChip(outcome: string): HTMLElement {
  const map: Record<string, { icon: string; color: string }> = {
    ok: { icon: '✓', color: 'var(--status-good)' },
    incomplete: { icon: '◐', color: 'var(--status-warning)' },
    failed: { icon: '✕', color: 'var(--status-critical)' },
  };
  const m = map[outcome] || { icon: '?', color: 'var(--text-muted)' };
  const dot = h('span', { class: 'dot', 'aria-hidden': 'true' }, m.icon);
  dot.style.color = m.color;
  return h('span', { class: 'status' }, dot, outcome);
}

function findingsCell(t: Task): Node | string {
  const f = t.review?.findings_total;
  if (!f) return '—';
  const parts: string[] = [];
  for (const [k, abbr] of [['critical', 'C'], ['high', 'H'], ['medium', 'M'], ['low', 'L'], ['style', 'S']] as const) {
    if (f[k]) parts.push(f[k] + abbr);
  }
  return h('span', { class: 'sevtag' }, parts.length ? parts.join(' ') : '0');
}

const stop = (e: Event) => e.stopPropagation();

function issueCell(issue: number, meta: Meta): Node | string {
  const m = meta?.[issue];
  if (!m) return '#' + issue;
  return h('a', { href: m.url, title: m.title, rel: 'noopener', onclick: stop }, '#' + issue);
}

function prCell(issue: number, meta: Meta): Node | string {
  const m = meta?.[issue];
  if (!m || m.pr == null || !m.prUrl) return '—';
  return h('a', { href: m.prUrl, rel: 'noopener', onclick: stop }, '#' + m.pr);
}

export function runKey(t: Task): string {
  return t.issue + '|' + t.ts;
}

export function renderRuns(card: HTMLElement, tasks: TaskRow[], meta: Meta, state: RunsState, view: View): void {
  card.textContent = '';
  if (!tasks.length) {
    card.append(h('div', { class: 'empty' }, 'No runs in this range.'));
    return;
  }
  const cols = runColumns(meta);
  const sorted = sortRuns(tasks, state.sort, meta);
  const thead = h(
    'thead',
    null,
    h(
      'tr',
      null,
      cols.map((c) => {
        const active = state.sort.key === c.key;
        const cls = c.num ? 'num' : undefined;
        if (!c.sortable) return h('th', { class: cls, scope: 'col' }, c.label);
        const onSort = () => {
          const key = c.key as SortKey;
          if (state.sort.key === key) state.sort.dir = state.sort.dir === 1 ? -1 : 1;
          else state.sort = { key, dir: key === 'ts' ? -1 : 1 };
          view.rerender();
        };
        return h(
          'th',
          {
            class: (cls ? cls + ' ' : '') + 'sortable',
            scope: 'col',
            'aria-sort': active ? (state.sort.dir === 1 ? 'ascending' : 'descending') : undefined,
          },
          h(
            'button',
            { type: 'button', class: 'sort', 'data-fk': `sort-${c.key}`, onclick: onSort },
            c.label + (active ? (state.sort.dir === 1 ? ' ▲' : ' ▼') : ''),
          ),
        );
      }),
    ),
  );
  const tbody = h('tbody');
  for (const t of sorted) {
    const key = runKey(t);
    const open = state.expanded.has(key);
    const toggle = () => {
      if (open) state.expanded.delete(key);
      else state.expanded.add(key);
      view.rerender();
    };
    const cells: (Node | string)[] = [
      h(
        'button',
        { type: 'button', class: 'expander', 'data-fk': `exp-${key}`, 'aria-expanded': String(open), 'aria-label': `Details for run #${t.issue}, ${fmtDateTime(t.date)}` },
        h('span', { class: 'chev' + (open ? ' open' : ''), 'aria-hidden': 'true' }, '›'),
      ),
      issueCell(t.issue, meta),
      ...(meta ? [prCell(t.issue, meta)] : []),
      fmtDateTime(t.date),
      String(t.attempt ?? 1),
      outcomeChip(t.outcome),
      shortModel(t.model_ran),
      fmtDur(t.total_sec),
      fmtUsd(t.billed_cost_usd),
      t.review ? String(t.review.cycles_run) : '—',
      findingsCell(t),
    ];
    tbody.append(
      h(
        'tr',
        { class: 'expandable', 'data-run': key, onclick: toggle },
        cells.map((cell, i) => h('td', { class: cols[i].num ? 'num' : undefined }, cell)),
      ),
    );
    if (open) tbody.append(h('tr', { class: 'detail-row' }, h('td', { colspan: cols.length }, runDetail(t, view))));
  }
  card.append(h('div', { class: 'scroll-x' }, h('table', { class: 'data runs' }, thead, tbody)));
}

const DISPOSITION_COLS = [
  { label: 'Cycle' },
  { label: 'Fixed', num: true },
  { label: 'Rejected (intentional)', num: true },
  { label: 'Rejected (wrong)', num: true },
  { label: 'Deferred', num: true },
];

function dispositionRow(label: string, d: Dispositions): string[] {
  return [label, String(d.fixed), String(d.rejected_intentional), String(d.rejected_wrong), String(d.deferred)];
}

export function runDetail(t: Task, view: View): HTMLElement {
  const detail = h('div', { class: 'detail' });
  if (Array.isArray(t.phases) && t.phases.length) {
    detail.append(h('h3', null, 'Time by phase'));
    detail.append(phaseStackBar(t.phases, view));
    const lg = h('div', { class: 'legend legend-detail' });
    for (const name of PHASE_ORDER) {
      if (!t.phases.some((p) => p.phase === name)) continue;
      const sw = h('span', { class: 'sw' });
      sw.style.background = view.cssVar(PHASE_VAR[name]);
      lg.append(h('span', { class: 'item' }, sw, name));
    }
    detail.append(lg);
    detail.append(h('h3', null, 'Phases'));
    detail.append(
      dataTable(
        [{ label: 'Phase' }, { label: 'Time', num: true }, { label: 'Turns', num: true }, { label: 'Tool calls', num: true }, { label: 'Peak ctx', num: true }, { label: 'Est. cost', num: true }],
        t.phases.map((p) => [p.phase, fmtDur(p.duration_sec), fmtInt(p.turns ?? 0), fmtInt(p.tool_calls ?? 0), fmtCtx(p.peak_ctx_tokens), fmtUsd(p.est_cost_usd)]),
      ),
    );
  }
  if (Array.isArray(t.review_cycles) && t.review_cycles.length) {
    detail.append(h('h3', null, 'Review cycles'));
    detail.append(
      dataTable(
        [
          { label: 'Cycle', num: true },
          { label: 'Blockers', num: true },
          { label: 'C', num: true },
          { label: 'H', num: true },
          { label: 'M', num: true },
          { label: 'L', num: true },
          { label: 'S', num: true },
          { label: 'Review', num: true },
          { label: 'Fix', num: true },
          { label: 'Est. cost', num: true },
        ],
        t.review_cycles.map((c) => [
          String(c.review_cycle),
          String(c.findings?.blocker ?? 0),
          String(c.findings?.critical ?? 0),
          String(c.findings?.high ?? 0),
          String(c.findings?.medium ?? 0),
          String(c.findings?.low ?? 0),
          String(c.findings?.style ?? 0),
          fmtDur(c.review_sec),
          fmtDur(c.fix_sec),
          fmtUsd(c.est_cost_usd),
        ]),
      ),
    );
  }
  const dispRows = (t.review_cycles ?? []).flatMap((c) => (c.dispositions ? [dispositionRow(String(c.review_cycle), c.dispositions)] : []));
  if (t.review?.dispositions_total) dispRows.push(dispositionRow('Total', t.review.dispositions_total));
  if (dispRows.length) {
    detail.append(h('h3', null, 'Dispositions'));
    detail.append(dataTable(DISPOSITION_COLS, dispRows));
  }
  detail.append(
    h('div', { class: 'footnote' }, `Billed total ${fmtUsd(t.billed_cost_usd)} · asked for ${t.model_asked ?? '—'}, ran ${t.model_ran ?? '—'} · phase costs are estimates`),
  );
  return detail;
}

function phaseStackBar(phases: Phase[], view: View): SVGSVGElement {
  const W = 720;
  const barH = 20;
  const total = phases.reduce((a, p) => a + (p.duration_sec || 0), 0) || 1;
  const svg = s('svg', {
    width: '100%',
    height: barH,
    viewBox: `0 0 ${W} ${barH}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': 'Time by phase',
    class: 'phase-stack',
  });
  let x = 0;
  const ordered = PHASE_ORDER.map((n) => phases.find((p) => p.phase === n)).filter((p): p is Phase => !!p && (p.duration_sec || 0) > 0);
  ordered.forEach((p, i) => {
    const w = Math.max(1, (p.duration_sec / total) * W - (i < ordered.length - 1 ? 2 : 0));
    const color = view.cssVar(PHASE_VAR[p.phase]);
    const tip = [{ color, value: fmtDur(p.duration_sec), label: ((p.duration_sec / total) * 100).toFixed(0) + '% of run' }];
    svg.append(
      s('rect', {
        x,
        y: 0,
        width: w,
        height: barH,
        fill: color,
        rx: 2,
        tabindex: 0,
        onpointermove: ((e: PointerEvent) => view.tip.show(e, p.phase, tip)) as EventListener,
        onpointerleave: () => view.tip.hide(),
        onfocus: ((e: FocusEvent) => view.tip.showAtFocus(e, null, 24, p.phase, tip)) as EventListener,
        onblur: () => view.tip.hide(),
      }),
    );
    x += w + 2;
  });
  return svg;
}

/* ------------------------------------------------------------------ epics */
export function renderEpics(card: HTMLElement, epics: Dated<Epic>[], meta: Meta): void {
  card.textContent = '';
  card.append(h('div', { class: 'card-head' }, h('h2', null, 'Epics')));
  if (!epics.length) {
    card.append(h('div', { class: 'empty' }, 'No epic runs in this range.'));
    return;
  }
  card.append(
    dataTable(
      [{ label: 'Epic' }, { label: 'Branch' }, { label: 'Children', num: true }, { label: 'Wall', num: true }, { label: 'Billed', num: true }],
      epics.map((e) => [
        issueCell(e.epic, meta),
        h('span', { class: 'break-all' }, e.branch || '—'),
        `${e.child_ok}/${e.child_total}`,
        fmtDur(e.wall_sec),
        fmtUsd(e.billed_cost_usd) + (e.billed_partial ? ' †' : ''),
      ]),
    ),
  );
  if (epics.some((e) => e.billed_partial)) card.append(h('div', { class: 'footnote' }, '† partial billing data'));
}
