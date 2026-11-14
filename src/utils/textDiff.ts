/**
 * A line-by-line comparison of two texts, for showing what one save changed. Lines are matched
 * with a longest-common-subsequence diff; a changed line paired with its replacement is also
 * compared word by word, so a one-character edit in a long paragraph is easy to spot.
 */

export type DiffPart = { type: "same" | "removed" | "added"; text: string };

export type DiffRow =
  | { type: "same" | "removed" | "added"; text: string; parts?: DiffPart[] }
  | { type: "skip"; count: number };

/** Longest-common-subsequence diff of two token lists. */
function diffTokens(a: string[], b: string[]): DiffPart[] {
  // Most saves touch a few lines: skip the shared start and end so the table stays small.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  const cols = B.length + 1;
  // lcs[i * cols + j] = length of the longest common subsequence of A[i..] and B[j..].
  const lcs = new Uint32Array((A.length + 1) * cols);
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      lcs[i * cols + j] =
        A[i] === B[j] ? lcs[(i + 1) * cols + j + 1] + 1 : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
    }
  }

  const parts: DiffPart[] = a.slice(0, start).map((text) => ({ type: "same", text }));
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      parts.push({ type: "same", text: A[i] });
      i++;
      j++;
    } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
      parts.push({ type: "removed", text: A[i++] });
    } else {
      parts.push({ type: "added", text: B[j++] });
    }
  }
  while (i < A.length) parts.push({ type: "removed", text: A[i++] });
  while (j < B.length) parts.push({ type: "added", text: B[j++] });
  for (const text of a.slice(endA)) parts.push({ type: "same", text });
  return parts;
}

// Words, runs of punctuation and runs of spaces, so "recepción." → "recepción.." marks only "..".
const tokenize = (line: string) => line.split(/(\s+|[^\p{L}\p{N}\s]+)/u).filter(Boolean);

/**
 * The rows to show for `before` → `after`: changed lines, `context` unchanged lines around each
 * change, and a "skip" row for every longer run of unchanged lines. Empty when nothing changed.
 */
export function diffLines(before: string, after: string, context = 2): DiffRow[] {
  const lines = (s: string) => s.replace(/\r\n/g, "\n").split("\n");
  const ops = diffTokens(lines(before), lines(after));
  if (ops.every((op) => op.type === "same")) return [];

  // Within each block of changed lines, pair the n-th removed line with the n-th added one.
  const rows: Extract<DiffRow, { text: string }>[] = [];
  for (let k = 0; k < ops.length; ) {
    if (ops[k].type === "same") {
      rows.push({ type: "same", text: ops[k].text });
      k++;
      continue;
    }
    const removed: string[] = [];
    const added: string[] = [];
    for (; k < ops.length && ops[k].type !== "same"; k++) {
      (ops[k].type === "removed" ? removed : added).push(ops[k].text);
    }
    const pairs = Math.min(removed.length, added.length);
    const words = removed.slice(0, pairs).map((r, p) => diffTokens(tokenize(r), tokenize(added[p])));
    removed.forEach((text, p) =>
      rows.push({ type: "removed", text, parts: p < pairs ? words[p].filter((w) => w.type !== "added") : undefined }),
    );
    added.forEach((text, p) =>
      rows.push({ type: "added", text, parts: p < pairs ? words[p].filter((w) => w.type !== "removed") : undefined }),
    );
  }

  // Keep unchanged lines only near a change.
  const near = rows.map(() => false);
  rows.forEach((row, k) => {
    if (row.type === "same") return;
    for (let d = Math.max(0, k - context); d <= Math.min(rows.length - 1, k + context); d++) near[d] = true;
  });
  const out: DiffRow[] = [];
  rows.forEach((row, k) => {
    if (row.type !== "same" || near[k]) {
      out.push(row);
      return;
    }
    const last = out[out.length - 1];
    if (last?.type === "skip") last.count++;
    else out.push({ type: "skip", count: 1 });
  });
  return out;
}
