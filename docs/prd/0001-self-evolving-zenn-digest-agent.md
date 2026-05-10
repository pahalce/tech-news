# PRD: Self-Evolving Zenn Digest Agent

## Problem Statement

Owner は毎日 Zenn のトレンドや関心トピックから、実務に役立つ高品質な技術記事だけを効率よく読みたい。しかし RSS を手で追うと、薄いニュースまとめ、初心者向けの概要、汎用的なAIトレンド紹介が混ざり、読む価値の高い記事を選ぶ負担が大きい。

また、記事推薦は一度設定した条件だけでは Owner の好みの変化に追従しにくい。Owner は Discord で簡単に 👍 / 👎 を返すだけで、推薦品質が少しずつ自分の好みに近づく personal digest agent を必要としている。

## Solution

GitHub Actions 上で毎日動く Flue agent を実装する。agent は Zenn のトレンド RSS と指定トピック RSS から記事候補を集め、本文取得と Feature Extraction を行い、Preference Profile と Feature Vocabulary に基づく Rule Score と LLM Rerank で最大10本を選ぶ。

推薦された記事だけ Digest Generation を行い、Discord に1記事1メッセージで投稿する。投稿後の 👍 / 👎 リアクションを毎朝収集し、Reaction Feedback として Preference Profile に反映する。Feature Vocabulary は初期語彙から始め、Other Signals と Unknown Topic を週次で Discord に通知して手動メンテナンスできるようにする。

## User Stories

1. As an Owner, I want Zenn のトレンド RSS から記事候補を収集してほしい, so that 話題の記事を自分で巡回しなくてよい。
2. As an Owner, I want TypeScript / React / Next.js / frontend / backend の topic RSS から記事候補を収集してほしい, so that 関心領域の記事を拾いやすくなる。
3. As an Owner, I want 同じ記事が複数 feed に出ても1記事として扱ってほしい, so that 重複推薦を避けられる。
4. As an Owner, I want URL の表記揺れや tracking query があっても同じ記事として扱ってほしい, so that 同じ記事が別日に再推薦されない。
5. As an Owner, I want RSSで見かけただけの記事は推薦済みにしないでほしい, so that 今日選ばれなかった良記事が翌日も feed にあれば候補に残る。
6. As an Owner, I want Discord に投稿成功した記事だけを Recommended Article として記録してほしい, so that 投稿失敗した記事が読めないまま除外されない。
7. As an Owner, I want 本文取得できない記事を推薦対象外にしてほしい, so that 要約不能な記事が Discord に流れない。
8. As an Owner, I want LLM が要約・特徴抽出できない記事を Readable Article として扱わないでほしい, so that 信頼できない推薦を避けられる。
9. As an Owner, I want unreadable な記事も除外理由を保存してほしい, so that なぜ候補から落ちたか後で確認できる。
10. As an Owner, I want 一度 Feature Extraction した記事を再抽出しないでほしい, so that LLM コストを抑えられる。
11. As an Owner, I want Feature Extraction 済みだが未推薦の記事を、その日の RSS に出ている場合だけ再候補にしてほしい, so that 古い候補の backlog で推薦が濁らない。
12. As an Owner, I want Feature Extraction では summary や learning points を生成しないでほしい, so that 学習用構造データと投稿文生成の責務が混ざらない。
13. As an Owner, I want 推薦された記事だけ Digest Generation してほしい, so that 不要な LLM 呼び出しを減らせる。
14. As an Owner, I want Discord 投稿に summary, why recommended, learning points, signals used を含めてほしい, so that 記事本文を開く前に読む価値を判断できる。
15. As an Owner, I want 毎日最大10本まで推薦してほしい, so that digest が多すぎて読めなくならない。
16. As an Owner, I want 良い記事が少ない日は10本未満でもよい, so that 数合わせの低品質記事を避けられる。
17. As an Owner, I want Rule Score で候補を絞ってから LLM Rerank してほしい, so that 再現性と文脈判断の両方を活かせる。
18. As an Owner, I want Feature Vocabulary の key に日本語説明が付いていてほしい, so that 各特徴量の意味を理解して調整できる。
19. As an Owner, I want topics を aliases 付きの正規化辞書として扱ってほしい, so that `next.js` と `nextjs` のような揺れを吸収できる。
20. As an Owner, I want topic matching を case-insensitive にしてほしい, so that 大文字小文字の違いで別 topic にならない。
21. As an Owner, I want topic の表示名は display_name で保持してほしい, so that 保存は lowercase でも Discord やログでは読みやすく表示できる。
22. As an Owner, I want primary topics と mentioned topics を分けてほしい, so that 周辺言及で好みが過剰に更新されない。
23. As an Owner, I want mentioned topics は salience が高い場合だけ弱く効いてほしい, so that 関連技術を完全には無視せずノイズも抑えられる。
24. As an Owner, I want Article Features に salience を持たせてほしい, so that 記事の中心テーマほど強く学習に反映される。
25. As an Owner, I want salience が低い特徴量は Preference Profile 更新に使わないでほしい, so that 軽い言及からノイズを学習しない。
26. As an Owner, I want Preference Profile の feature weights を階層構造で保持してほしい, so that topics と feature axes を扱いやすい。
27. As an Owner, I want feature weights を -3.0 から +3.0 に clamp してほしい, so that 少数の反応で極端な好みにならない。
28. As an Owner, I want seed weights は -1.0 から +1.0 の弱い初期値にしてほしい, so that 初期嗜好が強すぎずフィードバックで育てられる。
29. As an Owner, I want 初期 seed weights で production 事例や実装具体性を少し高くしてほしい, so that 初日から品質基準に近い推薦が届く。
30. As an Owner, I want 薄いニュースや汎用AI hype を初期値で低めにしてほしい, so that 読む価値の低い記事を避けやすい。
31. As an Owner, I want 初期 Feature Vocabulary を config で管理してほしい, so that prompt, validation, scoring, weekly suggestions が同じ語彙を参照できる。
32. As an Owner, I want Feature Vocabulary と seed weights を別ファイルにしてほしい, so that 語彙の意味と Owner の好みを分離できる。
33. As an Owner, I want unknown topics を other signals と分けて保存してほしい, so that 技術名の正規化候補として扱える。
34. As an Owner, I want Other Signals を恒久的な雑多置き場にしないでほしい, so that Feature Vocabulary が育つ余地を保てる。
35. As an Owner, I want Other Signals の昇格候補を土曜朝に Discord 通知してほしい, so that 語彙を手動レビューできる。
36. As an Owner, I want 語彙昇格候補に key, 日本語説明, 出現回数, 代表記事, 関連フィードバック, 推奨 axis が含まれてほしい, so that 昇格判断をしやすい。
37. As an Owner, I want Discord には1記事1メッセージで投稿してほしい, so that リアクションがどの記事への feedback か明確になる。
38. As an Owner, I want 👍 を positive feedback として扱ってほしい, so that 好みに合った記事の特徴が強まる。
39. As an Owner, I want 👎 を negative feedback として扱ってほしい, so that 好みに合わない記事の特徴が弱まる。
40. As an Owner, I want 🔖 を Preference Profile 更新に使わないでほしい, so that 「後で読む」意図と好みを混ぜない。
41. As an Owner, I want 対象リアクションごとに processed_at を持ってほしい, so that 将来リアクション種別を増やせる。
42. As an Owner, I want reaction feedback に Discord user id を保持してほしい, so that 将来複数人利用へ拡張しやすい。
43. As an Owner, I want 👍 と 👎 が両方付いた場合は矛盾として無視してほしい, so that Preference Profile に曖昧な signal が入らない。
44. As an Owner, I want 矛盾 feedback には ignored_reason を残してほしい, so that なぜ処理されないか追跡できる。
45. As an Owner, I want feedback collection が Discord channel 全履歴を走査しないでほしい, so that API 負荷と実行時間を抑えられる。
46. As an Owner, I want feedback collection が saved message id だけを取得してほしい, so that 対象記事との対応が安定する。
47. As an Owner, I want feedback collection window を posted_at から7日以内にしてほしい, so that 古い message を追い続けない。
48. As an Owner, I want Recent Preference Summary を直近7日間の反応から作ってほしい, so that 短期関心を推薦に反映できる。
49. As an Owner, I want Long-Term Preference Summary と Recent Preference Summary を分けてほしい, so that 長期嗜好と短期傾向を混同しない。
50. As an Owner, I want Preference Summary History を保存してほしい, so that 好みの変化を後から分析できる。
51. As an Owner, I want summary history 全件を毎回 prompt に入れないでほしい, so that 古い傾向と token 量が推薦を邪魔しない。
52. As an Owner, I want Repository State を JSON として repo に保存してほしい, so that 外部DBなしで GitHub Actions 間の状態を持てる。
53. As an Owner, I want 各 job が最後に1回だけ Data Commit してほしい, so that 中途半端な state commit を避けられる。
54. As an Owner, I want collect-feedback, zenn-digest, suggest-feature-vocabulary を Vite+ run command として実行できてほしい, so that 開発と運用の入り口が揃う。
55. As an Owner, I want LLM model を環境変数で切り替えられるようにしてほしい, so that Gemini 無料枠から別モデルへ移行しやすい。
56. As an Owner, I want RSS feed ごとの失敗を部分失敗として扱ってほしい, so that 一部 feed 障害で全体が止まらない。
57. As an Owner, I want 全 feed が失敗した場合は job failed にしてほしい, so that digest が空でも成功扱いにならない。
58. As an Owner, I want Feature Extraction LLM 失敗は再試行可能にしてほしい, so that 一時的な LLM 障害で記事が永久除外されない。
59. As an Owner, I want unreadable 判定された Feature Extraction は再試行しないでほしい, so that 要約不能な記事に毎日コストを使わない。
60. As an Owner, I want Digest Generation や Discord 投稿の失敗記事を推薦済みにしないでほしい, so that 実際に届かなかった記事が再候補になれる。

## Implementation Decisions

- Build a scheduler/workflow layer with three entrypoints: collect feedback at 08:00 JST daily, generate Zenn digest at 09:00 JST daily, and suggest feature vocabulary at 08:30 JST on Saturdays.
- Build a feed ingestion module that reads the configured Zenn trend and topic RSS feeds, tolerates per-feed failure, and fails the job when all feeds fail.
- Build an article identity module that canonicalizes URLs, removes tracking query parameters and fragments, prefers Zenn canonical URLs where available, and derives Article ID from source plus canonical URL hash.
- Build a Repository State module that reads and writes JSON state files, performs schema validation, and writes one Data Commit per job after all state updates are complete.
- Build a Feature Vocabulary module backed by the Feature Vocabulary Config. It must normalize topic aliases case-insensitively, keep canonical topic keys and aliases lowercase, use display_name for presentation casing, and expose feature axis descriptions and feature descriptions for prompts and validation.
- Build a Feature Extraction module that fetches article bodies, calls the LLM to produce readability and Article Features, validates extracted keys against the Feature Vocabulary, and records Other Signals and Unknown Topics separately.
- Feature Extraction does not create summary, recommendation reason, learning points, or Discord post text.
- Once an Article ID has Feature Extraction, it is not extracted again. Initial implementation does not track content changes.
- Feature Extraction results with `readability.is_readable = false` are saved and not retried.
- Failed Extraction Attempts are not saved as Feature Extraction and may retry when the article appears again as a Current Feed Candidate.
- Build a scoring module that computes Rule Score as the sum of feature weight multiplied by Feature Salience. It excludes features below the Salience Threshold of 0.3.
- Mentioned Topic contribution uses a Mentioned Topic Factor of 0.3 and only applies when salience is at least 0.7.
- Build an LLM Rerank module that takes top Rule Score candidates, Long-Term Preference Summary, Recent Preference Summary, and quality criteria, then selects up to ten final articles.
- Build a Digest Generation module that runs only for recommended articles and creates Discord-facing summary, why recommended, learning points, and signals used.
- Build a Discord notification module that posts one message per article and records a Discord Post Record only after the post succeeds.
- The article becomes a Recommended Article only after Discord posting succeeds.
- Build a feedback collection module that loads saved Discord Post Records, fetches only target messages within seven days of posted_at, and processes target Reaction Feedback.
- Initial target reactions are 👍 as positive and 👎 as negative. Bookmark-like reactions are not preference feedback.
- Reaction Feedback stores user ids, processed_at per target emoji, and ignored_reason when feedback is contradictory.
- If positive and negative feedback both exist for the same article, do not update the Preference Profile and leave processed_at empty with ignored_reason.
- Initial Feedback Weight is +1 for positive and -1 for negative. Updates are scaled by Feature Salience and clamped to the Feature Weight Range of -3.0 to +3.0.
- Seed Weight values live in the initial Preference Profile, not the Feature Vocabulary Config, and stay within -1.0 to +1.0.
- Build a preference summary module that updates Preference Summary History, Long-Term Preference Summary, and Recent Preference Summary. Recent Preference Summary uses the last seven days of reactions and reports insufficient evidence when feedback is sparse.
- Build a weekly vocabulary suggestion module that evaluates Other Signals and Unknown Topics, saves suggestions, and sends Discord notification for manual review without auto-promoting keys.
- Vocabulary Promotion Candidates should be selected when they repeat across articles, often appear with salience at least 0.3, connect to 👍 / 👎 feedback, do not duplicate existing vocabulary, and have a clear one-sentence Japanese description.
- Provide Vite+ commands for `collect-feedback`, `zenn-digest`, and `suggest-feature-vocabulary`.
- Make the LLM model configurable by environment variable. Initial assumption is Gemini free-tier model usage.

## Testing Decisions

- Tests should assert external behavior and state transitions, not private implementation details. Good tests should feed realistic inputs into modules and verify stable JSON outputs, selected Article IDs, score values, and Discord payload decisions.
- Test the article identity module with URL variants: trailing slash, fragments, tracking query params, http/https differences, duplicate RSS appearances, and Zenn canonical URL preference.
- Test the Feature Vocabulary module for lowercase topic keys, lowercase aliases, case-insensitive matching, display_name preservation, unknown topic handling, and feature axis validation.
- Test Repository State writes so each job produces the expected changed JSON files and does not update state prematurely on failed intermediate steps.
- Test Feature Extraction validation with readable, unreadable, unknown feature, other signal, unknown topic, and failed LLM cases.
- Test that an Extracted Article is not extracted again and can return as a candidate only when it appears in the current feed.
- Test Rule Score calculation, including Salience Threshold, Mentioned Topic Factor, missing feature weights as zero, and weight clamping after feedback.
- Test LLM Rerank at the boundary where fewer than ten high-quality articles are available.
- Test Digest Generation separately from Feature Extraction so summary and learning points are not required for scoring.
- Test Discord posting behavior: one article per message, no Discord Post Record on post failure, and first_recommended_at only after post success.
- Test feedback collection with saved message ids only, posted_at within and outside seven days, processed_at per reaction, contradictory 👍 / 👎 handling, and ignored_reason.
- Test Preference Profile updates for positive and negative feedback, salience scaling, seed range, learned weight range, and summary history update behavior.
- Test weekly vocabulary suggestions for Other Signals and Unknown Topics, including duplicate detection and no auto-promotion.
- There is no prior application test suite yet; implementation should introduce focused unit tests around pure modules first, then integration tests around the three job entrypoints.

## Out of Scope

- Web UI.
- Multiple Owners or per-Discord-user personalization.
- Complex database, vector search, or RAG infrastructure.
- Full coverage of every Zenn topic.
- Automatic Feature Vocabulary promotion.
- Article body content-change detection after Feature Extraction.
- Retrying unreadable articles.
- Using bookmark or later-read reactions as preference feedback.
- Recommending non-Zenn sources in the initial version.
- Slack or Email notification in the initial version.

## Further Notes

- Domain language should follow CONTEXT.md. Prefer Owner, Preference Profile, Feature Extraction, Digest Generation, Article ID, Feature Vocabulary, Feature Axis, Reaction Feedback, Repository State, and Data Commit.
- The current repository contains design docs and JSON seed state but no implementation code yet.
- The PRD assumes the existing Feature Vocabulary Config and initial Preference Profile seed weights are the starting point.
- Issue tracker publication is not yet configured in this workspace because no git remote is set.
