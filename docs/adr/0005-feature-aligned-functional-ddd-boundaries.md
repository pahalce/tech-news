# Feature-Aligned Functional DDD Boundaries

We will rebuild the source tree around functional DDD boundaries with `domains/article`, `domains/digest`, and `domains/preference`, and with runtime features `features/digest`, `features/feedback`, and `features/article-feature-maintenance`. The previous module split mixed domain concepts with processing steps, so the new shape keeps pure domain rules in `domains/*` and makes `features/*/application` thin orchestration over ports.

## Consequences

`Article Feature Vocabulary`, article feature extraction, extraction registries, and article feature suggestion history belong to the Article domain because they define how articles are analyzed. `Digest` owns recommendation candidates, digest items, recommendation content, published digest items, delivery references, digest selection policy, and the published digest registry. `Preference` owns preference profiles, preference summary history, reaction feedback, and feedback interpretation.

Domain services use `*.service.ts`, rule predicates use `*.rules.ts`, and domain errors use `*.errors.ts`. Repositories are application ports under each feature, not domain objects; JSON files and future SQLite storage are infrastructure adapters behind those ports. New architecture code uses non-relative `src/...` imports for internal dependencies; `@/...` aliases are avoided. Architecture enforcement is handled by dependency-cruiser for dependency graph boundaries and oxlint through Vite+ for lint rules; custom architecture scripts are avoided unless a rule cannot be expressed by those tools.
