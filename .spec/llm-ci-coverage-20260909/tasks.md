# LLM resilience tests in normal CI

## Scope and acceptance

- [x] Reproduce that the two standalone resilience/timeout scripts are excluded by the existing Vitest discovery pattern.
- [x] Replace those scripts with named Vitest tests covering error classification, retry decisions and limits, provider errors, successful requests, timeout cancellation, and network errors.
- [x] Control clocks and randomness; tests use injected fetch implementations and make no provider calls.
- [x] Keep runtime code, dependency manifests/locks, and the sample-format eval reports unchanged.
- [x] Run the focused suites, the full frontend suite, and the existing CI type/build gates.
- [x] Review the patch for an isolated reviewable commit; no push or main-branch merge in this task.

## Evidence boundaries

These are local automated regression tests, not production reliability statistics or model-quality evaluations. Native Tauri transport, live providers, paid evals, and desktop packaging remain outside this test-only change.
