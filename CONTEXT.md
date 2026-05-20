# Flue Agent

Flue Agent is a personal technical digest agent that selects articles for one Owner, publishes a digest, and learns from the Owner's reactions over time.

## Language

**Owner**:
The one person who receives digests and whose preferences shape future selections.
_Avoid_: user, member, viewer

**Article**:
A source article that may be considered for a digest.
_Avoid_: post, feed item, recommendation

**Article Source**:
The publication platform or site where an article originates.
_Avoid_: digest type, workflow type, discovery source, feed provider

**Article Discovery Source**:
The external place where an article was found during feed collection.
_Avoid_: article source, publication platform, article identity source

**Article Identity**:
The stable identity of an article derived from its canonical URL.
_Avoid_: raw URL, feed URL, message ID

**Current Feed Candidate**:
An article observed in the current feed collection run.
_Avoid_: backlog item, seen article, recommendation candidate

**Readable Article**:
An article whose body can be fetched and reliably analyzed.
_Avoid_: RSS-only article, unfetchable article

**Article Feature Extraction**:
The structured article analysis produced from a readable article.
_Avoid_: recommendation content, digest text, summary

**Extracted Article**:
An article with a saved article feature extraction.
_Avoid_: readable article, digest item, recommendation

**Failed Extraction Attempt**:
A failed attempt to fetch or analyze an article body that may be retried when the article appears again.
_Avoid_: unreadable article, extracted article

**Digest**:
A set of digest items selected for one run and intended for the Owner.
_Avoid_: recommendation list, Discord post batch, workflow result

**Recommendation Candidate**:
An extracted article eligible to be selected for a digest.
_Avoid_: recommendation, scored article

**Digest Item**:
An extracted article selected for a specific digest.
_Avoid_: recommendation, selected article

**Recommendation Content**:
Owner-facing text attached to a digest item, including the recommendation reason and learning points.
_Avoid_: article summary, feature extraction, Discord message

**Published Digest Item**:
A digest item that was successfully delivered to the Owner and can receive feedback.
_Avoid_: Discord message, publication record, posted article

**Delivery Reference**:
The external destination identity for a published digest item.
_Avoid_: Discord message ID, webhook response, publication metadata

**Digest Selection Policy**:
The domain policy that chooses digest items from eligible extracted articles.
_Avoid_: recommendation algorithm, ranking script, LLM result

**Preference Profile**:
The Owner's learned article preferences used for future digest selection.
_Avoid_: user profile, per-user profile, latest feedback

**Reaction Feedback**:
A preference signal derived from an Owner reaction to a published digest item.
_Avoid_: Discord reaction, message reaction, feedback event

**Preference Summary History**:
A dated history of natural-language interpretations of the Owner's preference profile.
_Avoid_: overwritten summary, latest-only preference summary

**Article Feature Vocabulary**:
The managed vocabulary of article features and topic keys used to analyze articles.
_Avoid_: free-form tags, prompt-only vocabulary, undocumented signals

**Unknown Topic**:
A topic extracted from an article but not yet present in the article feature vocabulary.
_Avoid_: other signal, discarded topic

**Article Feature Promotion Candidate**:
An extracted signal worth reviewing for inclusion in the article feature vocabulary.
_Avoid_: vocabulary promotion candidate, auto-promoted feature, one-off signal

**Published Digest Registry**:
A record of published digest items and their delivery references.
_Avoid_: agent state, publication state, Discord log

**Article Extraction Registry**:
A record of article feature extractions and failed extraction attempts by article identity.
_Avoid_: agent state, extraction cache, runtime cache

**Article Feature Suggestion History**:
A record of article feature promotion candidates that have already been suggested.
_Avoid_: vocabulary suggestion history, agent state, maintenance state, suggestion cache

**Data Commit**:
A single repository commit that persists state changes produced by a completed job run.
_Avoid_: partial commit, per-step commit, runtime cache

## Relationships

- An **Owner** has exactly one **Preference Profile**.
- An **Article** has exactly one **Article Source**.
- A **Current Feed Candidate** has one or more **Article Discovery Sources**.
- An **Article** has one **Article Identity**.
- A **Current Feed Candidate** can become a **Readable Article** when its body is fetched.
- A **Readable Article** can produce one **Article Feature Extraction**.
- An **Extracted Article** is an **Article** with a saved **Article Feature Extraction**.
- A **Failed Extraction Attempt** can be retried if the **Article** appears again as a **Current Feed Candidate**.
- A **Recommendation Candidate** is created from an **Extracted Article**.
- A **Digest Selection Policy** chooses **Digest Items** from **Recommendation Candidates**.
- **Article Source** identifies where an **Article** came from, but does not define a separate **Digest Selection Policy**.
- **Article Discovery Source** records where an **Article** was found, but does not change the **Article Identity**.
- **Article Identity** is independent of **Article Source** so the same canonical URL remains one **Article** across discovery paths.
- A **Digest** contains one or more **Digest Items**.
- A **Digest Item** has one **Recommendation Content** before it can become a **Published Digest Item**.
- A **Published Digest Item** has one **Delivery Reference**.
- **Reaction Feedback** is derived from a **Published Digest Item**.
- **Reaction Feedback** updates the **Preference Profile**.
- **Preference Summary History** records how interpretations of the **Preference Profile** change over time.
- **Article Feature Vocabulary** constrains **Article Feature Extraction** and vocabulary maintenance.
- An **Unknown Topic** may become an **Article Feature Promotion Candidate**.
- **Published Digest Registry**, **Article Extraction Registry**, **Preference Profile**, **Preference Summary History**, and **Article Feature Suggestion History** may be stored in JSON files or SQLite through application ports.
- A completed job run writes at most one **Data Commit**.

## Example dialogue

> **Dev:** "Is a Discord reaction part of the domain?"
> **Domain expert:** "No. The infrastructure reads the Discord reaction, then the preference domain receives **Reaction Feedback** derived from a **Published Digest Item**."
>
> **Dev:** "Should a selected article be called a recommendation?"
> **Domain expert:** "No. Before selection it is a **Recommendation Candidate**; after selection it is a **Digest Item**; after delivery it is a **Published Digest Item**."
>
> **Dev:** "Do JSON files define the domain state?"
> **Domain expert:** "No. JSON files are one storage adapter. The domain speaks in registries, profiles, and histories, and application ports allow another adapter such as SQLite."

## Flagged ambiguities

- "Recommendation" was used for candidates, selected items, and published items. Resolved: use **Recommendation Candidate**, **Digest Item**, and **Published Digest Item**.
- "Agent State" was used as a broad domain object. Resolved: avoid it in domain language and use specific terms such as **Published Digest Registry**, **Article Extraction Registry**, **Preference Profile**, **Preference Summary History**, and **Article Feature Suggestion History**.
- "Discord reaction" was used as feedback. Resolved: Discord reactions are infrastructure input; **Reaction Feedback** is the domain signal.
