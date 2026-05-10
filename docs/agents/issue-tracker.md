# GitHub での issue 管理

このリポジトリの issues と PRD は GitHub Issues で管理する。操作はすべて `gh` CLI を用いる。

## 運用

- **作成**: `gh issue create --title "..." --body "..."`。複数行の body は heredoc を使う。
- **閲覧**: `gh issue view <number> --comments`。必要に応じて `jq` で comments を絞り込み、labels も取得する。
- **一覧**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`。用途に応じて `--label` や `--state` のフィルタを付ける。
- **コメント投稿**: `gh issue comment <number> --body "..."`
- **ラベル付与 / 解除**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **クローズ**: `gh issue close <number> --comment "..."`

リポジトリは `git remote -v` から推測する。このクローン内で実行するとき、`gh` が自動で解決する。

## skill が「issue tracker に公開」と言うとき

GitHub issue を1件作成する。

## skill が「関連チケットを取得」と言うとき

`gh issue view <number> --comments` を実行する。
