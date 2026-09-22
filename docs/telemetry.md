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
2. Unless `--no-push`: checks that `develop` is checked out, fetches
   `origin/develop`, and refuses when local `develop` is behind it ("pull
   first") or has unpushed commits that are not telemetry records. A repair
   never publishes someone's unpushed work.
3. Asks `gh` once for the issue's title, URL and the merged PR that closes it.
   Without `gh`, the committed `meta.json` entry is kept and the script says so.
   A `meta.json` that does not parse is an error; it is never rewritten.
4. Runs the exporter (`public/build/data.json`, not committed) and a structural
   check: every dataset has one array per JSONL file, each count matches its
   rows, no JSONL line was skipped as unparseable, and the site dataset holds
   the issue's task record. A failed check → exit 1; nothing is written or
   committed. Only after the check passes is `meta.json` written.
5. Stages `data/build/site/` and `reports/issue-<n>.md`. If something changed,
   it commits only those paths, with the same author and message format as the
   runner. Other staged work is left alone.
6. Unless `--no-push`: pushes `HEAD` to `develop` when it is ahead of
   `origin/develop`. That includes a record commit whose push failed on an
   earlier run.

When nothing changed and nothing is waiting to be pushed, it prints
`already recorded: #<issue> attempt <n>` and exits 0. Running it twice for the
same issue and attempt changes nothing the second time. With `--no-push` the
commit stays local; a later run without `--no-push` pushes it.

Exit codes: `0` recorded, pushed or already recorded, `1` failed, `2` usage error.

The dry-run test is `scripts/record-run.test.mjs` (in `npm run test:data`). It
runs the script against a throwaway git repository seeded from
`tests/fixtures/record-run/`, with `gh` stubbed. Pushes go only to a local
bare repository that stands in for `origin`.

## README paragraph

> Commits authored by *tr-harness telemetry* are automated records of runs, not
> code changes.
