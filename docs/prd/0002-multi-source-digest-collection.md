# Multi-source Digest Collection

## Problem Statement

The Owner currently receives a Digest from Zenn only. This limits discovery because many useful technical Articles appear first on Hatena Blog topics, Hatena Bookmark technology hot entries, Hatena Bookmark technology entry lists, company engineering blogs, and independent technical sites. The Owner wants the same Digest Selection Policy, Preference Profile, Article Feature Extraction, Recommendation Content, and feedback loop to work across these discovery paths without duplicating the digest pipeline or treating the same canonical URL as multiple Articles.

## Solution

Extend feed collection so the Digest can collect Current Feed Candidates from Zenn, Hatena Blog technology topics, and Hatena Bookmark technology RSS feeds. Keep collection adapters source-specific, but share all downstream digest logic after Current Feed Candidate creation. Article Identity will be derived from the canonical URL only, while Article Source and Article Discovery Source remain separate descriptive attributes. Existing persisted state will be normalized from legacy source-prefixed Article IDs to canonical URL hash Article IDs when loaded, then saved back in the new shape.

## User Stories

1. As the Owner, I want the Digest to include useful technical Articles discovered outside Zenn, so that I do not miss relevant work published elsewhere.
2. As the Owner, I want Hatena Blog technology topic Articles to be considered, so that Hatena Blog-native technical writing can appear in my Digest.
3. As the Owner, I want Hatena Bookmark technology hot entries to be considered, so that widely discussed technical Articles can appear in my Digest.
4. As the Owner, I want Hatena Bookmark technology new entries to be considered, so that newer technical Articles can be discovered before they become hot entries.
5. As the Owner, I want Articles discovered through Hatena Bookmark RSS to keep their true publication origin, so that a bookmarked Zenn Article is still understood as a Zenn Article.
6. As the Owner, I want Articles discovered through multiple feeds to be deduplicated, so that the same canonical URL does not appear twice in one Digest.
7. As the Owner, I want a Zenn Article discovered through both Zenn and Hatena Bookmark to reuse the same Article Feature Extraction, so that the system does not waste LLM work.
8. As the Owner, I want a previously Published Digest Item to stay recognized after Article ID migration, so that it is not recommended again as a new Article.
9. As the Owner, I want the existing scoring and reranking behavior to remain the same, so that adding discovery sources does not reset my learned preferences.
10. As the Owner, I want Article Source to avoid creating a separate Digest Selection Policy, so that Source does not become a hidden fixed preference weight.
11. As the Owner, I want Article Discovery Source to be retained for audit, so that I can understand where an Article was found.
12. As the Owner, I want feed-level failures to remain partial failures, so that one broken Hatena feed does not prevent all other feeds from producing a Digest.
13. As the Owner, I want the workflow to fail when all configured feeds fail, so that silent empty Digests are not treated as successful runs.
14. As the Owner, I want Hatena Blog topic pages to be parsed into Current Feed Candidates, so that non-RSS discovery pages can still feed the shared digest pipeline.
15. As the Owner, I want Hatena Bookmark RSS feeds to be parsed into Current Feed Candidates, so that RSS discovery still uses the same collection behavior as Zenn.
16. As the Owner, I want body fetching to work for Zenn, Hatena Blog, and general web Articles, so that Readable Articles can be extracted regardless of discovery path.
17. As the Owner, I want Article authors or publishers to be captured where possible, so that Recommendation Content and audit output can show useful origin context.
18. As the Owner, I want Articles without reliable body text to become Failed Extraction Attempts or body fetch failures, so that they are retried only when appropriate.
19. As the Owner, I want existing Recommendation Content history to migrate to canonical URL hash Article IDs, so that historical content remains linked to the same Article.
20. As the Owner, I want existing Article Extraction Registry entries to migrate to canonical URL hash Article IDs, so that extracted features remain reusable.
21. As the Owner, I want existing Published Digest Registry entries to migrate to canonical URL hash Article IDs, so that duplicate prevention continues to work.
22. As the Owner, I want the runtime entrypoint to be source-agnostic, so that "Digest" means a multi-source digest rather than a Zenn-only digest.
23. As a developer, I want source-specific collection adapters behind stable application ports, so that new discovery sources can be added without changing Digest Selection Policy.
24. As a developer, I want Article Identity generation to be independent from Article Source, so that identity is stable across discovery paths.
25. As a developer, I want legacy Article IDs normalized on load, so that old JSON state remains usable without a separate manual migration step.
26. As a developer, I want tests for URL-only Article Identity, so that source-prefixed IDs do not sneak back into the domain.
27. As a developer, I want tests for state normalization, so that old persisted state and new persisted state both load safely.
28. As a developer, I want tests for composite feed reading, so that source-specific readers can be combined without leaking infrastructure decisions into application logic.
29. As a developer, I want tests for Hatena Blog topic parsing, so that page structure changes fail loudly and locally.
30. As a developer, I want tests for Hatena Bookmark RSS parsing, so that feed entries become valid Article Feed Entries.
31. As a developer, I want tests for duplicate discovery across Zenn and Hatena Bookmark, so that one canonical URL becomes one Current Feed Candidate.
32. As a developer, I want the existing Digest workflow tests to continue passing, so that collection changes do not regress scoring, reranking, publishing, or audit behavior.

## Implementation Decisions

- Rename the Zenn-specific application and workflow concepts to source-agnostic Digest concepts. The existing workflow is already mostly generic, so the implementation should preserve the load, collect, extract, readable selection, score, rerank, content creation, publish, audit, and save sequence.
- Keep presentation as the composition root. It wires state repositories, Article Feature Vocabulary loading, Zenn adapters, Hatena Blog adapters, Hatena Bookmark adapters, body fetchers, LLM adapters, Discord publishers, and logging.
- Keep source-specific infrastructure adapters. Zenn, Hatena Blog topic pages, and Hatena Bookmark RSS feeds should have named adapters rather than a broad runtime facade.
- Introduce or clarify Article Discovery Source as the discovery path where an Article was found. Discovery source should be retained in feed appearance data and audit context, but it must not affect Article Identity.
- Keep Article Source as the publication platform or site where an Article originates. The initial source vocabulary should include Zenn, Hatena Blog, and an "other" category for sources that do not match known platforms.
- Derive Article Identity from canonical URL only. This is recorded in ADR 0006. Article Source must not be part of Article ID generation.
- Normalize legacy source-prefixed Article IDs on repository load. Save operations should persist the normalized URL-hash-only IDs.
- Normalize Article IDs consistently across Article Extraction Registry, Published Digest Registry, Recommendation Content History, and any related digest state that stores Article IDs.
- Treat Hatena Blog technology topics as a collection adapter that reads topic page HTML and emits Article Feed Entries.
- Treat Hatena Bookmark technology hot entries and entry lists as RSS collection adapters that emit Article Feed Entries.
- Preserve feed-level partial failure semantics. A single failed feed records a collection failure; all feeds failing still fails the workflow.
- Preserve canonical URL-based duplicate merging in Current Feed Candidate collection.
- Use a composite feed reader or equivalent dispatching adapter so each Article Feed is read by the correct source-specific reader while the application use case still sees one feed reader port.
- Use a composite body fetcher or equivalent dispatching adapter so Article bodies can be fetched from Zenn, Hatena Blog, and other web pages while the feature extraction use case still sees one body fetch port.
- Keep Digest Selection Policy source-neutral. Article Source and Article Discovery Source may be available for audit or explanation, but they should not introduce fixed selection weights.
- Keep the existing quality criteria for LLM rerank.
- Keep the existing maximum recommendation behavior unless a separate PRD changes it.
- Keep existing script aliases working where practical, but add or prefer a source-agnostic digest script name for future use.
- Update digest flow documentation so it no longer describes the system as Zenn-only.

## Testing Decisions

- Tests should verify external behavior through public domain functions, application use cases, and infrastructure parser adapters. Avoid tests that depend on private helper names or the internal order of refactors.
- Test Article ID validation and Article Identity creation with canonical URL hash-only IDs, including rejection of malformed IDs.
- Test migration normalization by loading representative legacy source-prefixed Article IDs and asserting the returned registries use URL-hash-only IDs.
- Test that saving after normalization persists the new Article ID shape.
- Test Current Feed Candidate collection with the same canonical URL discovered through multiple Article Discovery Sources and assert one candidate with multiple feed appearances.
- Test that Article Source does not alter Article Identity for the same canonical URL.
- Test Hatena Blog topic page parsing with local HTML fixtures that include title, URL, and nullable published date behavior.
- Test Hatena Bookmark RSS parsing with local RSS fixtures for technology hot entries and entry lists.
- Test composite feed reader behavior by dispatching feeds to source-specific readers and surfacing per-feed failures.
- Test composite body fetcher behavior by routing Zenn, Hatena Blog, and other URLs to the intended body fetch behavior.
- Keep existing workflow tests that cover no scored candidates, rerank, content creation, publishing, audit output, and state saving.
- Reuse the style of existing colocated domain tests for Article Identity and Current Feed Candidate behavior.
- Reuse the style of existing infrastructure parser tests for RSS and author extraction behavior.
- Reuse the style of existing workflow tests for orchestration behavior and state save behavior.

## Out of Scope

- Changing the Digest Selection Policy scoring formula.
- Adding fixed source-based boosts or penalties.
- Changing Preference Profile learning behavior.
- Changing Discord publishing behavior beyond displaying any newly available publisher/source context.
- Adding a UI for feed configuration.
- Adding personalized per-source weights.
- Guaranteeing complete publisher metadata for every external site.
- Building a crawler beyond the configured feeds and topic pages.
- Implementing a database-backed state store.
- Reprocessing all historical Article Feature Extractions with a new LLM prompt.

## Further Notes

- The source-agnostic Digest design follows the existing feature-aligned functional DDD boundary decision.
- Article Identity migration is intentionally documented as an ADR because it is hard to reverse, surprising without context, and the result of a real trade-off between source-qualified IDs and cross-discovery deduplication.
- The first implementation should prefer small, well-tested deep modules: Article ID normalization, source/discovery classification, Hatena Blog topic parsing, Hatena Bookmark RSS parsing, composite feed reading, and composite body fetching.
