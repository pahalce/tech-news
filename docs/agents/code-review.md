# コードレビュー規約

コードレビューエージェントは、通常のバグ・退行・テスト不足に加えて、このリポジトリ固有のアーキテクチャ境界を確認する。判断に迷う場合は、`CONTEXT.md` と `docs/adr/0001-domain-sliced-ddd-architecture.md` を優先する。

## 必ず読む文書

- `CONTEXT.md`
- `docs/adr/0001-domain-sliced-ddd-architecture.md`
- 変更対象に近い既存コード

## ディレクトリ境界

新しい実装は、原則として次の構成に従う。

```txt
src/
  jobs/
  workflows/
  modules/
    <module>/
      index.ts
      domain/
      application/
      infrastructure/
  shared/
    domain/
    application/
    infrastructure/
```

`src/modules/` に置く module は domain capability を表す。`llm`, `discord`, `zenn`, `http`, `file` のような技術名だけの module を追加している場合は、ドメイン境界を隠していないか指摘する。

`workflows/` は複数 module をまたぐ orchestration の置き場であり、`modules/` と同列に domain module として置かない。`jobs/` は Flue entrypoint と payload parsing 程度に薄く保つ。

## Module Public API

各 module は `src/modules/<module>/index.ts` を public API とする。他 module から次のような deep import をしている場合は指摘する。

```ts
import { FeatureExtraction } from "../feature/domain/feature-extraction";
import { OpenAIFeatureExtractor } from "../feature/infrastructure/openai-feature-extractor";
```

他 module からは原則として `index.ts` 経由で import する。

```ts
import type { FeatureExtraction } from "../feature";
```

同一 module 内で `domain/`, `application/`, `infrastructure/` を import するのは許容する。ただし依存方向の規約に従う。

## 依存方向

`domain/` は純粋な domain model, value object, policy, domain service を置く層である。`domain/` から `application/`, `infrastructure/`, 外部 SDK, filesystem, HTTP, Discord, LLM client を import している場合は指摘する。

`application/` は use case と port interface を置く層である。同一 module の `domain/` と、必要最小限の他 module public API に依存してよい。外部 I/O の具象実装を直接呼んでいる場合は、port を切るべきか確認する。

`infrastructure/` は同一 module の application port を実装する層である。外部 SDK, filesystem, HTTP, Discord, LLM client はここに置く。prompt, scoring policy, vocabulary rule, preference update rule などの domain decision が `infrastructure/` に入っている場合は指摘する。

`shared/` は本当に複数箇所で使う小さな横断部品だけに使う。`shared/infrastructure/openai-client.ts` のような低レベル client は許容するが、Feature Extraction, LLM Rerank, Recommendation Content の prompt や判断を shared に逃がしてはいけない。

## Application Service と Domain Service

Application service は `application/*-use-case.ts` と命名する。外部 I/O、port 呼び出し、処理順序、transaction-like な state composition を担当する。

Domain service は `domain/` に置き、純粋な domain decision だけを担当する。複数 domain object にまたがる判断なら `*-service.ts` を許容する。単一の計算や policy は `calculate-rule-score.ts`, `apply-reaction-feedback.ts` のように動詞で命名してよい。

`*-service.ts` が `application/` にあり、I/O orchestration をしている場合は `*-use-case.ts` へ改名を促す。`domain/*-service.ts` が port, adapter, filesystem, HTTP, Discord, LLM を直接呼んでいる場合は違反として指摘する。

## Agent State

永続化された JSON 状態は **Agent State** と呼ぶ。新しいコードやドキュメントで `Repository State` という旧名を使っている場合は指摘する。

`agent-state` module は state 全体の読み書き、schema version, JSON file mapping, Data Commit を担当する。各 domain module の state slice の型、不変条件、更新ルールを `agent-state` に集めている場合は指摘する。

正しい分担:

- `agent-state`: Agent State の保存形式、読み書き、Data Commit、versioned persisted state の組み立て
- 各 domain module: 自分の state slice の型、不変条件、更新ルール、parse/serialize boundary
- `workflows`: 各 module の public API を呼んで検証済み slice から次の Agent State を合成し、最後に persist する

`agent-state` は各 module の public API から slice codec を import してよい。`agent-state` が slice の不変条件を再実装している場合、または `workflows` が raw JSON を直接 composition している場合は指摘する。

## Feature Vocabulary Ownership

**Feature Vocabulary Config** の型、検証、topic normalization、prompt / validation / Rule Score から使う read-only access は `feature` module が所有する。

`vocabulary-maintenance` は **Unknown Topic**、**Other Signals**、**Vocabulary Promotion Candidates** のレビュー workflow を所有するが、vocabulary schema や normalization rule を所有しない。`vocabulary-maintenance` が vocabulary config の構造を直接解釈・更新している場合は、`feature` public API を経由させるよう指摘する。

## Recommendation Publication 用語

`Digest Generation` と `Discord Post Record` は旧語として扱う。新しいコードでは **Recommendation Content** と **Publication Record** を使う。

Discord は publication の infrastructure adapter であり、domain module 名に `discord` を使わない。Discord 固有の message id や API 呼び出しは `publication/infrastructure/` に置く。

Zenn は article feed adapter であり、workflow 名や job 名の中心に置かない。主 workflow/job は `publish-recommendations` とする。Zenn 固有処理は `article/infrastructure/` に置く。

## Publish Recommendations Workflow

`publish-recommendations-workflow` は source-agnostic に保つ。Zenn 専用 workflow に見える命名や分岐を入れている場合は指摘する。

canonical flow から外れる変更は、理由がコードや ADR に残っているか確認する。

```txt
1. Load Agent State
2. Read configured feeds
3. Convert feed entries into Current Feed Candidates
4. Resolve Canonical URL and Article ID
5. Reuse existing Feature Extraction when available
6. Fetch article body and create Feature Extraction for new readable candidates
7. Exclude unreadable articles and already Recommended Articles
8. Compute Rule Score
9. Apply LLM Rerank to select up to ten articles
10. Create Recommendation Content for selected articles
11. Publish recommendations through publication infrastructure
12. Record Publication Records and Recommended Articles
13. Persist Agent State with one Data Commit
```

## Lint と Architecture Check

`vp lint` が lint entrypoint である。`oxlint` を直接呼ぶ前提の script やドキュメントを追加している場合は指摘する。

現時点では `.oxlintrc.json` と `lint` script が未実装である。境界 enforcement を実装する変更では、`package.json` に `vp lint` を走らせる lint entrypoint を追加し、`.oxlintrc.json` で module deep import の禁止を表現することを確認する。

oxlint で表現しづらい source-dependent な layer 依存は小さな architecture check で補う。境界違反を「レビューで気をつける」だけにしている変更は、lint または check で検出できる形にできないか確認する。

## レビュー時の指摘例

- 他 module の `domain/` を deep import しているため、module public API 境界を破っている。
- Application service が `*-service.ts` と命名されており、use case と domain service の区別が曖昧になっている。
- Domain service が OpenAI client を直接呼んでおり、domain が infrastructure に依存している。
- Discord 固有の module を追加しており、publication domain と infrastructure adapter の境界が崩れている。
- Agent State に preference update rule を集めており、state slice の rule owner が `preference` module から漏れている。
