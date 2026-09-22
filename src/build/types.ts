// Payload written by scripts/export-build-data.mjs to public/build/data.json.
// Hand-written from docs/tr-harness.md → "Output files". Field names are the
// JSONL names as recorded, so the renderer reads them without a mapping layer.
//
// Real vs. estimated: `billed_cost_usd` is the authoritative task cost;
// every `est_cost_usd` is an apportionment of it by output-token share and
// must be labelled as an estimate wherever it is shown.

export type Outcome = 'ok' | 'incomplete' | 'failed';

export type PhaseName = 'read' | 'branch' | 'implement' | 'build+test' | 'pr' | 'review' | 'merge';

export interface Findings {
  critical: number;
  high: number;
  medium: number;
  low: number;
  style: number;
}

/** Per-cycle findings add the derived `blocker` (critical + high) and `total`. */
export interface CycleFindings extends Findings {
  blocker: number;
  total: number;
}

/** The fixer's adjudication of every deduped finding; sums to `findings.total`. */
export interface Dispositions {
  fixed: number;
  rejected_intentional: number;
  rejected_wrong: number;
  deferred: number;
}

export interface Phase {
  phase: PhaseName;
  duration_sec: number;
  out_tokens: number;
  in_tokens: number;
  turns: number;
  tool_calls: number;
  peak_ctx_tokens: number;
  /** Estimate, not a bill. */
  est_cost_usd: number;
}

/** Task-level review summary; `null` on a task if no cycle reported. */
export interface Review {
  cycles_run: number;
  max_cycles: number;
  total_review_sec: number;
  total_fix_sec: number;
  findings_total: Findings;
  /** Absent on older records, `null` when no cycle reported dispositions. */
  dispositions_total?: Dispositions | null;
}

export interface ReviewCycle {
  issue: number;
  attempt: number;
  ts: string;
  review_cycle: number;
  max_cycles: number;
  findings: CycleFindings;
  /** `null` on cycles that never reported; absent on pre-tracking records. */
  dispositions?: Dispositions | null;
  /** How `findings` was counted; absent on older records. */
  findings_source?: 'marker' | 'review-file' | 'none';
  review_sec: number | null;
  /** `null` when the cycle was clean and exited without fixing. */
  fix_sec: number | null;
  cycle_sec: number | null;
  out_tokens: number;
  in_tokens: number;
  review_out_tokens: number;
  fix_out_tokens: number;
  turns: number;
  tool_calls: number;
  /** Estimate, not a bill. */
  est_cost_usd: number;
}

export interface Task {
  issue: number;
  attempt: number;
  ts: string;
  outcome: Outcome;
  /** Run mode; absent on older records. */
  mode?: string;
  /** Parent epic for subtask runs, 0 otherwise; absent on older records. */
  epic_issue?: number;
  tier?: string;
  model_asked: string;
  model_ran: string;
  total_sec: number;
  /** Authoritative billed cost for the whole run. */
  billed_cost_usd: number;
  phases: Phase[];
  review: Review | null;
  review_cycles: ReviewCycle[];
}

export interface Epic {
  record: 'epic';
  ts: string;
  epic: number;
  branch: string;
  children: number[];
  child_total: number;
  child_ok: number;
  outcome: Outcome;
  wall_sec: number;
  billed_cost_usd: number;
  /** True when some child costs were not captured. */
  billed_partial: boolean;
  finalize_review: {
    cycles_run: number;
    blockers_fixed: number;
    findings_total: Findings;
  };
}

export type LessonStatus = 'candidate' | 'active' | 'graduated' | 'retired';

export type LessonSeverity = 'critical' | 'high' | 'medium';

export interface Lesson {
  id: string;
  title: string;
  category: string;
  rule: string;
  rationale: string;
  severity: LessonSeverity;
  status: LessonStatus;
  occurrences: number;
  source_issues: number[];
  /** Stripped from the frozen toprope snapshot at export time. */
  file_globs?: string[];
  first_seen: string;
  last_seen: string;
}

export interface FileInfo {
  count: number;
  /** Unparseable lines skipped by the tolerant reader. */
  skipped: number;
  /** ISO time; `null` when the file does not exist. */
  mtime: string | null;
}

export interface IssueMeta {
  title: string;
  url: string;
  pr: number | null;
  prUrl: string | null;
}

export interface Dataset {
  label: string;
  frozen: boolean;
  files: {
    tasks: FileInfo;
    reviewCycles: FileInfo;
    epics: FileInfo;
    lessons: FileInfo;
  };
  tasks: Task[];
  reviewCycles: ReviewCycle[];
  epics: Epic[];
  lessons: Lesson[];
  /** Site dataset only, keyed by issue number. */
  meta?: Record<string, IssueMeta>;
}

export interface Payload {
  generatedAt: string;
  datasets: {
    site: Dataset;
    toprope: Dataset;
  };
}
