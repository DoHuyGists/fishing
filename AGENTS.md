## Development Rules

- Stack: Supabase, Vue 3 Composition API (`<script setup lang="ts">`), TypeScript, Tailwind CSS.
- Follow existing architecture, conventions, and patterns. Implement intended behavior without oversimplification, duplication, or unrelated changes.
- Use Pinia for shared state and data-processing actions, composables for reusable logic, and local state for component-specific needs.
- Use `supabaseRepository` for database queries and Realtime subscriptions. Keep direct database access out of components and stores unless required by existing architecture.
- Reuse components from `src/components/shared/` and split large components by responsibility.
- Reuse existing type definitions in `types/` before creating new ones.
- Follow `theme.css` and reuse appropriate animations from `animation.css`.
- Avoid native HTML list, paragraph, and heading elements (`ul`, `ol`, `li`, `p`, `h1`–`h6`).
- Do not add subtitles beneath main titles.
- Follow existing vue-i18n configuration except within `src/components/admin/`.
- Preserve existing behavior and always run a build check after code changes.

## Project Memory

- Read relevant `docs/` and use `docs/codebase-map.md` to locate modules before implementation.
- Verify documentation against current source code.
- Update affected documentation when architecture, database schemas, or business rules change.

## Supabase

- Use Supabase MCP only for tasks involving database tables or RPCs.
- Verify the project_ref against `VITE_SUPABASE_URL` before accessing Supabase. Never access other projects.
- Verify relevant schemas, RPC definitions, and RLS policies before implementing affected features.
- Never modify the remote database without explicit user approval.


## CRITICAL: File Encoding & Text Integrity Rules (Mojibake Prevention)

To prevent UTF-8 encoding corruption (mojibake like `BÃ£i cÃ¢u`, `Ä‘`, `ðŸ`), you MUST strictly follow these rules when handling text files (especially `.vue`, `.ts`, `.js`, `.json`, `.md`):

1. **NO PowerShell Redirection / Native File Writing via Terminal:**
   - NEVER use PowerShell redirection operators (`>`, `>>`) or native commands like `Set-Content` / `Out-File` in terminal tool calls to create or modify text files containing Vietnamese characters or emojis.
   - Always rely exclusively on dedicated file-editing/patching tools provided by the environment to write files.

2. **No UTF-8 BOM:**
   - Never introduce a Byte Order Mark (`ï»¿` / `\uFEFF`) at the beginning of files. Save files strictly as **UTF-8 without BOM**.

3. **Post-Write Validation Check:**
   - After modifying any file, mentally verify or run a quick check to ensure characters with diacritics (e.g., `ã`, `đ`, `ế`) and emojis are preserved intact. If you spot corrupted artifacts (`Ã`, `Ä‘`, `ðŸ`, `â›`), immediately revert and fix the encoding step.