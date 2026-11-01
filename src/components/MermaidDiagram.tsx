"use client";

import { Box, Typography } from "@mui/material";
import { useEffect, useId, useState } from "react";

/** A block diagram ("block-beta" / "block"), after any `---` config frontmatter. */
function isBlockDiagram(chart: string) {
  const body = chart.replace(/^---[\s\S]*?\n---\s*\n/, "").trimStart();
  return /^block(-beta)?\b/.test(body);
}

// How many block diagrams are rendering right now, so the patch below is removed only by the last.
let stringifyPatches = 0;
const nativeStringify = JSON.stringify;

/**
 * Workaround for a Mermaid bug (still in 12.2.0) that breaks every block diagram in this app.
 *
 * After laying out a block diagram, Mermaid builds a debug message with JSON.stringify(layout) —
 * even with debug logging off. The layout keeps d3 selections, which point at <html>, and React
 * stores its own (circular) data on <html> in a Next.js app, so the call throws "Converting
 * circular structure to JSON" and the diagram never renders. Outside React it works, which is why
 * Mermaid's own live editor doesn't show the problem.
 *
 * While a block diagram renders, JSON.stringify leaves page elements out (they'd only be "{}" or
 * an error anyway); everything else serialises exactly as before.
 */
async function withDomSafeStringify<T>(render: () => Promise<T>): Promise<T> {
  if (stringifyPatches++ === 0) {
    JSON.stringify = function (value: unknown, replacer?: unknown, space?: string | number) {
      if (Array.isArray(replacer)) return nativeStringify(value, replacer, space);
      return nativeStringify(
        value,
        function (this: unknown, key: string, v: unknown) {
          if (typeof Node !== "undefined" && v instanceof Node) return undefined;
          return typeof replacer === "function" ? replacer.call(this, key, v) : v;
        },
        space,
      );
    } as typeof JSON.stringify;
  }
  try {
    return await render();
  } finally {
    if (--stringifyPatches === 0) JSON.stringify = nativeStringify;
  }
}

/**
 * A ```mermaid block from a guideline, drawn as a diagram (Gantt timelines, flowcharts, …).
 *
 * - The Mermaid library is large, so it is imported only when a diagram is actually on screen:
 *   pages without one never download it.
 * - securityLevel "strict": guidelines are written by staff and rendered for everyone, so Mermaid
 *   sanitises labels and disables click handlers / HTML in labels. Its output SVG is then the only
 *   HTML injected here.
 * - A diagram with a syntax error shows its source and the error instead of breaking the page.
 */
export default function MermaidDiagram({ chart }: { chart: string }) {
  // Mermaid uses the id for the SVG element: it must be a valid CSS identifier.
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
        const { svg: rendered } = isBlockDiagram(chart)
          ? await withDomSafeStringify(() => mermaid.render(id, chart))
          : await mermaid.render(id, chart);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <Box sx={{ my: 1.5 }}>
        <Typography variant="caption" color="error" component="div" sx={{ mb: 0.5 }}>
          {error}
        </Typography>
        <pre><code>{chart}</code></pre>
      </Box>
    );
  }

  return (
    <Box
      sx={{ my: 1.5, overflowX: "auto", "& svg": { maxWidth: "100%", height: "auto" } }}
      // Reserve a little space while it renders so the text below doesn't jump as much.
      style={{ minHeight: svg ? undefined : 120 }}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
