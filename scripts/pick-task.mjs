// Which task record stands for an issue: the requested attempt, else the
// latest one; a re-recorded attempt resolves to its newest record. Shared by
// record-run.mjs (the telemetry commit) and src/build/readme.ts (the README
// run table), so both always name the same record. Plain JS so record-run
// runs without Node's type stripping.

/** Milliseconds of a record's `ts`; timestamps carry a local UTC offset, so
 * compare them as dates. A `ts` that does not parse sorts as the oldest. */
export const taskTime = (/** @type {{ ts: string }} */ t) => Date.parse(t.ts) || 0;

/**
 * @template {{ issue: number, attempt?: number, ts: string }} T
 * @param {readonly T[]} tasks
 * @param {number} issue
 * @param {number | null} [attempt]
 * @returns {T | null}
 */
export function pickTask(tasks, issue, attempt = null) {
  const mine = tasks.filter((t) => t?.issue === issue && (attempt === null || t.attempt === attempt));
  return mine.sort((a, b) => (b.attempt ?? 0) - (a.attempt ?? 0) || taskTime(b) - taskTime(a))[0] ?? null;
}
