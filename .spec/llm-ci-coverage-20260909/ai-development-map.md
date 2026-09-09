# LLM CI coverage development map

## Authoritative sources

1. `tasks.md` for acceptance and scope.
2. `audit.md` for the verified baseline and execution evidence.
3. `app/vitest.config.ts` and `.github/workflows/ci.yml` for CI integration.

## Implementation

- Runtime (read only): `app/src/llm/resilience.ts`, `clientHelpers.ts`, and `guardrails.ts`.
- Tests: replace `app/src/llm/__test_resilience.ts` with `resilience.test.ts`; replace `__test_client_timeout.ts` with `clientHelpers.test.ts`.
- Integration: both replacement files match the existing Vitest include pattern and therefore execute in the existing CI test step.
- No architecture decision or new dependency is needed.

## Verification

From `app/`:

```text
npm test -- src/llm/__test_resilience.ts src/llm/__test_client_timeout.ts
npm test -- src/llm/resilience.test.ts src/llm/clientHelpers.test.ts
npm test
npx tsc --noEmit
npm run build
```

The first command is expected to show the baseline discovery gap. No production edit is required. Provider evaluation would require separate credentials/network calls and is outside this change. Preserve the original checkout's unrelated deletions and do not stage generated artifacts.
