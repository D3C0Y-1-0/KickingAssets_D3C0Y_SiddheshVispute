# Reserved engine boundary

No intelligence implementation in Phase 1. Pure engine interfaces are documented in docs/ARCHITECTURE.md. Engines accept validated snapshot-scoped inputs and return the schemas in app/schemas/models.py; they must not read HTTP state or mutate current asset configurations. Do not add placeholder scores.
