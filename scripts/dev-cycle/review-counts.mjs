#!/usr/bin/env node
// review-counts.mjs — count findings in a multi-lens review file by severity.
//
// Usage: node scripts/dev-cycle/review-counts.mjs reviews/issue-3-multi-pass-1.md
// Prints one JSON object: {"critical":0,"high":1,"medium":9,"low":19,"style":0,"total":29}
//
// The runner (tr-harness.ps1) uses this as a fallback when a review cycle ends
// without a `DEVCYCLE_METRIC: review_done` marker from the agent, so the run
// record never shows "0 findings" for a review that found things. Counts are
// RAW: every finding ID (SO-1, SEC-2, OR-3, TST-4, DUP-5 ...) listed under a
// lens's Critical / High / Medium / Low / Style bucket, across all lenses. The
// lenses do not dedup, so this is an upper bound on the deduped count the
// marker would carry. "Out-of-diff observations" and "Net assessment" are not
// findings and are never counted.
//
// The lenses write their sections in one of three layouts; all are handled:
//   ### Medium                     ### Low / Style                Low: SO-1 ... SO-2 ...
//   #### SO-1. Title               - SO-1. Title                  Critical/High/Medium: _None._
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BUCKETS = ['critical', 'high', 'medium', 'low', 'style'];
const ID = /\b([A-Z]{2,4}-\d+)\b/g;

function bucketOf(label) {
  const name = label.trim().toLowerCase();
  if (name.startsWith('low')) return 'low';              // "Low / Style"
  return BUCKETS.includes(name) ? name : null;           // anything else (Out-of-diff, Net) is not a bucket
}

export function countFindings(text) {
  const seen = new Map();                                 // id -> bucket (first sighting wins)
  let bucket = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s/.test(line)) { bucket = null; continue; }  // new lens section resets the bucket
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) { bucket = bucketOf(h3[1]); continue; }

    // Compact layout: "Low: SO-1 ... SO-2 ..." or "Critical/High/Medium: _None._"
    const compact = line.match(/^([A-Za-z/ ]{3,30}):\s+(.*)$/);
    if (compact && !/^(out-of-diff|net)/i.test(compact[1])) {
      const labels = compact[1].split('/').map(bucketOf).filter(Boolean);
      if (labels.length) {
        if (labels.length === 1) for (const m of compact[2].matchAll(ID)) if (!seen.has(m[1])) seen.set(m[1], labels[0]);
        continue;                                          // multi-label lines are "_None._" by construction
      }
    }

    // Bucketed layout: a finding starts a "####" heading or a "- " bullet with its ID.
    if (bucket) {
      const m = line.match(/^(?:#{4,}\s+|[-*]\s+)\**([A-Z]{2,4}-\d+)/);
      if (m && !seen.has(m[1])) seen.set(m[1], bucket);
    }
  }
  const counts = { critical: 0, high: 0, medium: 0, low: 0, style: 0 };
  for (const b of seen.values()) counts[b]++;
  counts.total = BUCKETS.reduce((n, b) => n + counts[b], 0);
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) { console.error('usage: review-counts.mjs <review-file.md>'); process.exit(2); }
  process.stdout.write(JSON.stringify(countFindings(readFileSync(file, 'utf8'))) + '\n');
}
