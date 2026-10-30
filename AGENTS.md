- Stack: Supabase, Vue 3 Composition API (`<script setup>`), TypeScript, Tailwind CSS.
- State & logic: Use Pinia stores for state management, dynamic data, and data-processing actions.
- Database: Use `supabaseRepository` for Supabase queries and Realtime subscriptions. Keep database access out of components and stores unless existing architecture explicitly requires otherwise.
- Follow existing architecture, conventions, and patterns. Implement intended behavior, not merely minimum literal requirements.
- Reuse `src/components/shared/*`. Create components only if no suitable component exists or existing components cover less than 30% of essential requirements.
- Preferred UI colors: `border-[#cbd9c6]`, `bg-[#f5f9f0]`, `text-[#24352a]`.
- Avoid duplication, unrelated changes, and oversimplification. Preserve existing behavior and validate changes when practical.
- Always run a build check after changing code


## ⚠️ CRITICAL: File Encoding & Text Integrity Rules (Mojibake Prevention)

To prevent UTF-8 encoding corruption (mojibake like `BÃ£i cÃ¢u`, `Ä‘`, `ðŸ`), you MUST strictly follow these rules when handling text files (especially `.vue`, `.ts`, `.js`, `.json`, `.md`):

1. **NO PowerShell Redirection / Native File Writing via Terminal:**
   - NEVER use PowerShell redirection operators (`>`, `>>`) or native commands like `Set-Content` / `Out-File` in terminal tool calls to create or modify text files containing Vietnamese characters or emojis.
   - Always rely exclusively on dedicated file-editing/patching tools provided by the environment to write files.

2. **No UTF-8 BOM:**
   - Never introduce a Byte Order Mark (`ï»¿` / `\uFEFF`) at the beginning of files. Save files strictly as **UTF-8 without BOM**.

3. **Post-Write Validation Check:**
   - After modifying any file, mentally verify or run a quick check to ensure characters with diacritics (e.g., `ã`, `đ`, `ế`) and emojis are preserved intact. If you spot corrupted artifacts (`Ã`, `Ä‘`, `ðŸ`, `â›`), immediately revert and fix the encoding step.