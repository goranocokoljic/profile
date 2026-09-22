# Telemetry commits

Every harness run leaves a record in `data/build/site/`. The `/build` page and
the homepage build-record card are built from those files, so the records must
be committed and pushed for the site dataset to grow. This page is the contract
for those commits.

## The runner commits the record itself

`tr-harness.ps1` commits the run record after **every** attempt, whatever the
outcome (`Publish-Analytics` → `Publish-Files`, see [tr-harness.md](tr-harness.md)
→ "Analytics"). No extra step is needed to wire anything into the runner.

| | |
|---|---|
| Files | `data/build/site/tasks.jsonl`, `review-cycles.jsonl`, `epics.jsonl`, `review-lessons.jsonl`, `reports/issue-<n>.md` (files that do not exist are skipped) |
| Author and committer | `tr-harness telemetry <telemetry@tr-harness.noreply>` |
| Message | `chore(build): record run for #<issue> (attempt <n>, <outcome>, $<billed>)` |
| `<outcome>` | `ok`, `incomplete` or `failed`, from the task record |
| `<billed>` | `billed_cost_usd` of the task record, two decimals |
| Branch | `develop`, pushed |

The runner builds the commit with git plumbing against `origin/develop`, so the
checked-out branch and the working tree are never touched. When nothing differs
from `origin/develop`, it makes no commit. A push that fails is logged and the
record stays on disk. `-NoPublish` turns this off.

## Manual repair: `scripts/record-run.mjs`

Use this when the runner's commit is missing or incomplete (for example, a push
failed, or the run was made with `-NoPublish`), or to add an issue's title and
PR link to `data/build/site/meta.json`. It does not compete with the runner:
it commits only when something actually changed.

```
node scripts/record-run.mjs <issue> [--attempt n] [--no-push]
```

It does these steps, in order:

1. Finds the task record for `<issue>` in `data/build/site/tasks.jsonl`: the
   given `--attempt`, else the latest attempt. No record → exit 1.
2. Refreshes the entry for `<issue>` in `data/build/site/meta.json` via `gh`
   (title, issue URL, merged PR that closes it). Without `gh`, the committed
   entry is kept and the script says so.
3. Runs the exporter (`public/build/data.json`, not committed) and a structural
   check: every dataset has one array per JSONL file, each count matches its
   rows, and the site dataset holds the issue's task record. A failed check →
   exit 1, no commit.
4. Stages `data/build/site/` and `reports/issue-<n>.md`. If nothing changed, it
   prints `already recorded: #<issue> attempt <n>` and exits 0. Otherwise it
   commits only those paths, with the same author and message format as the
   runner. Other staged work is left alone.
5. Pushes `HEAD` to `develop`, unless `--no-push`. Without `--no-push` it
   refuses to start on any branch other than `develop`.

Running it twice for the same issue and attempt changes nothing the second
time. If the push fails, the commit stays local; push it by hand.

Exit codes: `0` recorded or already recorded, `1` failed, `2` usage error.

The dry-run test is `scripts/record-run.test.mjs` (in `npm run test:data`). It
runs the script against a throwaway git repository seeded from
`tests/fixtures/record-run/`, with `gh` stubbed and no push.

## README paragraph

> Commits authored by *tr-harness telemetry* are automated records of runs, not
> code changes.
