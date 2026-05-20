# Canonical URL-only Article Identity

Article identity is derived from the canonical URL only, not from the article source. This keeps the same article as one domain object when it is discovered through multiple paths, such as a publication feed and Hatena Bookmark RSS, while article source and discovery source remain separate descriptive attributes.

## Consequences

Existing persisted article IDs that include a source prefix must be migrated to URL-hash-only IDs when this decision is implemented.
