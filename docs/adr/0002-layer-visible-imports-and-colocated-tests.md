# Layer-Visible Imports And Colocated Tests

Superseded by ADR-0005 for the rebuilt `domains/` and `features/` architecture.

Module barrel `index.ts` files hide whether a dependency is on `domain`, `application`, or `infrastructure`, so this codebase does not use module barrels. Imports must name the concrete layer file, cross-module imports target `application/` use cases by default, and tests live beside the layer they specify so architecture review can see both the dependency direction and the behavioral contract being protected.

## Considered Options

- Keep module barrel `index.ts` files as public APIs. This hides layer ownership at call sites and makes reviews ask "what did this import really couple to?"
- Use layer-visible imports while allowing any cross-module layer. This keeps paths explicit but still permits domain-to-domain coupling between modules.
- Use layer-visible imports and restrict cross-module coupling to `application/` use cases by default. This is the chosen approach.

## Decision

`src/modules/<module>/index.ts` barrel files are not allowed. A module import must show the target layer in its path, such as `../article/application/collect-current-feed-candidates-use-case`, `../article/domain/current-feed-candidate`, or `../article/infrastructure/zenn-rss-feed-reader`.

Cross-module imports target `application/` files by default. Same-module imports may cross from `application/` or `infrastructure/` into `domain/`, but `domain/` may only import same-module `domain/` code. `workflows/` may import module `application/` files and concrete `infrastructure/` adapters when wiring runtime behavior. `agent-state/infrastructure` is a narrow exception: it may import other modules' domain codecs and infrastructure loaders to assemble persisted **Agent State** slices.

Tests are colocated with the layer they specify:

- `domain/*.test.ts` covers domain model validation, value normalization, pure policies, and entity operations.
- `application/*-use-case.test.ts` covers orchestration behavior, failure handling, and interactions through ports or callback interfaces.
- `infrastructure/*.test.ts` covers adapter parsing, config, protocol mapping, and external response shape handling with local fakes.
- Cross-layer workflow tests belong under `workflows/` when a complete workflow path exists.

## Consequences

Architecture check enforces the import matrix and rejects module barrel files. Reviewers should reject new tests that collect unrelated layer behavior into a broad module-level test file when a colocated layer test would make the contract clearer.
