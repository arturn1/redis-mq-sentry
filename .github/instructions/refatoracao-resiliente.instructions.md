---
description: "Use when refactoring, improving reliability, hardening error handling, or making changes that must not freeze, stop, or destabilize the app."
name: "Refatoracao Resiliente"
applyTo:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.cs"
---

# Refatoracao Resiliente

- Preserve existing behavior; make changes incrementally and keep them easy to revert.
- Prioritize resilience and reliability over cleverness.
- Handle errors explicitly and avoid unhandled exceptions that can crash a worker, request, or process.
- Validate inputs and boundaries early, especially in queue, API, and background-job flows.
- Prefer graceful degradation, retry-aware logic, and safe fallbacks when a dependency fails.
- Keep the code simple, readable, and free of unnecessary duplication.
- When a change touches a critical path, consider timeouts, retries, idempotency, concurrency, and recovery.
- If a change can affect stability, add or update a focused test for the failure path.