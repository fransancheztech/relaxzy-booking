import GithubSlugger from "github-slugger";

export type TocEntry = {
  id: string;
  text: string;
  depth: number; // 1-6, matching # .. ######
};

const HEADING_RE = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^ {0,3}(```|~~~)/;

/**
 * Pull the headings out of a markdown document for the table of contents.
 *
 * Slugs are produced with the same library rehype-slug uses, walking the document in the same
 * top-to-bottom order, so the ids here match the ids rendered into the page exactly — including
 * the "-1" suffixes GithubSlugger appends to repeats. That matters: several guidelines carry
 * identical headings across their language sections (COUPLES MASSAGE has "6. Deep Tissue" in both
 * the English and Spanish versions), and without matching dedup the anchors would jump to the
 * wrong section.
 *
 * Fenced code blocks are skipped so a commented-out "# something" inside one is not mistaken for
 * a heading.
 */
export function extractToc(markdown: string): TocEntry[] {
  const slugger = new GithubSlugger();
  const entries: TocEntry[] = [];
  let inFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = line.match(HEADING_RE);
    if (!m) continue;

    // Strip inline markdown so the entry reads as plain text, mirroring what the heading renders as.
    const text = m[2]
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .trim();

    if (!text) continue;
    entries.push({ id: slugger.slug(text), text, depth: m[1].length });
  }

  return entries;
}
