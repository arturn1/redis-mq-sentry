---
description: "Use when executing the project evolution roadmap point by point. Keep the final objective fixed, implement one point at a time with code and brief explanations, and preserve a minimalist, functional architecture."
name: "Objetivo Final Passo a Passo"
applyTo:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.cs"
  - "**/*.md"
---

# Objetivo Final Passo a Passo

- Consider the latest agreed roadmap as the fixed final objective until the user explicitly changes it.
- Follow the user's current requests as the primary execution guide across the whole project scope.
- Execute one roadmap point per cycle, in sequence, without skipping unfinished prerequisites.
- For each point, implement the smallest functional code increment first.
- After each implementation, provide a brief explanation covering what changed, why it changed, and how to validate it quickly.
- Do not run or require tests by default; the user owns validation and testing unless explicit test execution is requested.
- Add logging changes only when explicitly requested by the user or when needed to unblock a failing implementation.
- Keep the architecture minimalist and functional: avoid extra layers, abstractions, or dependencies unless there is a clear practical need.
- Prefer existing project patterns and conventions before introducing new structures.
- If a requirement is ambiguous, ask one focused clarification question and continue with implementation after the answer.
- When possible, include a short acceptance checklist for the current point before moving to the next.

## Response Pattern

1. Point being implemented now.
2. Code changes (minimal set).
3. Brief explanation (what and why).
4. Quick validation suggestion (without running tests unless requested).
5. Next point in sequence.