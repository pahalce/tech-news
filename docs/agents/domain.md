# ドメイン文書

Engineering skills が codebase を調べるとき、このリポジトリのドメイン文書をどう読むか。

## 探索の前に読むもの

- リポジトリ直下の **`CONTEXT.md`**、または
- リポジトリ直下の **`CONTEXT-MAP.md`**（ある場合）— 各 context の `CONTEXT.md` への入口。今扱う話題に関係するファイルをすべて読む。
- **`docs/adr/`** — これから触る領域に関係する ADR を読む。multi-context のリポジトリでは、`src/<context>/docs/adr/` の context 単位の決定も確認する。

これらのファイルがなくても、**黙って続行**する。欠けている旨を指摘したり、先回りで作成を提案したりしない。用語や決定が実際に固まったときは、producer skill（`/grill-with-docs`）が必要に応じて遅延作成する。

## ファイル構成

Single-context のリポジトリ（ほとんどのリポジトリ）:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context のリポジトリ（ルートに `CONTEXT-MAP.md` がある）:

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← システム全体の決定
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context 固有の決定
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## 用語集の語彙を使う

出力で domain concept に名前を付けるとき（issue のタイトル、リファクタ案、仮説、テスト名など）、`CONTEXT.md` で定義された用語を使う。用語集が避けると明示している synonym には流れない。

必要な概念が用語集にまだない場合のサインとして、次のどちらかを考える: プロジェクトが使っていない言い方を自分で作っている（見直す）、または本当に穴がある（`/grill-with-docs` に記録する）。

## ADR との衝突を明示する

出力が既存の ADR と矛盾するときは、黙って上書きせず、はっきり指摘する:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
