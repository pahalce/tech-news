# Flue Agent

Flue Agent is a personal digest agent that recommends technical articles based on a single owner's preferences.

## Language

**Preference Profile**:
A single profile representing the owner's article preferences for future recommendations.
_Avoid_: user profile, personal profiles, per-user profile

**Preference Summary History**:
A dated history of natural-language summaries of the **Owner**'s preferences used to inspect long-term and short-term preference shifts.
_Avoid_: overwritten summary, latest-only preference summary

**Long-Term Preference Summary**:
A stable natural-language summary of the **Owner**'s durable article preferences.
_Avoid_: latest feedback summary, recent trend

**Recent Preference Summary**:
A natural-language summary of short-term preference signals from reactions in the last seven days.
_Avoid_: permanent preference, all-time summary

**Owner**:
The one person who receives the digest and whose preferences shape recommendations.
_Avoid_: user, member, viewer

**Article Features**:
Structured signals extracted from an article's title, body, metadata, and content style for scoring and preference learning.
_Avoid_: tags-only preferences, raw article text

**Feature Vocabulary**:
The managed set of allowed **Article Feature** keys, each with a Japanese description.
_Avoid_: free-form feature keys, undocumented signal names

**Feature Vocabulary Config**:
The `config/feature-vocabulary.json` file used as the source of truth for managed feature keys.
_Avoid_: design-doc-only vocabulary, duplicated prompt list

**Topic Key**:
A normalized key stored directly under `topics` in the **Feature Vocabulary Config**.
_Avoid_: topics.items, raw alias

**Vocabulary Skeleton**:
The initial minimal **Feature Vocabulary Config** structure created before the concrete feature keys are finalized.
_Avoid_: finalized vocabulary, preference weights

**Feature Axis**:
One of `content_types`, `evidence_signals`, `practical_signals`, `depth_signals`, `title_signals`, or `audience_levels`.
_Avoid_: categories, quality_signals, uncategorized feature

**Feature Axis Description**:
A Japanese description of what a **Feature Axis** represents.
_Avoid_: undocumented axis, implicit grouping

**Primary Topic**:
A technology or domain that is central to a **Readable Article**.
_Avoid_: mentioned technology, RSS topic only

**Mentioned Topic**:
A technology or domain mentioned in a **Readable Article** but not central to it.
_Avoid_: primary topic, incidental keyword

**Mentioned Topic Factor**:
The multiplier used when a **Mentioned Topic** affects scoring or preference updates.
_Avoid_: full topic weight, ignored mention

**Topic Normalization Dictionary**:
The `topics` section of the **Feature Vocabulary Config**, mapping canonical topic keys to display names, aliases, and Japanese descriptions.
_Avoid_: free-form topic strings, other_signals for technologies

**Unknown Topic**:
A technology or domain extracted from an article but not yet present in the **Topic Normalization Dictionary**.
_Avoid_: other signal, discarded topic

**Other Signals**:
Candidate feature keys extracted outside the current **Feature Vocabulary** that may later be promoted.
_Avoid_: discarded signals, permanent miscellaneous bucket

**Vocabulary Promotion Candidate**:
An **Other Signal** worth reviewing for promotion into the **Feature Vocabulary** during the Saturday morning maintenance notification.
_Avoid_: auto-promoted feature, one-off signal

**Feature Salience**:
A numeric estimate of how central an **Article Feature** is to a **Readable Article**.
_Avoid_: feature presence, tag count

**Salience Threshold**:
The minimum **Feature Salience** required for an **Article Feature** to update the **Preference Profile**.
_Avoid_: all extracted features, incidental mention

**Readable Article**:
An article whose fetched body can be summarized by the LLM and used to extract reliable **Article Features**.
_Avoid_: RSS-only article, unfetchable article

**Feature Extraction**:
A saved LLM extraction of readability and **Article Features** from an article body.
_Avoid_: digest text, summary, learning points

**Extracted Article**:
An article that already has **Feature Extraction** and is not extracted again.
_Avoid_: content-change tracking, re-extraction

**Current Feed Candidate**:
An article that appears in the current digest run's RSS inputs.
_Avoid_: historical backlog, stale candidate

**Digest Generation**:
The LLM step that creates Discord-facing summary, recommendation reason, learning points, and used signals for selected articles.
_Avoid_: feature extraction, scoring

**Discord Post Record**:
The repository state entry that maps a successfully posted Discord message to an **Article ID**.
_Avoid_: generated digest text, failed post

**Failed Extraction Attempt**:
A failed LLM feature extraction attempt recorded for retry without creating **Feature Extraction**.
_Avoid_: unreadable article, extracted article

**Canonical URL**:
The normalized article URL used to determine article identity.
_Avoid_: feed URL, tracking URL, URL with fragment

**Article ID**:
A stable identifier derived from source and **Canonical URL** hash.
_Avoid_: date-based analysis id, raw URL

**Recommended Article**:
An article that has been posted to Discord and recorded with `first_recommended_at`.
_Avoid_: seen article, RSS candidate

**Repository State**:
JSON files committed to the repository that persist digest state between GitHub Actions runs.
_Avoid_: database, external state store, runtime cache

**Data Commit**:
A single commit at the end of a GitHub Actions job that persists updated **Repository State**.
_Avoid_: per-step commit, partial state commit

**Feedback Collection Window**:
The seven-day period after Discord posting during which messages without collected feedback are eligible for preference updates.
_Avoid_: full channel history scan, unlimited backfill

**Reaction Feedback**:
A target Discord reaction with its users and per-reaction processing time for preference updates.
_Avoid_: message-level feedback flag, bookmark intent

**Feedback Weight**:
The numeric preference update applied from a processed **Reaction Feedback**.
_Avoid_: reaction count, Discord score

**Feature Weight Range**:
The allowed numeric range for stored **Preference Profile** feature weights.
_Avoid_: unbounded preference score, seed weight

**Seed Weight**:
An initial feature weight derived from the design quality criteria before personal feedback accumulates.
_Avoid_: learned preference, final vocabulary

**Rule Score**:
A deterministic article score calculated from **Preference Profile** weights and **Feature Salience**.
_Avoid_: final recommendation, LLM judgment

**LLM Rerank**:
The LLM selection step that chooses the final digest articles from top **Rule Score** candidates.
_Avoid_: first-pass scoring, all-candidate ranking

## Relationships

- An **Owner** has exactly one **Preference Profile**.
- A **Preference Profile** is updated from Discord reactions to previously recommended articles.
- **Preference Summary History** records how the natural-language interpretation of the **Preference Profile** changes over time.
- Recommendation selection uses **Long-Term Preference Summary** and **Recent Preference Summary** instead of passing the full **Preference Summary History**.
- A **Readable Article** has **Article Features**.
- A **Readable Article** produces **Feature Extraction** before scoring.
- An **Extracted Article** is reused by **Article ID** and is not processed by **Feature Extraction** again.
- An **Extracted Article** can return as a recommendation candidate only when it is also a **Current Feed Candidate**.
- **Article ID** determines whether an article has already been seen or recommended.
- Only **Recommended Article** records are excluded from future recommendation; RSS sightings alone do not exclude an article.
- **Canonical URL** is normalized before deriving **Article ID**.
- **Article Features** are grouped by **Feature Axis** values, each with a **Feature Axis Description**, while topics use the separate **Topic Normalization Dictionary**.
- Article topic features distinguish **Primary Topic** from **Mentioned Topic**.
- The initial **Mentioned Topic Factor** is `0.3`.
- **Topic Normalization Dictionary** normalizes topic aliases, and **Unknown Topic** values are reported in weekly vocabulary maintenance.
- **Feature Vocabulary Config** is the shared source for LLM prompts, validation, **Rule Score**, and weekly vocabulary suggestions.
- **Topic Key** values live directly under `topics`; topic entries do not use an `items` wrapper.
- A **Vocabulary Skeleton** may exist before concrete feature keys are finalized.
- **Seed Weight** values belong to the initial **Preference Profile**, not the **Feature Vocabulary Config**.
- **Article Features** use **Feature Vocabulary** keys by default and **Other Signals** for candidate keys not yet promoted.
- **Vocabulary Promotion Candidates** are reported to Discord on Saturday mornings for manual review.
- Each **Article Feature** has **Feature Salience** used to scale preference updates.
- The initial **Salience Threshold** is `0.3`.
- Recommendation selection and feedback updates refer to **Feature Extraction**.
- **Digest Generation** runs only for recommended articles and may analyze the article body again.
- **Discord Post Record** stores posting metadata without duplicating **Digest Generation** text.
- An article becomes a **Recommended Article** only after a successful Discord post.
- A **Failed Extraction Attempt** may be retried if the article appears again as a **Current Feed Candidate**.
- An unreadable **Feature Extraction** is saved and not retried.
- Articles that are not **Readable Articles** are excluded from recommendation candidates.
- **Repository State** stores the **Preference Profile**, seen articles, **Feature Extraction**, digest generation output, Discord message mappings, and vocabulary suggestion history.
- Each job writes at most one **Data Commit** after its state updates are complete.
- Feedback collection reads only saved Discord message mappings that are uncollected and inside the **Feedback Collection Window**.
- **Reaction Feedback** records processing state per target emoji instead of using a message-level collected flag.
- Initial **Feedback Weight** is `+1` for positive reactions and `-1` for negative reactions.
- The initial **Feature Weight Range** is `-3.0` to `+3.0`.
- **Seed Weight** values stay within `-1.0` to `+1.0`, and the concrete initial feature set remains undecided.
- Recommendation selection first computes **Rule Score**, then applies **LLM Rerank** to choose up to ten articles.

## Example dialogue

> **Dev:** "If two Discord accounts react differently to the same article, do we maintain separate profiles?"
> **Domain expert:** "No. This is for one **Owner**, so reactions update the single **Preference Profile**."
>
> **Dev:** "Do we overwrite the preference summary every day?"
> **Domain expert:** "No. Keep **Preference Summary History** so recent feedback does not erase older preference trends."
>
> **Dev:** "Do we pass the whole preference summary history to the recommender?"
> **Domain expert:** "No. Use a **Long-Term Preference Summary** and a **Recent Preference Summary** for recommendation, and keep the full history for analysis."
>
> **Dev:** "What does recent mean for **Recent Preference Summary**?"
> **Domain expert:** "Use reactions from the last seven days, and state when there is not enough feedback to infer a reliable short-term trend."
>
> **Dev:** "Can we recommend an article if RSS gives us a title but the body fetch fails?"
> **Domain expert:** "No. Without a readable body, we cannot summarize it or learn reliable **Article Features**."
>
> **Dev:** "Do we require a minimum extracted text length before recommending an article?"
> **Domain expert:** "No. The article is readable if the LLM can summarize the fetched body reliably."
>
> **Dev:** "How do we avoid recommending the same article on multiple days?"
> **Domain expert:** "Use a stable **Article ID** derived from source and **Canonical URL**, not a date-based analysis id."
>
> **Dev:** "Does seeing an article in RSS exclude it forever?"
> **Domain expert:** "No. Only a **Recommended Article** with `first_recommended_at` is excluded from future recommendation."
>
> **Dev:** "Does feature extraction generate the Discord summary?"
> **Domain expert:** "No. **Feature Extraction** only stores readability and features; **Digest Generation** creates summary and learning points for recommended articles."
>
> **Dev:** "Do we need an external database for the first version?"
> **Domain expert:** "No. Persist state as **Repository State** so GitHub Actions runs can update it without a separate service."
>
> **Dev:** "Does feedback collection scan the whole Discord channel?"
> **Domain expert:** "No. It fetches saved message ids only when their feedback is uncollected and the article is inside the **Feedback Collection Window**."
>
> **Dev:** "Is the feedback window based on article publication time?"
> **Domain expert:** "No. The window starts at Discord `posted_at`, because feedback is only possible after the article is posted."
>
> **Dev:** "Do we treat bookmarks as preference feedback?"
> **Domain expert:** "No. Only thumbs-up and thumbs-down reactions update the **Preference Profile** in the first version, and each target reaction records its own `processed_at`."
>
> **Dev:** "What if the same article has both thumbs-up and thumbs-down?"
> **Domain expert:** "Ignore that feedback as contradictory, leave `processed_at` empty, and record `ignored_reason`."
>
> **Dev:** "Do we keep a message-level `feedback_collected_at`?"
> **Domain expert:** "No. **Reaction Feedback** owns `processed_at` per target emoji."
>
> **Dev:** "How much does a thumbs-up or thumbs-down change the profile?"
> **Domain expert:** "Use a **Feedback Weight** of `+1` for positive feedback and `-1` for negative feedback in the first version."
>
> **Dev:** "Can feature weights grow without limit?"
> **Domain expert:** "No. Clamp learned weights to the **Feature Weight Range** of `-3.0` to `+3.0`; keep **Seed Weight** values between `-1.0` and `+1.0`."
>
> **Dev:** "Do all features on a reacted article get the same update?"
> **Domain expert:** "No. Scale the **Feedback Weight** by each feature's **Feature Salience**."
>
> **Dev:** "Do lightly mentioned features update preferences?"
> **Domain expert:** "No. Only features at or above the **Salience Threshold** of `0.3` update the **Preference Profile**."
>
> **Dev:** "Can the LLM invent arbitrary feature keys?"
> **Domain expert:** "No. Use the **Feature Vocabulary** first, keep unknown but useful candidates as **Other Signals**, and promote them when they prove useful."
>
> **Dev:** "Where does the implementation read the managed feature keys from?"
> **Domain expert:** "Use **Feature Vocabulary Config** at `config/feature-vocabulary.json` as the source of truth."
>
> **Dev:** "Should we finalize all feature keys before creating the config file?"
> **Domain expert:** "No. Create a minimal **Vocabulary Skeleton** first, then fill concrete keys after they are designed."
>
> **Dev:** "Does `config/feature-vocabulary.json` store seed weights?"
> **Domain expert:** "No. It stores feature keys and Japanese descriptions; **Seed Weight** values live in the initial **Preference Profile**."
>
> **Dev:** "Do we have a generic quality_signals category?"
> **Domain expert:** "No. Split quality into observable **Feature Axis** values: `evidence_signals`, `practical_signals`, and `depth_signals`."
>
> **Dev:** "Do all technologies mentioned in an article count as topics equally?"
> **Domain expert:** "No. Distinguish **Primary Topic** from **Mentioned Topic**, and only let high-salience mentioned topics weakly affect scoring."
>
> **Dev:** "How weakly do mentioned topics count?"
> **Domain expert:** "Use a **Mentioned Topic Factor** of `0.3`."
>
> **Dev:** "Do unknown technologies go into Other Signals?"
> **Domain expert:** "No. Store them as **Unknown Topic** values so they can be reviewed for the **Topic Normalization Dictionary**."
>
> **Dev:** "Are **Other Signals** promoted automatically?"
> **Domain expert:** "No. Report **Vocabulary Promotion Candidates** to Discord on Saturday mornings for manual review."
>
> **Dev:** "Does the LLM choose recommendations from every fetched article?"
> **Domain expert:** "No. Compute **Rule Score** first, then use **LLM Rerank** on the top candidates."

## Flagged ambiguities

- "user" was used to mean the person receiving the digest and the source of preference feedback. Resolved: use **Owner** for the person and **Preference Profile** for the recommendation state.
- "article features" must not mean RSS tags only. Resolved: **Article Features** are extracted from readable article content, with tags and title treated as supporting signals.
- Feature keys must not be opaque English-only labels. Resolved: **Feature Vocabulary** entries include Japanese descriptions.
- "quality_signals" was too abstract. Resolved: use **Feature Axis** values `evidence_signals`, `practical_signals`, and `depth_signals` instead.
