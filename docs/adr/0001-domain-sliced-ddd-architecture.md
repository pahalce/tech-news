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

`jobs/` contains thin Flue entrypoints. `workflows/` contains cross-module orchestration. `modules/` contains domain capabilities. Each module exposes its public API through `index.ts`; other modules must not deep-import from another module's `domain/`, `application/`, or `infrastructure/` directories.

Application services are named `*-use-case.ts`. Domain services are pure domain decisions in `domain/`, named either by the decision they make or `*-service.ts` when they coordinate multiple domain objects. Infrastructure adapters live beside the module that needs them; shared low-level clients may live in `shared/infrastructure/`, but prompts, policies, and domain decisions stay in the owning module.

`feature` owns **Feature Vocabulary Config** types, validation, topic normalization, and read-only access used by prompts, validation, and **Rule Score**. `vocabulary-maintenance` owns review workflows for **Unknown Topic**, **Other Signals**, and **Vocabulary Promotion Candidates**, but it proposes changes through the `feature` public API instead of owning the vocabulary schema or normalization rules.

The `publish-recommendations-workflow` is source-agnostic. Zenn is an article feed adapter, not part of the workflow name. The canonical flow is: load **Agent State**, read configured feeds, create **Current Feed Candidates**, resolve **Canonical URL** and **Article ID**, reuse or create **Feature Extraction**, exclude unreadable and already recommended articles, compute **Rule Score**, apply **LLM Rerank**, create **Recommendation Content**, publish recommendations, record **Publication Records** and **Recommended Articles**, then persist **Agent State** with one **Data Commit**.

## Consequences

`Agent State` owns persistence shape, schema versioning, JSON file mapping, and the final data commit. Each domain module owns its state slice types, invariants, update rules, and parse/serialize boundary for that slice. `agent-state` may import those public slice codecs through module `index.ts` to assemble versioned persisted state, but it must not duplicate slice invariants or update rules. Workflows compose validated slices and persist the resulting state, but they do not embed domain rules or compose raw JSON.

Boundary enforcement is an implementation requirement, not yet satisfied by this ADR alone. A follow-up change must add a project lint entrypoint that runs vite-plus `vp lint`, add `.oxlintrc.json` import restrictions for module deep imports, and add a small architecture check for source-dependent layer rules that `no-restricted-imports` cannot express cleanly. Until that follow-up lands, reviewers should treat boundary violations as manual review findings.
