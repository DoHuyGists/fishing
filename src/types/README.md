# Shared types

- `model/`: domain models, gameplay contracts, component props and view state, grouped by feature.
- `table/`: database rows, records and repository write payloads, grouped by feature.

Import types directly from their feature file with `import type`. Keep runtime data, functions and repositories in their existing modules. Types derived from runtime functions may use type-only imports to preserve inference without adding runtime dependencies.
