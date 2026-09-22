// The homepage's one React island: the build-record card's live part. It is
// the only interactive, data-driven element on the page. Copy and numbers come
// in as props; this file holds no copy and reads no files.

import { useId, useState } from 'react';
import { fmtDur, fmtInt, fmtUsd } from '../build/format';
import type { BuildSummary } from '../build/summary';
import styles from './BuildRecord.module.scss';

export interface BuildRecordCopy {
  /** KPI labels in order: tasks, successful runs, findings, wall time, billed cost. */
  metrics: string[];
  cta: string;
  ctaHref: string;
  latest: string;
  pr: string;
  showRuns: string;
  hideRuns: string;
  runsCaption: string;
  columns: { issue: string; outcome: string; billed: string };
  empty: string;
}

interface Props {
  summary: BuildSummary;
  copy: BuildRecordCopy;
}

export default function BuildRecord({ summary, copy }: Props) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { latest, recent } = summary;
  // No runs at all: dashes, not zeros, as on the /build KPI row.
  const v = (s: string) => (latest ? s : '—');
  const values = [
    fmtInt(summary.tasksCompleted),
    fmtInt(summary.successfulRuns),
    fmtInt(summary.findings),
    fmtDur(summary.wallSec),
    fmtUsd(summary.billedUsd),
  ].map(v);

  return (
    <div className={styles.record}>
      <dl className={styles.metrics}>
        {copy.metrics.map((label, i) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{values[i]}</dd>
          </div>
        ))}
      </dl>
      {latest ? (
        <>
          <p className={styles.latest}>
            <span className={`mono-label ${styles.label}`}>{copy.latest}</span>{' '}
            {latest.url ? <a href={latest.url}>#{latest.issue}</a> : `#${latest.issue}`}
            {latest.title ? <> {latest.title}</> : null}
            {' · '}
            {latest.outcome}
            {latest.prUrl ? (
              <>
                {' · '}
                <a href={latest.prUrl}>
                  {copy.pr} #{latest.pr}
                </a>
              </>
            ) : null}
            {' · '}
            <time dateTime={latest.ts}>{latest.ts.slice(0, 10)}</time>
          </p>
          <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
            {open ? copy.hideRuns : copy.showRuns}
          </button>
          <table className={styles.runs} id={listId} hidden={!open}>
            <caption className="visually-hidden">{copy.runsCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{copy.columns.issue}</th>
                <th scope="col">{copy.columns.outcome}</th>
                <th scope="col">{copy.columns.billed}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={`${r.issue}-${r.attempt}`}>
                  <td>#{r.issue}</td>
                  <td>{r.outcome}</td>
                  <td>{fmtUsd(r.billedUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className={styles.latest}>{copy.empty}</p>
      )}
      <a className={`text-link ${styles.cta}`} href={copy.ctaHref}>
        {copy.cta}
      </a>
    </div>
  );
}
