"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";

/**
 * The single markdown renderer. Every call site goes through here so content looks identical
 * wherever it appears, and so the plugin set — especially the sanitiser — can never be forgotten
 * at one call site.
 *
 * Plugins, and why each is here:
 *  - remarkGfm       tables, task lists, strikethrough, autolinks.
 *  - remarkBreaks    a single newline becomes <br>. NOT cosmetic: guidelines written before
 *                    markdown existed here were plain text rendered with `pre-wrap`, so their
 *                    line breaks are real. Standard markdown would collapse them and silently
 *                    reflow every existing guideline into run-on paragraphs.
 *  - rehypeSanitize  MANDATORY. Content is user-authored and rendered as HTML; without this it
 *                    is stored XSS against our own staff.
 *  - rehypeSlug      Gives every heading an id so the table of contents can link to it.
 *                    Runs AFTER the sanitiser on purpose: the default sanitize schema
 *                    rewrites incoming ids with a "user-content-" prefix to prevent DOM
 *                    clobbering, which would silently break every anchor. Slugging after
 *                    means the ids are ours, machine-generated, and left untouched.
 */

const markdownSx: SxProps<Theme> = {
  color: "text.primary",
  fontSize: "0.875rem",
  lineHeight: 1.65,

  // Vertical rhythm: generous above a heading, tight below it, so a heading binds to the text
  // it introduces rather than floating between blocks.
  "& > *:first-of-type": { mt: 0 },
  "& > *:last-child": { mb: 0 },
  "& h1, & h2, & h3, & h4, & h5, & h6": {
    fontWeight: 600, lineHeight: 1.3, mt: 3, mb: 1, scrollMarginTop: "calc(var(--app-bar-height, 64px) + 16px)",
  },
  // Sized to sit UNDER the guideline title (1.5rem/700), which is rendered by the page, not
  // by markdown. Before this, "##" matched the title's size and beat it on weight, so a
  // section header out-ranked the document it belonged to.
  "& h1": { fontSize: "1.25rem" },
  "& h2": { fontSize: "1.15rem", borderBottom: "1px solid", borderColor: "divider", pb: 0.5 },
  "& h3": { fontSize: "1.05rem" },
  "& h4, & h5, & h6": { fontSize: "0.95rem" },
  "& p": { my: 1.25 },
  // Tailwind Preflight (pulled in by `@import "tailwindcss"`) applies
  //   ol, ul, menu { list-style: none; margin: 0; padding: 0 }
  // globally, so markdown lists render with no bullets or numbers at all. Restore the markers
  // HERE rather than globally: undoing Preflight app-wide would change every other list in the
  // UI. Headings survive Preflight only because their size/weight are set explicitly below.
  "& ul, & ol": { my: 1.25, pl: 3 },
  "& ul": { listStyleType: "disc" },
  "& ol": { listStyleType: "decimal" },
  "& ul ul": { listStyleType: "circle" },
  "& ul ul ul": { listStyleType: "square" },
  "& ol ol": { listStyleType: "lower-alpha" },
  "& li::marker": { color: "text.secondary" },
  "& li": { mb: 0.5 },
  "& li > ul, & li > ol": { my: 0.5 },
  "& a": { color: "primary.main", textDecoration: "underline", textUnderlineOffset: "2px" },
  "& strong": { fontWeight: 700 },
  "& hr": { border: 0, borderTop: "1px solid", borderColor: "divider", my: 3 },

  // mkdocs-style callout: coloured left rule plus a faint tint. Deliberately NOT italic —
  // these carry the plain-language summaries staff actually read, and several lines of italic
  // is measurably harder to scan than upright text. Full text colour for the same reason.
  "& blockquote": {
    my: 2, mx: 0, py: 1.25, pl: 2, pr: 1.5,
    borderLeft: "3px solid", borderColor: "primary.main",
    bgcolor: "action.hover", borderRadius: "0 4px 4px 0",
    color: "text.primary",
    "& > *:first-of-type": { mt: 0 },
    "& > *:last-child": { mb: 0 },
  },

  "& code": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.85em", bgcolor: "action.hover", px: 0.5, py: 0.25, borderRadius: 0.5,
  },
  // Wide content scrolls inside its own container instead of widening the page.
  "& pre": {
    my: 1.5, p: 1.5, bgcolor: "action.hover", borderRadius: 1, overflowX: "auto",
    "& code": { bgcolor: "transparent", p: 0, fontSize: "0.8rem" },
  },
  "& .md-table-wrap": { overflowX: "auto", my: 1.5 },
  "& table": { borderCollapse: "collapse", width: "100%", fontSize: "0.82rem" },
  "& th, & td": { border: "1px solid", borderColor: "divider", px: 1, py: 0.5, textAlign: "left" },
  "& th": { bgcolor: "action.hover", fontWeight: 600 },
  "& img": { maxWidth: "100%", height: "auto", borderRadius: 1 },
};

export default function Markdown({ children, sx }: { children: string; sx?: SxProps<Theme> }) {
  return (
    <Box sx={[markdownSx, ...(Array.isArray(sx) ? sx : [sx])] as SxProps<Theme>}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize, rehypeSlug]}
        components={{
          // Tables get their own scroll container so a wide one cannot stretch the layout.
          table: ({ children: c }) => <div className="md-table-wrap"><table>{c}</table></div>,
          // Links leave the app, so open them safely in a new tab.
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{c}</a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
}
