# エージェント向け手順

## Agent skills

### Issue tracker

このリポジトリの GitHub Issues で管理する。`gh` CLI を使う。詳細は `docs/agents/issue-tracker.md`。

### Triage labels

5 つの canonical triage role と、GitHub 上の label 文字列が 1:1（デフォルト）。詳細は `docs/agents/triage-labels.md`。

### Domain docs

Single-context: ルートの `CONTEXT.md` と `docs/adr/`。詳細は `docs/agents/domain.md`。

### Code review

コードレビュー時は通常のバグ・退行・テスト不足に加えて、`docs/agents/code-review.md` のアーキテクチャ境界と命名規約を確認する。
