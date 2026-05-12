# Domain-Sliced DDD Architecture

We will organize the agent around domain modules under `src/modules/*/{domain,application,infrastructure}` rather than top-level technical layers or job-shaped modules. This keeps the ubiquitous language visible in the code, colocates each capability's rules with its use cases and adapters, and prevents scheduled jobs from owning domain decisions.

## Considered Options

- Top-level `domain/`, `application/`, `infrastructure/`, `ports/`, and `adapters/` directories. This follows Clean Architecture mechanically, but scatters one capability across the tree.
- Job-shaped modules such as `zenn-digest` or technology-shaped modules such as `llm` and `discord`. These make entrypoints or integrations too central and hide the domain boundaries.
- Domain-sliced modules with local layers. This is the chosen structure.

## Decision

The main source tree will use this shape:

```txt
src/
  jobs/
    publish-recommendations.ts
    collect-feedback.ts
    suggest-feature-vocabulary.ts

  workflows/
    publish-recommendations-workflow.ts
    collect-feedback-workflow.ts
    suggest-feature-vocabulary-workflow.ts

  modules/
    article/
      domain/
      application/
      infrastructure/
    feature/
      domain/
      application/
      infrastructure/
    recommendation/
      domain/
      application/
      infrastructure/
    recommendation-content/
      domain/
      application/
      infrastructure/
    publication/
      domain/
      application/
      infrastructure/
    preference/
      domain/
      application/
      infrastructure/
    agent-state/
      domain/
      application/
      infrastructure/
    vocabulary-maintenance/
      domain/
      application/
      infrastructure/

  shared/
    domain/
    application/
    infrastructure/
```

`jobs/` contains thin Flue entrypoints. `workflows/` contains cross-module orchestration. `modules/` contains domain capabilities. Modules do not expose barrel `index.ts` files. Imports must name the concrete layer file (`domain/`, `application/`, or `infrastructure/`) so ownership remains visible at the call site.

Cross-module imports target `application/` files by default. This keeps other modules coupled to use cases rather than to another module's domain model or adapter details. `workflows/` may import module `application/` files and, when wiring concrete runtime behavior, module `infrastructure/` adapters. The `agent-state` infrastructure is the narrow exception: it may import other modules' domain codecs and infrastructure loaders to assemble persisted **Agent State** slices.

Application services are named `*-use-case.ts`. Domain services are pure domain decisions in `domain/`, named either by the decision they make or `*-service.ts` when they coordinate multiple domain objects. Infrastructure adapters live beside the module that needs them; shared low-level clients may live in `shared/infrastructure/`, but prompts, policies, and domain decisions stay in the owning module.

`feature` owns **Feature Vocabulary Config** types, validation, topic normalization, and read-only access used by prompts, validation, and **Rule Score**. `vocabulary-maintenance` owns review workflows for **Unknown Topic**, **Other Signals**, and **Vocabulary Promotion Candidates**, but it proposes changes through `feature` application use cases instead of owning the vocabulary schema or normalization rules.

The `publish-recommendations-workflow` is source-agnostic. Zenn is an article feed adapter, not part of the workflow name. The canonical flow is: load **Agent State**, read configured feeds, create **Current Feed Candidates**, resolve **Canonical URL** and **Article ID**, reuse or create **Feature Extraction**, exclude unreadable and already recommended articles, compute **Rule Score**, apply **LLM Rerank**, create **Recommendation Content**, publish recommendations, record **Publication Records** and **Recommended Articles**, then persist **Agent State** with one **Data Commit**.

## Consequences

`Agent State` owns persistence shape, schema versioning, JSON file mapping, and the final data commit. Each domain module owns its state slice types, invariants, update rules, and parse/serialize boundary for that slice. `agent-state` may import those concrete slice codecs and loaders directly from the owning module's layer files to assemble versioned persisted state, but it must not duplicate slice invariants or update rules. Workflows compose validated slices and persist the resulting state, but they do not embed domain rules or compose raw JSON.

Boundary enforcement is implemented through the Vite+ `lint` block in `vite.config.ts`, the `vp lint` package script, and `scripts/check-architecture.ts`. Oxlint handles broad import restrictions and cycle checks; the architecture check handles source-dependent layer rules that `no-restricted-imports` cannot express cleanly.
