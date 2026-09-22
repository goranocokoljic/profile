// Review-lessons registry card, ported from the reference script.

import { dataTable } from './charts';
import { h } from './dom';
import type { Lesson } from './types';

export function renderLessons(card: HTMLElement, lessons: Lesson[]): void {
  card.textContent = '';
  card.append(h('div', { class: 'card-head' }, h('h2', null, 'Review lessons (KB)')));
  if (!lessons.length) {
    card.append(h('div', { class: 'empty' }, 'No lessons recorded.'));
    return;
  }
  const sorted = [...lessons].sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0));
  const maxOcc = Math.max(...sorted.map((l) => l.occurrences || 0), 1);
  card.append(
    dataTable(
      [{ label: 'Lesson' }, { label: 'Category' }, { label: 'Status' }, { label: 'Occurrences', num: true }],
      sorted.map((l) => {
        const bar = h('span', { class: 'mini-bar' });
        bar.style.width = Math.max(4, ((l.occurrences || 0) / maxOcc) * 70) + 'px';
        return [
          h('span', { title: l.rule || '' }, l.title || l.id),
          l.category || '—',
          l.status || '—',
          h('span', null, bar, ' ', String(l.occurrences ?? 0)),
        ];
      }),
    ),
  );
  card.append(h('div', { class: 'footnote' }, 'Cumulative registry — not affected by the period filter. Hover a lesson for its full rule.'));
}
