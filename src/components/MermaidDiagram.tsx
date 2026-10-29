"use client";

import { Box, Typography } from "@mui/material";
import { useEffect, useId, useState } from "react";

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
        const { svg: rendered } = await mermaid.render(id, chart);
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
