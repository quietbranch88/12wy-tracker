# Evidence audit

- Date: 2026-09-09.
- Base: `origin/main` at `75337559a2008899ba8a1e36833e3fc4a0675586`.
- Work is isolated on `codex/public-evidence-repair-20260909`.
- `app/vitest.config.ts` includes only `src/**/*.test.ts`; the standalone `__test_resilience.ts` and `__test_client_timeout.ts` scripts do not match.
- `.github/workflows/ci.yml` runs `npx vitest run`, with no separate invocation of those scripts.
- Follow-up inspection found `__test_parse.ts` and `__test_i18n_llm.ts` were also undiscovered. No normal test called `parsePriorityResponse`; the existing i18n suite checked key parity but did not check nonempty LLM messages or retry interpolation. Their valid contracts were therefore migrated too.
- `eval/reports/latest.json` identifies itself as `sample-format`. It is not provider-backed evidence and will not be regenerated or relabeled.

## Verification performed

All commands below ran locally on Windows from this isolated worktree on 2026-09-09, using the committed lockfile (`npm ci --no-audit --no-fund`: 117 packages installed). Shell invocations used the workstation's `rtk` wrapper.

| Check | Result |
| --- | --- |
| Baseline: `npm test -- src/llm/__test_resilience.ts src/llm/__test_client_timeout.ts` | Expected exit 1: `No test files found`; neither script matched `src/**/*.test.ts`. |
| Replacement: `npm test -- src/llm/resilience.test.ts src/llm/clientHelpers.test.ts` | Exit 0; 2 files, 43 tests passed. |
| Remaining baseline: `npm test -- src/llm/__test_parse.ts src/__test_i18n_llm.ts` | Expected exit 1: `No test files found`. |
| Parser/i18n replacement: `npm test -- src/llm/parse.test.ts src/i18n.test.ts` | Exit 0; 2 files, 17 tests passed, including the existing 5 i18n tests. |
| Final full suite: `npm test` | Exit 0; 10 files, 92 tests passed, including all four migrated areas. |
| Existing CI type gate: `npx tsc --noEmit` | Exit 0; no TypeScript errors. |
| Test-file type check: `npx tsc --noEmit --target ES2020 --module ESNext --moduleResolution bundler --lib ES2020,DOM,DOM.Iterable --strict --skipLibCheck src/llm/resilience.test.ts src/llm/clientHelpers.test.ts src/llm/parse.test.ts src/i18n.test.ts` | Exit 0; all four changed test files also type-check (the normal app tsconfig excludes `*.test.ts`). |
| Existing CI build gate: `npm run build` | Exit 0; TypeScript and Vite build passed, 78 modules transformed. |
| Whitespace: `git diff --check` | Exit 0. |

Build emitted two nonfatal notices about `profile.ts` and `db.ts` being both statically and dynamically imported. Those runtime modules and their import sites are unchanged by this patch.

## Review

- All four historical standalone scripts are replaced by tests matching the existing CI discovery pattern; no workflow override or weakened test gate is needed.
- Existing classifications, retry eligibility and response error cases are preserved as named tests. Retry cap/budget boundaries, non-network TypeErrors, cleaned error detail and timer cleanup receive explicit regression coverage.
- Jitter is controlled with restored `Math.random` spies. Timeout tests use fake timers, attach rejection handlers before advancing time, and verify no early cancellation. A completed or failed request does not get aborted later by a leftover timer.
- Fetch is injected. No HTTP request, provider credential, user dataset, or paid model invocation is involved.
- Parser tests cover valid/fenced JSON, optional fields, invalid output, recovery before truncation, and ignoring malformed entries. The i18n tests cover nonempty LLM messages and retry interpolation in Chinese, English, and French.
- The patch changes only the four test migrations and this task's three spec files. It leaves runtime code, manifests, lockfiles, workflow definitions, sample eval reports, and the original checkout's dirty files untouched.

## Limits

The passing suite is local Node/Vitest evidence. Hosted GitHub Actions has not run this patch yet. Native Tauri HTTP behavior, live providers, desktop installers, real-user outcomes and model quality were not exercised. The eval report remains sample-format evidence only.
