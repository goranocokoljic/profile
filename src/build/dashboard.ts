// Build-record dashboard: a TypeScript port of design-reference/dashboard,
// rendering the static payload instead of polling /api/data. Adds a dataset
// switch whose selection lives in the URL hash (#dataset=toprope).

import { createTooltip } from './dom';
import { buildSkeleton, renderAll, type DashboardCopy, type DashboardState, type DatasetKey } from './render';
import type { Payload } from './types';

export type { DashboardCopy, DatasetKey };

export interface DashboardOptions {
  /** Dataset shown when the URL hash names none. */
  dataset: string;
  copy: DashboardCopy;
}

const HASH_KEY = 'dataset';

export function datasetFromHash(hash: string, payload: Payload): DatasetKey | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(HASH_KEY);
  return value && Object.hasOwn(payload.datasets, value) ? (value as DatasetKey) : null;
}

export function renderDashboard(root: HTMLElement, payload: Payload, opts: DashboardOptions): void {
  const fallback: DatasetKey = Object.hasOwn(payload.datasets, opts.dataset) ? (opts.dataset as DatasetKey) : 'site';
  const state: DashboardState = {
    dataset: datasetFromHash(location.hash, payload) ?? fallback,
    period: 'all',
    outcome: 'all',
    sort: { key: 'ts', dir: -1 },
    expanded: new Set(),
    tableMode: new Set(),
  };
  const slots = buildSkeleton(root, opts.copy);
  const view = {
    cssVar: (name: string) => getComputedStyle(root).getPropertyValue(name).trim(),
    tip: createTooltip(slots.tooltip),
    tableMode: state.tableMode,
    rerender,
  };

  function rerender(): void {
    // Everything is redrawn, so put keyboard focus back on the control that had it.
    const active = document.activeElement;
    const fk = active instanceof HTMLElement && root.contains(active) ? active.dataset.fk : undefined;
    view.tip.hide();
    renderAll(slots, payload, state, opts.copy, view, set);
    if (fk) root.querySelector<HTMLElement>(`[data-fk="${CSS.escape(fk)}"]`)?.focus();
  }

  function set(patch: Partial<DashboardState>): void {
    if (patch.dataset && patch.dataset !== state.dataset) {
      state.expanded.clear();
      history.replaceState(null, '', `#${HASH_KEY}=${patch.dataset}`);
    }
    Object.assign(state, patch);
    rerender();
  }

  window.addEventListener('hashchange', () => {
    const dataset = datasetFromHash(location.hash, payload);
    if (dataset && dataset !== state.dataset) set({ dataset });
  });
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rerender, 150);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender);
  rerender();
}
