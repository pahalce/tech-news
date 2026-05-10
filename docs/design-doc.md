# Design Doc: Self-Evolving Zenn Digest Agent

## 概要

GitHub Actions 上で動く Flue agent を作る。毎日 Zenn のトレンド RSS と関心トピック RSS から記事を収集し、最大10本まで高品質な記事だけを Discord に投稿する。

また、前日に投稿した記事への Discord リアクションを収集し、ユーザーの好みプロファイルに反映する。これにより、使い続けるほど推薦品質がユーザー好みに近づく self-evolving な記事推薦 agent にする。

## ゴール

- Zenn の2軸フィードから記事を収集する。
  - トレンド: `https://zenn.dev/feed`
  - トピック:
    - `https://zenn.dev/topics/typescript/feed`
    - `https://zenn.dev/topics/react/feed`
    - `https://zenn.dev/topics/nextjs/feed`
    - `https://zenn.dev/topics/frontend/feed`
    - `https://zenn.dev/topics/backend/feed`
- 毎日最大10本まで推薦する。
- 良い記事が少ない日は10本未満でもよい。
- 各記事について以下を Discord に投稿する。
  - 80文字程度の簡単な要約
  - ユーザーに推薦する理由
  - 記事から得られる知見、学び
- Discord リアクションを好みフィードバックとして収集する。
- 今後、Zenn 以外の情報源や Discord 以外の通知先へ拡張しやすくする。
- LLM のモデルを環境変数で簡単に切り替えられるようにする。
- Vite+ を使って check/test/run の開発体験をまとめる。

## 非ゴール

- 初期バージョンで Web UI を作ること。
- 初日から完全なパーソナライズを実現すること。
- 初期バージョンで複雑なDB、ベクトル検索、RAG基盤を作ること。
- Zenn の全トピックを網羅すること。

## 実行スケジュール

処理は1日1回の単一ジョブではなく、日次の2つのタイミングと週次のメンテナンス通知に分ける。

### 08:00 JST: フィードバック収集

前日までに Discord に投稿した記事メッセージへのリアクションを収集し、`ユーザーの`プロファイルを更新する。

目的:

- 推薦実行の直前に、最新のユーザーフィードバックを取り込む。
- 記事収集・推薦処理と Discord リアクション取得処理を分離する。
- 失敗時の原因を分かりやすくする。

GitHub Actions cron:

```yaml
- cron: "0 23 * * *" # 08:00 JST
```

### 土曜 08:30 JST: 管理語彙昇格候補の通知

`other_signals` から管理語彙へ昇格できそうな候補を抽出し、Discord に通知する。

目的:

- 管理語彙を自動で増やしすぎず、手動レビューできるようにする。
- 日次フィードバック収集後の最新の反応を含めて候補を評価する。
- 09:00 の通常 digest とメンテナンス通知が混ざりすぎないようにする。

GitHub Actions cron:

```yaml
- cron: "30 23 * * 5" # 土曜 08:30 JST
```

### 09:00 JST: 記事収集・推薦・通知

Zenn RSS を収集し、好みプロファイルを使って記事を推薦し、Discord に投稿する。

GitHub Actions cron:

```yaml
- cron: "0 0 * * *" # 09:00 JST
```

## Tooling

Vite+ を基本の開発ワークフローとして使う。

- `vp install`
- `vp check`
- `vp test`
- `vp run collect-feedback`
- `vp run zenn-digest`
- `vp run suggest-feature-vocabulary`

Flue は agent runtime として使う。Vite+ は依存解決、check、test、script実行の体験をまとめるために使う。

## モデル方針

初期バージョンでは Gemini の無料枠モデルを使う想定にする。

## Discord フィードバック設計

Discord には、1記事につき1メッセージとして投稿する。

理由:

- リアクションがどの記事へのフィードバックなのか明確になる。
- 翌日のフィードバック収集で、message id と article id/url を対応させやすい。
- 記事ごとの評価履歴を保存しやすい。

リアクションの意味:

- `👍`: 好みに合った
- `👎`: 合わなかった

初期バージョンでは、好みフィードバックとして扱うリアクションは `👍` / `👎` のみにする。`🔖` のような「後で読む」系リアクションは、好みそのものではなく行動意図が混ざるため Preference Profile の更新には使わない。

## 永続化方針

初期バージョンでは外部DBを使わず、GitHub Actions の実行間で必要な状態をリポジトリ内の JSON ファイルとして保存する。

保存する主な状態:

- `data/preference-profile.json`: Owner の好みを表す Preference Profile
- `data/preference-summary-history.json`: 自然言語で解釈した好みの履歴
- `data/seen-articles.json`: 既出記事の article id、canonical URL、基本情報
- `data/feature-extractions/YYYY-MM-DD.json`: 各記事の Feature Extraction
- `data/digest-generations/YYYY-MM-DD.json`: 推薦記事の Discord 投稿用生成結果
- `data/discord-posts/YYYY-MM-DD.json`: Discord message id と記事URL / Feature Extraction の対応
- `data/vocabulary-suggestions/YYYY-MM-DD.json`: 管理語彙昇格候補の通知履歴

GitHub Actions は各 job の最後に、更新された `data/*.json` を1回だけコミットする。

コミットタイミング:

- `collect-feedback`: Preference Profile / summary history / discord-posts の更新後に1コミット
- `zenn-digest`: seen-articles / feature-extractions / digest-generations / discord-posts の更新後に1コミット
- `suggest-feature-vocabulary`: vocabulary-suggestions の保存後に1コミット

コミットメッセージ例:

```txt
chore(data): collect feedback for YYYY-MM-DD
chore(data): generate zenn digest for YYYY-MM-DD
chore(data): suggest feature vocabulary for YYYY-MM-DD
```

理由:

- 初期バージョンで複雑なDBや外部ストレージを持たない。
- 推薦やフィードバック更新の差分を Git の履歴として追える。
- 将来 DB に移行する場合も、JSON を移行元データとして使える。

### Preference Profile

`Preference Profile` は、Article Features ごとの数値重みを階層構造で保持する。

`feature_weights` の保存範囲は `-3.0` から `+3.0` とする。

- `+3`: 強く好む
- `+2`: 好む
- `+1`: やや好む
- `0`: 不明・中立
- `-1`: やや避けたい
- `-2`: 避けたい
- `-3`: 強く避けたい

初期 seed weights は `-1.0` から `+1.0` の範囲に収める。初期特徴量の具体的なセットは `config/feature-vocabulary.json` に、対応する seed weights は `data/preference-profile.json` に保存する。

リアクションによる更新後の値は `-3.0` から `+3.0` に clamp する。

初期 seed weights は、個人フィードバックが溜まる前の暫定的な初期嗜好として `data/preference-profile.json` に保存する。初期値は品質基準に沿って、以下の傾向を弱めに反映する。

- 実装ガイド、production事例、設計解説、障害・失敗からの学びを高めにする。
- コード例、計測結果、実運用経験、比較、失敗例を高めにする。
- 実行可能な手順、設計判断材料、運用に活かせる内容、再利用可能な実装パターンを高めにする。
- トレードオフ分析、深い技術解説、境界条件、制約説明を高めにする。
- 薄いニュース、広いだけのトレンド概説、表層的まとめ、汎用的なAI期待論を低めにする。
- beginner 向け記事は完全には除外せず、実務的な学びが少ない場合だけ弱く下げる。

例:

```json
{
  "feature_weights": {
    "topics": {
      "react": 2.4,
      "nextjs": 2.1,
      "typescript": 1.7
    },
    "content_types": {
      "production_case_study": 3.0,
      "implementation_guide": 2.2,
      "thin_news": -2.2
    },
    "evidence_signals": {
      "code_examples": 2.0,
      "measured_results": 1.8
    },
    "practical_signals": {
      "architecture_decision_support": 2.5,
      "operationally_applicable": 2.3
    },
    "depth_signals": {
      "surface_level_summary": -1.8,
      "tradeoff_analysis": 2.2
    },
    "title_signals": {
      "specific_problem": 1.2,
      "clickbait": -1.5
    }
  },
  "updated_at": "2026-05-10T00:00:00+09:00"
}
```

自然言語の好みサマリは `preference-profile.json` に最新値として上書きし続けず、`preference-summary-history.json` に履歴として保存する。これにより、直近のフィードバックだけが強く効きすぎることを避け、長期的な好みの変化も後から分析できるようにする。

推薦時には履歴全件を毎回 LLM に渡さず、以下の2種類のサマリを主に使う。

- `long_term_summary`: 全期間を通じて安定している好み
- `recent_summary`: 直近7日間の反応から見える短期傾向

`preference-summary-history.json` は、推薦プロンプトへ直接すべて投入するためではなく、長期・短期サマリの生成やあとからの分析に使う。

直近7日間の反応が少なすぎる場合は、短期傾向を無理に推測せず「十分な根拠なし」として扱う。

### Discord 投稿状態

記事投稿時に、Discord message id と記事・分析結果の対応を保存する。

例:

```json
{
  "date": "2026-05-10",
  "posts": [
    {
      "message_id": "123",
      "channel_id": "456",
      "article_url": "https://zenn.dev/...",
      "article_published_at": "2026-05-10T09:00:00+09:00",
      "posted_at": "2026-05-10T09:00:00+09:00",
      "analysis_id": "2026-05-10:zenn:abc",
      "reaction_feedback": [
        {
          "emoji": "👍",
          "type": "positive",
          "user_ids": [],
          "processed_at": null,
          "ignored_reason": null
        },
        {
          "emoji": "👎",
          "type": "negative",
          "user_ids": [],
          "processed_at": null,
          "ignored_reason": null
        }
      ]
    }
  ]
}
```

`reaction_feedback` には、今後の拡張性のため Discord user id と対象リアクションごとの `processed_at` を保持する。

フィードバック収集 job は Discord チャンネル履歴を全走査しない。`Repository State` に保存された message id のうち、以下を満たすものだけを Discord API で取得する。

- 対象リアクションの `processed_at` が未設定
- `posted_at` が直近7日以内

`👍` または `👎` のリアクションが見つかった場合、その user id を `reaction_feedback` に保存し、対象リアクションの `processed_at` を設定する。今後、対象リアクションを増やす場合も、リアクションごとに独立して処理済み状態を持つ。

同じ記事に `👍` と `👎` の両方が付いている場合は、矛盾したフィードバックとして Preference Profile には反映しない。

矛盾フィードバックでは `processed_at` を更新せず、対象リアクションに `ignored_reason: "conflicting_positive_and_negative"` を記録する。

初期バージョンでは、Preference Profile の特徴量重みを以下の幅で更新する。

- `positive`: `+1`
- `negative`: `-1`

実際の更新量は、`Feedback Weight * Article Feature の salience` とする。これにより、記事の中心的な特徴ほど強く、周辺的な特徴ほど弱く Preference Profile に反映する。

`salience` は `0.0` から `1.0` の数値とし、以下の目安で扱う。

- `1.0`: 記事の中心テーマ
- `0.7`: 重要な補助テーマ
- `0.4`: 明確に含まれるが中心ではない
- `0.1`: 軽く触れているだけ

Preference Profile の更新には `salience >= 0.3` の特徴量だけを使う。

Article Features は、カテゴリごとの管理語彙を優先して抽出する。各 key には日本語説明を付け、実装時・レビュー時に特徴量の意味を確認できるようにする。

管理語彙は `config/feature-vocabulary.json` に保存し、LLM プロンプト、Feature Extraction のバリデーション、Rule Score、週次の語彙昇格候補通知から参照する。

`config/feature-vocabulary.json` は、最初にスケルトンを作成し、その後に初期 Feature Vocabulary の具体 key を追加する。

`config/feature-vocabulary.json` は特徴量 key と `description_ja` のみを持つ。seed weights は語彙ではなく初期の好みなので、`data/preference-profile.json` の初期値として保存する。

例:

```json
{
  "version": 1,
  "topics": {
    "nextjs": {
      "display_name": "Next.js",
      "aliases": ["next.js", "next", "nextjs"],
      "description_ja": "React ベースのWebアプリケーションフレームワーク"
    }
  },
  "feature_axes": {
    "content_types": {
      "description_ja": "記事の形式や構成",
      "features": {}
    },
    "evidence_signals": {
      "description_ja": "記事の主張や学びを支える根拠の種類",
      "features": {}
    },
    "practical_signals": {
      "description_ja": "実務で再利用しやすい具体性や応用可能性",
      "features": {}
    },
    "depth_signals": {
      "description_ja": "記事の掘り下げの深さや表層性",
      "features": {}
    },
    "title_signals": {
      "description_ja": "タイトルから読み取れる具体性や傾向",
      "features": {}
    },
    "audience_levels": {
      "description_ja": "記事が想定している読者の経験レベル",
      "features": {}
    }
  }
}
```

`topics` は `items` のような中間キーを挟まず、正規化済み topic key を直下に置く。`feature_axes` の各軸は `description_ja` と `features` を持つ。

初期 Feature Vocabulary の具体 key は `config/feature-vocabulary.json` に保存する。初期セットは、Zenn の対象RSSと品質基準から、TypeScript / React / Next.js / frontend / backend / Web開発 / AI活用 / LLM / testing / performance / security / DevOps を topic として持つ。Feature Axis は `content_types`、`evidence_signals`、`practical_signals`、`depth_signals`、`title_signals`、`audience_levels` の6軸とする。

`topics` は、通常の管理語彙ではなく技術名・領域名の正規化辞書として扱う。

例:

```json
{
  "topics": {
    "nextjs": {
      "display_name": "Next.js",
      "aliases": ["next.js", "next", "nextjs"],
      "description_ja": "React ベースのWebアプリケーションフレームワーク"
    }
  }
}
```

topic の canonical key と aliases は大文字小文字を区別せず、保存時は小文字に正規化する。表示上の表記は `display_name` を使う。

未知の topic は `other_signals` には入れず、`unknown_topics` に保存する。週次の語彙メンテナンス通知では、`unknown_topics` も正規化候補として知らせる。

また、`topics` は記事の主題と周辺言及を分ける。

- `primary_topics`: 記事の主題になっている技術・領域
- `mentioned_topics`: 本文中で触れられるが主題ではない技術・領域

Preference Profile 更新と Rule Score では `primary_topics` を基本的に使う。`mentioned_topics` は `salience >= 0.7` のものだけ `0.3` 倍で使い、周辺言及によって好みが過剰に更新されないようにする。

```txt
primary_topic_contribution = feature_weight * salience
mentioned_topic_contribution = feature_weight * salience * 0.3
```

例:

```json
{
  "evidence_signals": {
    "code_examples": {
      "description_ja": "コード例や設定例があり、内容を具体的に確認できる"
    },
    "measured_results": {
      "description_ja": "性能、品質、開発効率などを測定した結果が示されている"
    },
    "real_world_experience": {
      "description_ja": "実際の開発・運用経験に基づく観察や判断が含まれている"
    },
    "comparison": {
      "description_ja": "複数の選択肢、手法、ツールを比較している"
    }
  },
  "practical_signals": {
    "actionable_steps": {
      "description_ja": "読後に実行できる手順や導入ステップが示されている"
    },
    "architecture_decision_support": {
      "description_ja": "設計判断や技術選定の材料として使える"
    },
    "operationally_applicable": {
      "description_ja": "本番運用、監視、保守、障害対応に活かせる"
    },
    "reusable_implementation_pattern": {
      "description_ja": "他のプロジェクトでも再利用できる実装パターンが含まれている"
    }
  },
  "depth_signals": {
    "tradeoff_analysis": {
      "description_ja": "メリット・デメリットや制約まで踏み込んで説明している"
    },
    "deep_technical_explanation": {
      "description_ja": "仕組みや内部挙動まで掘り下げて説明している"
    },
    "surface_level_summary": {
      "description_ja": "表層的な概要説明が中心で、深い判断材料は少ない"
    },
    "thin_news": {
      "description_ja": "ニュース紹介や概要まとめが中心で、再利用できる具体的な知見が少ない"
    }
  },
  "content_types": {
    "production_case_study": {
      "description_ja": "実際のプロダクトや本番環境での事例紹介"
    },
    "implementation_guide": {
      "description_ja": "特定の実装を進めるための手順やガイド"
    },
    "conceptual_explanation": {
      "description_ja": "概念や仕組みの理解を目的にした解説"
    },
    "tool_introduction": {
      "description_ja": "ライブラリ、ツール、サービスの紹介"
    },
    "news_summary": {
      "description_ja": "新機能、リリース、技術動向の要約"
    }
  }
}
```

管理語彙にないが有用そうな特徴量は `other_signals` に保存する。

例:

```json
{
  "other_signals": [
    {
      "key": "server_actions_cache_invalidation",
      "description_ja": "Server Actions とキャッシュ無効化の具体的な扱いに触れている",
      "salience": 0.7
    }
  ]
}
```

`other_signals` は恒久的な雑多置き場にはしない。一定回数以上出現した、または推薦・フィードバックに効いていると判断できる key は、必要に応じて管理語彙へ昇格させる。

初期バージョンでは `other_signals` の管理語彙への昇格は自動化しない。以下の条件に合致する昇格候補を、毎週土曜日の朝に Discord へ通知し、手動レビューできるようにする。

- 複数の記事で繰り返し出ている
- `salience >= 0.3` で出ることが多い
- `👍` / `👎` のフィードバックに紐づいていて、好みの判断に効いていそう
- 既存の管理語彙と意味が重複していない
- 日本語説明を1文で明確に書ける

通知には、候補 key、日本語説明、出現回数、代表記事、関連したフィードバック、管理語彙へ昇格する場合の推奨カテゴリを含める。

例:

```json
{
  "depth_signals": [
    { "key": "tradeoff_analysis", "salience": 0.9 },
    { "key": "surface_level_summary", "salience": 0.2 }
  ]
}
```



## 記事推薦

### 記事同一性

同じ記事を複数日にわたって推薦しないため、記事の同一性は URL 文字列そのものではなく `canonical_url` から判定する。

URL正規化では最低限以下を行う。

- `http` / `https` を正規化する
- 末尾 `/` を揃える
- `utm_*` などトラッキングクエリを削除する
- fragment `#...` を削除する
- Zenn の場合は記事ページの canonical URL を優先する

`article_id` は `source + hash(canonical_url)` から作る。`analysis_id` に日付を入れると同じ記事が日ごとに別扱いになりやすいため、記事同一性には使わない。

`seen-articles.json` は `article_id` をキーにする。

例:

```json
{
  "articles": {
    "zenn:abc123": {
      "canonical_url": "https://zenn.dev/...",
      "first_seen_at": "2026-05-10T09:00:00+09:00",
      "first_recommended_at": "2026-05-10T09:00:00+09:00",
      "last_seen_at": "2026-05-10T09:00:00+09:00"
    }
  }
}
```

### Feature Extraction

`data/feature-extractions/YYYY-MM-DD.json` には、本文取得・特徴量抽出の結果を保存する。`readability.is_readable = false` の記事も、除外理由を後から確認できるように保存する。

Feature Extraction は、Rule Score、Preference Profile 更新、語彙メンテナンスに使う構造化データだけを作る。Discord投稿用の `summary` や `learning_points` はここでは生成しない。

初期バージョンでは本文変更検知はスコープ外にする。一度 Feature Extraction された記事は `article_id` をキーに再利用し、同じ記事を二度と Feature Extraction の対象にしない。

Feature Extraction 済みだが未推薦の記事は、その日のRSSに再び出てきた場合だけ推薦候補に戻す。RSSにもう出ていない未推薦記事は、その日の候補には含めない。

例:

```json
{
  "date": "2026-05-10",
  "extractions": [
    {
      "article_id": "zenn:abc123",
      "source": "zenn",
      "canonical_url": "https://zenn.dev/...",
      "title": "...",
      "published_at": "...",
      "fetched_at": "...",
      "analyzed_at": "...",
      "readability": {
        "is_readable": true,
        "reason": null
      },
      "features": {
        "primary_topics": [],
        "mentioned_topics": [],
        "feature_axes": {},
        "other_signals": [],
        "unknown_topics": []
      }
    }
  ]
}
```

### Digest Generation

推薦された記事だけ、Discord投稿用に Digest Generation を実行する。

Digest Generation は記事本文、Feature Extraction、推薦順位、Rule Score、LLM Rerank の理由を入力にし、以下を生成する。

- `summary`: 簡単な要約
- `why_recommended`: 推薦理由
- `learning_points`: 記事から得られる知見や学び
- `signals_used`: 推薦判断に効いた Feature Axis / Topic の日本語説明

Feature Extraction とは別の LLM フローとして実行し、必要に応じて推薦記事の本文を再度解析する。

Digest Generation の結果は `data/digest-generations/YYYY-MM-DD.json` に保存する。

例:

```json
{
  "date": "2026-05-10",
  "items": [
    {
      "article_id": "zenn:abc123",
      "rank": 1,
      "rule_score": 2.7,
      "rerank_reason": "production運用の具体例があり、recent_summaryにも合う",
      "post": {
        "summary": "...",
        "why_recommended": "...",
        "learning_points": ["..."],
        "signals_used": ["..."]
      }
    }
  ]
}
```

`discord-posts` は実際に投稿できた Discord message との対応を保存するためのファイルであり、投稿文本文は重複保存しない。

例:

```json
{
  "date": "2026-05-10",
  "posts": [
    {
      "message_id": "123",
      "channel_id": "456",
      "article_id": "zenn:abc123",
      "posted_at": "2026-05-10T09:00:00+09:00",
      "reaction_feedback": []
    }
  ]
}
```

`first_recommended_at` は Discord 投稿が成功した記事だけに設定する。Digest Generation まで成功していても、Discord 投稿に失敗した記事は推薦済みにしない。

### 失敗時の扱い

GitHub Actions 実行中の失敗は、どの段階で起きたかによって state 更新を分ける。

- RSS取得失敗: その feed だけスキップする。全 feed が失敗した場合は job failed にする。
- 本文取得失敗: Feature Extraction は作らず、`seen-articles.json` に `last_fetch_failed_at` と `fetch_error` を記録し、推薦候補から除外する。
- Feature Extraction の LLM失敗: `feature-extractions` には保存せず、`seen-articles.json` に `last_extraction_failed_at` を記録する。翌日RSSに出た場合は再試行してよい。
- `readability.is_readable = false`: Feature Extraction として保存する。同じ記事は再抽出しない。
- Digest Generation 失敗: その記事だけ投稿しない。`first_recommended_at` は入れない。
- Discord投稿失敗: その記事は `discord-posts` に保存せず、`first_recommended_at` も入れない。

### 1. 候補除外

候補除外と分析は以下の順序で行う。

1. RSSから候補URLを集める。
2. URLを正規化して `article_id` を作る。
3. 複数フィードに出てきた重複記事を `article_id` で統合する。
4. `seen-articles.json` に `first_recommended_at` がある記事は除外する。
5. Feature Extraction 済みの記事は既存結果を再利用する。
6. Feature Extraction 未実施の未推薦記事だけ本文取得する。
7. 本文取得結果を LLM で Feature Extraction する。
8. `readability.is_readable = false` の記事は推薦候補から除外する。ただし Feature Extraction は保存する。
9. Rule Score と LLM Rerank で推薦記事を選ぶ。
10. Discord投稿後、投稿された記事だけ `first_recommended_at` を入れる。

RSSで見かけただけでは推薦済みにはしない。`first_seen_at` は更新してもよいが、推薦除外に使うのは `first_recommended_at` とする。

### 2. Rule Score

候補記事の Article Features と Preference Profile の `feature_weights` を使って、機械的なスコアを計算する。

基本式:

```txt
rule_score = Σ(feature_weight * salience)
```

Preference Profile に存在しない特徴量は `0` として扱う。`salience < 0.3` の特徴量はスコア計算に使わない。

### 3. LLM Rerank

Rule Score の上位候補、たとえば20本を LLM に渡し、品質基準、Long-Term Preference Summary、Recent Preference Summary を踏まえて最大10本に絞る。

LLM Rerank では、単に好みに近い記事だけでなく、以下も考慮する。

- 記事本文から十分な学びが得られるか
- 同じ話題の記事が多すぎないか
- 長期嗜好と短期傾向のどちらに合っているか
- 推薦理由を明確に説明できるか

## 品質基準

推薦では以下を優先する。

- 実装に使える具体性
- アーキテクチャ判断に役立つ内容
- production での知見
- 開発生産性の改善
- TypeScript / React / Next.js / frontend / backend / Web開発に関する深い知見
- AI活用が具体的で、実装や運用に接続している記事

避けたいもの:

- 薄いニュースまとめ
- 初心者向けで実務的な学びが少ない記事
- 汎用的すぎるAIトレンド紹介
- 再利用できる知見が少ない記事

## 拡張方針

将来的に増やしたいもの:

- Hacker News
- Qiita
- arXiv / 論文
- 技術ブログ
- Slack通知
- Email通知

初期実装では、Zenn や Discord の詳細を daily digest workflow に直接埋め込みすぎない。情報源、通知先、フィードバック取得、保存先、モデル呼び出しを差し替えられるようにする。
