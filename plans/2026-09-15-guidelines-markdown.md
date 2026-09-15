# Guidelines: markdown rendering (mkdocs-style)

## Goal

Let guidelines be written in markdown and rendered with the typography of an mkdocs-Material
page, so a long procedure reads as a structured document rather than a wall of plain text.

## Scope

**In:** markdown rendering, safe HTML, mkdocs-like content styling, an authoring preview.

**Deferred, deliberately:**

- **Images.** There is *no upload infrastructure anywhere in this codebase* — no storage bucket
  usage, no upload route, no file handling. Everything in the app is a Postgres row. Images mean
  building a new subsystem (bucket + policies, upload route, paste-from-clipboard, URL insertion,
  orphan cleanup, resizing) with a permanent maintenance tail. It is a separate project, and a
  good share of what images get used for is actually structure and emphasis, which markdown
  alone delivers. Decide it *after* living with markdown for a while.
- **Document hierarchy** (mkdocs' left nav tree, multi-page sections). That is an information
  architecture change: guidelines stops being a flat list of records and becomes a document tree
  needing `parent_id`, ordering and slugs. The page already has a working per-guideline nav.
- **WYSIWYG.** A much larger project that fights markdown rather than complementing it.

## Current state

- Two-column page: left nav (one entry per guideline, scroll-to + scroll-spy), right content.
- Each guideline is a `Paper` card: optional title, content rendered as
  `<Typography sx={{ whiteSpace: "pre-wrap" }}>{g.content}</Typography>`, role chips.
- Editing is admin-only via `GuidelineDialog`, a `multiline rows={6}` TextField.
- `target_roles` visibility already works (exact role match, admin sees all).

## The migration risk that matters

Existing guidelines are **plain text rendered with `pre-wrap`**, so single newlines currently
show as line breaks. In standard markdown a single newline collapses into the same paragraph.
Switching the renderer naively would silently reflow every guideline written so far — lists
typed as plain lines would run together.

**Mitigation:** include `remark-breaks`, which maps a single newline to `<br>`. Existing content
keeps its current shape, and new content can still use full markdown. This is cheap to include
now and painful to discover later from a confused receptionist.

## Security

`rehype-sanitize` is **not optional**. Content is user-authored and would be rendered as HTML;
without sanitising, this is stored XSS against our own staff. It goes in with the first commit,
not as a follow-up.

## Phases

### Phase 1 — Rendering (ship on its own)

1. Add `react-markdown`, `remark-gfm`, `remark-breaks`, `rehype-sanitize`.
2. New `src/components/Markdown.tsx`: one wrapper that applies the plugins and a styled `Box`
   so every call site renders identically. MUI-themed headings, lists, tables, code, blockquotes,
   links; sensible vertical rhythm; long tables and code blocks scroll inside their own container
   rather than widening the page.
3. Swap the guideline card body to `<Markdown>`.
4. **Fix the plain-text previews**, which would otherwise start showing raw `##` and `**`:
   - `navLabel()` — the left nav entry
   - `handleDelete()` — the confirm dialog label
   Both need a small strip-markdown helper.

### Phase 2 — Authoring

5. `GuidelineDialog` gets **Edit | Preview** tabs over the same content, reusing `<Markdown>`.
6. A short formatting hint under the editor (bold, headings, lists, links) — the receptionists
   have not used markdown before, so discoverability matters more than completeness.

### Phase 3 — mkdocs polish (optional, decide after seeing Phase 1)

7. Heading-based table of contents per guideline.
8. Admonitions (`!!! note` / `> [!NOTE]`) — mkdocs' signature block. Needs a directive plugin or
   a blockquote convention; worth it only if the content actually calls for callouts.
9. Copy button on code blocks, anchor links on headings.

## Open questions

- **mkdocs "output style" = the look, not the structure?** Assumed yes (typography, spacing,
  callouts), since the page's existing nav already covers document-to-document navigation.
- **TOC placement**, if Phase 3 happens: a right-hand column like mkdocs, or inline at the top of
  each card? The left column is already taken by the guideline list.

## Risks

- Low overall: rendering-only change, no schema change, no migration, no new endpoints.
- The reflow risk above is the one real hazard, and `remark-breaks` addresses it.
- Bundle size: tens of KB for the markdown stack, on an admin-facing page. Acceptable.
