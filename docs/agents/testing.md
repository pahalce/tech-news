# テスト方針

このリポジトリのテストは、外部から観測できる振る舞いを仕様として固定する。private helper や内部の呼び出し順ではなく、domain object の不変条件、use case の入力と出力、adapter の変換結果、workflow の状態遷移を検証する。

## 配置

テストは原則として対象ファイルと同じ layer に colocate する。

```txt
src/modules/article/
  domain/
    current-feed-candidate.ts
    current-feed-candidate.test.ts
  application/
    collect-current-feed-candidates-use-case.ts
    collect-current-feed-candidates-use-case.test.ts
  infrastructure/
    zenn-rss-feed-reader.ts
    zenn-rss-feed-reader.test.ts
```

広い `src/modules/<module>/<module>.test.ts` に domain / application / infrastructure のテストをまとめない。複数 layer をまたぐ仕様は、まず layer ごとに分けられないか確認し、本当に workflow の仕様なら `src/workflows/*-workflow.test.ts` に置く。

## Layer ごとの観点

`domain/` tests:

- entity / value object の constructor や parser が不正データを拒否すること
- canonicalization、ID derivation、重複排除、score calculation など pure domain rule
- 同じ入力なら同じ出力になる deterministic behavior

`application/` tests:

- use case が domain function と port/callback をどう組み合わせるか
- 部分失敗と全体失敗の区別
- raw JSON や adapter details に依存しない orchestration behavior

`infrastructure/` tests:

- RSS、filesystem、Discord、LLM など外部境界の response shape を domain input へ変換すること
- malformed response、HTTP error、missing field など adapter failure
- 実ネットワークや実サービスに依存しない local fake / fixture

`workflows/` tests:

- 複数 module をつなぐ end-to-end の状態遷移
- **Agent State** の読み込み、検証済み slice の合成、最後の persist までの順序

## 書き方

- 1テストは1つの振る舞いを説明する。
- テスト名は「〜したとき、〜となる」形式を優先する。
- Arrange / Act / Assert をコメントで分ける。
- 共通 fixture は、読みやすさが明確に上がる場合だけ使う。
- bug fix では、まず再発を示すテストを追加してから実装を直す。
