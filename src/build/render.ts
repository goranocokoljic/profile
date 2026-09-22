// Page skeleton, filter controls, KPI row and the render-all pass, ported
// from the reference script. State lives in dashboard.ts; this module draws it.

import { renderCostCard, renderPhasesCard, renderSevCard, renderTrendCard, type View } from './charts';
import { h } from './dom';
import { fmtDateTime, fmtDur, fmtInt, fmtUsd } from './format';
import { renderLessons } from './lessons';
import { renderEpics, renderRuns, type RunsState } from './runs';
import { computeKpis, filterEpics, filterTasks, type OutcomeFilter, type Period } from './stats';
import type { Dataset, Payload } from './types';

export type DatasetKey = keyof Payload['datasets'];

/** Copy owned by src/data/site.ts; everything else is the reference's wording. */
export interface DashboardCopy {
  datasetLabel: string;
  datasets: Record<DatasetKey, string>;
  empty: string;
}

export interface DashboardState extends RunsState {
  dataset: DatasetKey;
  period: Period;
  outcome: OutcomeFilter;
  tableMode: Set<string>;
}

export interface Slots {
  asof: HTMLElement;
  segDataset: HTMLElement;
  segPeriod: HTMLElement;
  segOutcome: HTMLElement;
  kpis: HTMLElement;
  charts: HTMLElement;
  cost: HTMLElement;
  trend: HTMLElement;
  phases: HTMLElement;
  sev: HTMLElement;
  runsTitle: HTMLElement;
  runs: HTMLElement;
  epics: HTMLElement;
  lessons: HTMLElement;
  empty: HTMLElement;
  tooltip: HTMLElement;
}

function seg(id: string, label: string, el: HTMLElement): HTMLElement {
  el.setAttribute('role', 'group');
  el.setAttribute('aria-labelledby', id);
  return h('span', { class: 'filter' }, h('span', { class: 'filter-label', id }, label), el);
}

export function buildSkeleton(root: HTMLElement, copy: DashboardCopy): Slots {
  const card = () => h('div', { class: 'card' });
  const slots: Slots = {
    asof: h('span', { class: 'asof' }),
    segDataset: h('span', { class: 'seg', 'data-seg': 'dataset' }),
    segPeriod: h('span', { class: 'seg', 'data-seg': 'period' }),
    segOutcome: h('span', { class: 'seg', 'data-seg': 'outcome' }),
    kpis: h('section', { class: 'kpis', 'aria-label': 'Totals' }),
    charts: h('section', { class: 'grid' }),
    cost: card(),
    trend: card(),
    phases: card(),
    sev: card(),
    runsTitle: h('h2', { class: 'runs-title' }, 'Runs'),
    runs: card(),
    epics: card(),
    lessons: card(),
    empty: h('p', { class: 'empty empty-dataset' }, copy.empty),
    tooltip: h('div', { class: 'tooltip', 'aria-hidden': 'true' }),
  };
  slots.charts.append(slots.cost, slots.trend, slots.phases, slots.sev);
  root.textContent = '';
  root.classList.add('dash');
  root.append(
    h(
      'div',
      { class: 'filters' },
      seg('dash-f-dataset', copy.datasetLabel, slots.segDataset),
      seg('dash-f-period', 'Period', slots.segPeriod),
      seg('dash-f-outcome', 'Outcome', slots.segOutcome),
      slots.asof,
    ),
    slots.kpis,
    slots.empty,
    slots.charts,
    slots.runsTitle,
    slots.runs,
    h('section', { class: 'grid grid-bottom' }, slots.epics, slots.lessons),
    slots.tooltip,
  );
  return slots;
}

function renderSeg<T extends string>(
  el: HTMLElement,
  name: string,
  options: { value: T; label: string }[],
  current: T,
  onPick: (v: T) => void,
): void {
  el.textContent = '';
  for (const opt of options) {
    const on = current === opt.value;
    el.append(
      h(
        'button',
        { type: 'button', class: on ? 'on' : undefined, 'aria-pressed': String(on), 'data-fk': `seg-${name}-${opt.value}`, onclick: () => onPick(opt.value) },
        opt.label,
      ),
    );
  }
}

function renderKpis(el: HTMLElement, ds: Dataset, tasks: Dataset['tasks']): void {
  const k = computeKpis(tasks);
  // A dataset with no runs at all shows dashes, not zeros.
  const none = ds.tasks.length === 0;
  const v = (s: string) => (none ? '—' : s);
  const tiles = [
    { label: 'Runs', value: v(String(k.runs)), sub: `${k.ok} ok · ${k.incomplete} incomplete · ${k.failed} failed` },
    { label: 'Success rate', value: k.runs ? Math.round((k.ok / k.runs) * 100) + '%' : '—', sub: 'ok / all runs' },
    { label: 'Billed cost', value: v(fmtUsd(k.cost)), sub: 'sum of billed_cost_usd' },
    { label: 'Wall time', value: v(fmtDur(k.wall)), sub: 'sum across runs' },
    { label: 'Median cost / ok run', value: fmtUsd(k.medCost), sub: k.ok + ' ok runs' },
    { label: 'Review findings', value: v(fmtInt(k.findings)), sub: 'caught across all cycles' },
  ];
  el.textContent = '';
  for (const t of tiles) {
    el.append(h('div', { class: 'tile' }, h('div', { class: 'label' }, t.label), h('div', { class: 'value' }, t.value), h('div', { class: 'sub' }, t.sub)));
  }
}

export function renderAll(slots: Slots, payload: Payload, state: DashboardState, copy: DashboardCopy, view: View, set: (patch: Partial<DashboardState>) => void): void {
  const ds = payload.datasets[state.dataset];
  renderSeg(
    slots.segDataset,
    'dataset',
    (Object.keys(copy.datasets) as DatasetKey[]).map((value) => ({ value, label: copy.datasets[value] })),
    state.dataset,
    (dataset) => set({ dataset }),
  );
  renderSeg<Period>(
    slots.segPeriod,
    'period',
    [
      { value: 'all', label: 'All time' },
      { value: '90', label: '90d' },
      { value: '30', label: '30d' },
      { value: '7', label: '7d' },
    ],
    state.period,
    (period) => set({ period }),
  );
  renderSeg<OutcomeFilter>(
    slots.segOutcome,
    'outcome',
    [
      { value: 'all', label: 'All' },
      { value: 'ok', label: 'ok' },
      { value: 'problems', label: 'incomplete + failed' },
    ],
    state.outcome,
    (outcome) => set({ outcome }),
  );

  const tasks = filterTasks(ds.tasks, state.period, state.outcome);
  renderKpis(slots.kpis, ds, tasks);

  const empty = ds.tasks.length === 0;
  slots.empty.hidden = !empty;
  for (const el of [slots.charts, slots.runsTitle, slots.runs]) el.hidden = empty;
  if (!empty) {
    renderCostCard(slots.cost, tasks, view);
    renderTrendCard(slots.trend, tasks, view);
    renderPhasesCard(slots.phases, tasks, view);
    renderSevCard(slots.sev, tasks, view);
    renderRuns(slots.runs, tasks, ds.meta, state, view);
  }
  renderEpics(slots.epics, filterEpics(ds.epics, state.period), ds.meta);
  renderLessons(slots.lessons, ds.lessons);

  const f = ds.files;
  const newest = [f.tasks.mtime, f.reviewCycles.mtime, f.epics.mtime, f.lessons.mtime].filter((m): m is string => !!m).sort().pop();
  slots.asof.textContent = `${ds.tasks.length} runs · data updated ${newest ? fmtDateTime(new Date(newest)) : '—'}`;
}
