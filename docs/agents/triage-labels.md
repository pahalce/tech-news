# トリアージ用ラベル

Skills は 5 つの canonical triage role を使う。このファイルは各 role を、このリポジトリの issue tracker で実際に使う label 文字列に対応付ける。

| mattpocock/skills 側の label | このリポジトリの label | 意味 |
| ---------------------------- | ---------------------- | ---- |
| `needs-triage`               | `needs-triage`         | メンテナがこの issue を評価する必要がある |
| `needs-info`                 | `needs-info`           | 報告者からの追加情報待ち |
| `ready-for-agent`            | `ready-for-agent`      | 仕様が揃っており、AFK エージェントがそのまま取りにいける |
| `ready-for-human`            | `ready-for-human`      | 人間による実装が必要 |
| `wontfix`                    | `wontfix`              | 対応しない |

skill が role に言及したとき（例: 「AFK-ready の triage label を付ける」）、この表の「このリポジトリの label」列の文字列を使う。

右列を編集して、実際に使う語彙に合わせる。
