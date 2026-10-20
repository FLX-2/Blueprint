import type { SourceSpan } from "@/lib/domain/types";

export type Mark = { id: string; span: SourceSpan; flagged: boolean };
export type Segment = { text: string; mark: Mark | null; selected: boolean };

/**
 * Splits the source into runs for highlighting. Quotes can overlap, so each
 * character belongs to the selected mark if it covers it, otherwise to the
 * shortest mark covering it (the most specific quote).
 */
export function segmentSource(text: string, marks: Mark[], selectedId: string | null): Segment[] {
  const owner: Array<Mark | null> = new Array(text.length).fill(null);
  const bySize = [...marks].sort((a, b) => b.span.end - b.span.start - (a.span.end - a.span.start)); // longest first…
  for (const m of bySize) for (let i = m.span.start; i < Math.min(m.span.end, text.length); i++) owner[i] = m; // …so shorter ones win
  const selected = marks.find((m) => m.id === selectedId);
  if (selected) for (let i = selected.span.start; i < Math.min(selected.span.end, text.length); i++) owner[i] = selected;

  const segments: Segment[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = segments.at(-1);
    if (last && last.mark === owner[i]) last.text += text[i];
    else segments.push({ text: text[i], mark: owner[i], selected: !!owner[i] && owner[i] === selected });
  }
  return segments;
}
