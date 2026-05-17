# コードレビュー規約

コードレビューエージェントは、通常のバグ・退行・テスト不足に加えて、このリポジトリ固有のアーキテクチャ境界を確認する。判断に迷う場合は、`CONTEXT.md`、`docs/adr/0004-new-ddd-architecture.md`、`docs/adr/0005-feature-aligned-functional-ddd-boundaries.md` を優先する。

## 必ず読む文書

- `CONTEXT.md`
- `docs/adr/0004-new-ddd-architecture.md`
- `docs/adr/0005-feature-aligned-functional-ddd-boundaries.md`
- `docs/agents/testing.md`
- 変更対象に近い既存コード

## ディレクトリ境界

新しい実装は次の構成に従う。

```txt
src/
  domains/
    article/
    digest/
    preference/
  features/
    digest/
      application/
      infrastructure/
      presentation/
    feedback/
      application/
      infrastructure/
      presentation/
    article-feature-maintenance/
      application/
      infrastructure/
      presentation/
  jobs/
  shared/
    domain/
    application/
    infrastructure/
```

`domains/` は純粋な business model、`features/` は runtime feature である。`modules/` や `workflows/` を復活させている場合は指摘する。

## Import Boundary

internal import は `src/...` の非相対 import を使う。`../` や `@/` alias を使っている場合は指摘する。

Feature は他 feature を import しない。同じ domain 型が必要なら `domains/*` を参照し、外部能力が必要なら自 feature の application port を定義する。

`domain/` は `features/`, `jobs/`, `shared/application`, `shared/infrastructure` に依存しない。filesystem、HTTP、Discord、LLM client、repository 実装を import している場合は違反である。

同一 domain 内の private module import は許可する。外部 layer から domain へ入る import と cross-domain import は `src/domains/*/index.ts` 経由に限定する。

`features/*/application` は domain と port orchestration を担当し、infrastructure adapter を直接 import しない。`features/*/presentation` は CLI/GitHub Actions entrypoint と runtime wiring を担当する。

`jobs/` は薄い process entrypoint として feature presentation を呼ぶだけにする。

`features/*/presentation` は composition root であり、file repository、Discord adapter、LLM adapter、HTTP/RSS adapter などを use case に注入するだけにする。Discord message formatting、reaction fetch、LLM prompt/schema、HTML/RSS fetch、JSON persistence の実装が presentation にある場合は違反として指摘する。

`features/*/application/*-job.ts` と `features/*/infrastructure/run-*-runtime.ts` は追加しない。job は `src/jobs` の process entrypoint、application は `run-*-use-case.ts`、infrastructure は目的別 adapter ファイルに分ける。`presentation` が `infrastructure/run-*-runtime` を re-export している場合は、見かけ上の境界だけで実質 `job -> infrastructure` になっているため指摘する。

## Domain Service

Domain service は `domains/*/*.service.ts` に置き、pure domain logic のみを担当する。Rule predicate は `*.rules.ts`、domain error union は `*.errors.ts` を使う。

Application service は `features/*/application/*-use-case.ts` を優先する。I/O、port 呼び出し、処理順序、transaction-like な state composition は application/presentation 側に置き、domain に漏らさない。

Use case は呼び出し元の巨大な inline object に実装を押し込ませない。外部能力は application port として型を定義し、実装は `features/*/infrastructure/*` の adapter factory に置く。presentation で許可される inline 実装は `now: () => new Date().toISOString()` のような小さな値提供に限る。

## 永続化

Repository は domain object ではなく application port である。JSON や将来の SQLite は infrastructure adapter として port の裏に置く。

ドメイン語彙では **Article Extraction Registry**、**Published Digest Registry**、**Preference Profile**、**Preference Summary History**、**Article Feature Suggestion History** を使う。広い **Agent State** を domain model として増やしている場合は指摘する。

## Article Feature Vocabulary

**Article Feature Vocabulary** は `domains/article` の概念である。語彙の読み込みは infrastructure、語彙の検証・topic normalization は domain に置く。

`article-feature-maintenance` feature は **Article Feature Promotion Candidate** と **Article Feature Suggestion History** を扱う。一般語の `vocabulary-maintenance` を新規追加している場合は、Article Feature に寄せられないか確認する。

## Test Placement

テストは対象 layer に colocate する。

- `domains/*/*.test.ts`: domain model validation, value normalization, pure rules, domain services
- `features/*/application/*.test.ts`: use case orchestration, failure handling, port interaction
- `features/*/infrastructure/*.test.ts`: adapter parsing, config, protocol mapping
- `features/*/presentation/*.test.ts`: runtime wiring and CLI-facing formatting

広い root-level test に複数 layer の仕様が混ざっている場合は、layer ごとに分けられないか指摘する。

## Lint と Architecture Check

`vp lint` が lint entrypoint である。`oxlint` を直接呼ぶ前提の script やドキュメントを追加している場合は指摘する。

source-dependent な layer 依存は `dependency-cruiser` で補う。境界違反を「レビューで気をつける」だけにしている変更は、dependency-cruiser または oxlint で検出できる形にできないか確認する。

dependency-cruiser では少なくとも `features/*/application/*-job.ts` と `features/*/infrastructure/run-*-runtime.ts` の復活を落とす。新しい崩れ方を見つけた場合は、レビューコメントだけで終わらせず、まず機械的に検出できる import/path rule を追加できないか検討する。
