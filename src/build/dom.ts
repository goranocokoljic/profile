// DOM helpers and the shared tooltip, ported from the reference script.
// No `style` attributes: the page runs under CSP `default-src 'self'`, which
// blocks them. Inline styling goes through `el.style.*` (CSSOM), which it allows.

type Child = Node | string | number | null | undefined | false;
type Children = (Child | Child[])[];
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

function applyAttrs(node: Element, attrs: Attrs | null): void {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'style') throw new Error('style attributes are blocked by the CSP; set el.style instead');
    if (typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.setAttribute('class', String(v));
    else node.setAttribute(k, v === true ? '' : String(v));
  }
}

function appendChildren(node: Element, children: Children): void {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Children
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs ?? null);
  appendChildren(node, children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Children
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs ?? null);
  appendChildren(node, children);
  return node;
}

export function roundedTopRect(x: number, y: number, w: number, hgt: number, r: number): string {
  r = Math.max(0, Math.min(r, w / 2, hgt));
  return `M${x},${y + hgt} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + hgt} Z`;
}

export function roundedRightRect(x: number, y: number, w: number, hgt: number, r: number): string {
  r = Math.max(0, Math.min(r, hgt / 2, w));
  return `M${x},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + hgt - r} Q${x + w},${y + hgt} ${x + w - r},${y + hgt} L${x},${y + hgt} Z`;
}

/* ---------------------------------------------------------------- tooltip */
export interface TipRow {
  color?: string;
  value: string;
  label?: string;
}

export interface Point {
  clientX: number;
  clientY: number;
}

export interface Tooltip {
  show(evt: Point, title: string, rows: TipRow[]): void;
  hide(): void;
  /** Tooltip anchored under a focused element, for keyboard users. */
  showAtFocus(evt: FocusEvent, dx: number | null, dy: number, title: string, rows: TipRow[]): void;
}

export function createTooltip(el: HTMLElement): Tooltip {
  function move(evt: Point): void {
    const pad = 14;
    const rect = el.getBoundingClientRect();
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    if (x + rect.width > window.innerWidth - 8) x = evt.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = evt.clientY - rect.height - pad;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
  function show(evt: Point, title: string, rows: TipRow[]): void {
    el.textContent = '';
    if (title) el.append(h('div', { class: 'tt-title' }, title));
    for (const r of rows) {
      const row = h('div', { class: 'tt-row' });
      if (r.color) {
        const key = h('span', { class: 'tt-key' });
        key.style.background = r.color;
        row.append(key);
      }
      row.append(h('span', { class: 'tt-val' }, r.value));
      if (r.label) row.append(h('span', { class: 'tt-lab' }, r.label));
      el.append(row);
    }
    el.style.display = 'block';
    move(evt);
  }
  return {
    show,
    hide: () => {
      el.style.display = 'none';
    },
    showAtFocus: (evt, dx, dy, title, rows) => {
      const r = (evt.target as Element).getBoundingClientRect();
      show({ clientX: r.x + (dx ?? r.width / 2), clientY: r.y + dy }, title, rows);
    },
  };
}
