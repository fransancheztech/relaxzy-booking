/**
 * Flatten markdown to plain text for places that must stay one short line — the guidelines side
 * nav and the delete confirmation. Without this they would start showing raw syntax ("## Opening
 * checklist", "**Always**") the moment content became markdown.
 *
 * Deliberately a regex pass rather than a real parse: these are previews, and pulling a full
 * AST in to truncate 50 characters is not worth the bundle. Order matters — code fences first
 * so their contents are not treated as syntax, links before emphasis so `[**x**](y)` degrades
 * sensibly.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")                      // fenced code blocks
    .replace(/`([^`]*)`/g, "$1")                          // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")             // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")              // links -> link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")                   // headings
    .replace(/^\s{0,3}>\s?/gm, "")                        // blockquotes
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "")          // list markers
    .replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, " ") // horizontal rules
    .replace(/(\*\*|__)(.*?)\1/g, "$2")                   // bold
    .replace(/(\*|_)(.*?)\1/g, "$2")                      // italic
    .replace(/~~(.*?)~~/g, "$1")                          // strikethrough
    .replace(/\s+/g, " ")
    .trim();
}
