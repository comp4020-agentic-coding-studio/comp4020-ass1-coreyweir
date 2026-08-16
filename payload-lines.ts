// Beautifies a payload into lines, and records which lines each JSON path
// occupies. That second part is the point: annotations address a path (see
// steps.ts) and the view needs a line *range* to draw a highlight box around
// and to hang a marker beside — a range that stays correct if the payload's
// content is edited later. The previous approach searched the stringified JSON
// for a substring and highlighted the first line containing it, which couldn't
// express a multi-line region at all and failed silently when the text moved.
//
// Indentation is returned as a depth number rather than baked into the text,
// so the view can render it as padding (giving wrapped lines a hanging indent)
// and inset a highlight box to its region's own depth.

export type PayloadPath = readonly (string | number)[];

export interface PayloadLine {
  /** The line's JSON text, with no leading indentation. */
  text: string;
  /** Indent level. One level is the two spaces `JSON.stringify` would emit. */
  depth: number;
}

export interface PayloadRange {
  /** First/last line of the value, including its `"key":` prefix and brackets. */
  start: number;
  end: number;
  /**
   * The value's contents: a container's entries *without* its bracket lines,
   * which is what a highlight box should wrap (see the mockups — the box
   * around a message object starts at its first key, not at the `{`). Equal
   * to start/end for a primitive, or for a container written on one line.
   */
  innerStart: number;
  innerEnd: number;
  /** Indent level of the inner lines, for insetting that box. */
  innerDepth: number;
}

export interface SerialisedPayload {
  lines: PayloadLine[];
  /** Keyed by `pathKey` — every path in the payload, not just annotated ones. */
  ranges: Map<string, PayloadRange>;
}

/** A path flattened to a Map key. Unit separator: can't occur in a JSON key. */
export function pathKey(path: PayloadPath): string {
  return path.join("\u001f");
}

function entriesOf(value: object): [string | number, unknown][] {
  return Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value);
}

function writeValue(
  value: unknown,
  depth: number,
  /** Text before the value on its opening line, e.g. `"model": `. */
  prefix: string,
  /** Trailing comma, if this isn't the last entry of its parent. */
  suffix: string,
  path: PayloadPath,
  lines: PayloadLine[],
  ranges: Map<string, PayloadRange>,
): void {
  const start = lines.length;

  if (typeof value === "object" && value !== null) {
    const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
    const entries = entriesOf(value);
    if (entries.length === 0) {
      // Kept on one line: an empty container has no contents to annotate, and
      // a two-line `{`/`}` pair with nothing between them just reads as noise.
      lines.push({ text: `${prefix}${open}${close}${suffix}`, depth });
    } else {
      lines.push({ text: `${prefix}${open}`, depth });
      entries.forEach(([key, child], index) => {
        writeValue(
          child,
          depth + 1,
          Array.isArray(value) ? "" : `${JSON.stringify(String(key))}: `,
          index === entries.length - 1 ? "" : ",",
          [...path, key],
          lines,
          ranges,
        );
      });
      lines.push({ text: `${close}${suffix}`, depth });
    }
  } else {
    // ?? "null": JSON.stringify(undefined) is undefined, not a string. Authored
    // payloads shouldn't contain it, but a hole in the output is worse than a
    // visible null.
    lines.push({ text: `${prefix}${JSON.stringify(value) ?? "null"}${suffix}`, depth });
  }

  const end = lines.length - 1;
  const isBracketed = end > start;
  ranges.set(pathKey(path), {
    start,
    end,
    innerStart: isBracketed ? start + 1 : start,
    innerEnd: isBracketed ? end - 1 : end,
    innerDepth: isBracketed ? depth + 1 : depth,
  });
}

export function serialisePayload(data: unknown): SerialisedPayload {
  const lines: PayloadLine[] = [];
  const ranges = new Map<string, PayloadRange>();
  writeValue(data, 0, "", "", [], lines, ranges);
  return { lines, ranges };
}
