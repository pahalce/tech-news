# Agent docs

このディレクトリは、agent / skill / subagent が共有する運用ドキュメントの入口である。

## Documents

- `issue-tracker.md`: GitHub Issues の作成、閲覧、コメント、ラベル操作。
- `triage-labels.md`: canonical triage role と GitHub label の対応。
- `domain.md`: `CONTEXT.md` と ADR を読むための方針。
- `testing.md`: layer ごとのテスト配置とテスト設計方針。
- `code-review.md`: このリポジトリ固有のコードレビュー観点。

## Subagent definitions

このリポジトリでは、agent 向けドキュメントを Codex と Cursor の subagent として使えるようにしている。

## Source of truth

共通の編集元は `.agents/agents/*.agent.md`。

この形式は Markdown body と YAML frontmatter を持つ。`name` と `description` は必須。ターゲットごとにモデルを分けたい場合は `cursor_model` と `codex_model` を指定する。共通モデルだけでよい場合は `model` を使える。

モデル方針:

- 重い判断をする `code-reviewer` と `domain-architect` は、Codex では `gpt-5.5`、Cursor では `composer-2` を使う。
- 軽い運用寄りの `issue-manager` と `triage-coordinator` は、Codex では `gpt-5.4-mini`、Cursor では `auto` を使う。

## Generated targets

- Codex: `.codex/agents/*.toml`
- Cursor: `.cursor/agents/*.md`

手で同期先だけを編集しない。subagent を追加・変更するときは `.agents/agents/*.agent.md` を編集し、次を実行する。

```sh
pnpm sync:subagents
```

### Current subagents

- `issue-manager`: GitHub Issues の作成、閲覧、コメント、ラベル操作。
- `triage-coordinator`: canonical triage role と GitHub label の対応。
- `domain-architect`: `CONTEXT.md` と ADR を読んでドメイン語彙・決定を確認。
- `code-reviewer`: バグ、退行、テスト不足、アーキテクチャ境界、命名規約のレビュー。
