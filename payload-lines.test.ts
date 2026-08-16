import { describe, expect, it } from "vitest";
import { pathKey, serialisePayload } from "./payload-lines";
import { STEPS } from "./steps";

/** The lines re-joined with their indentation, for comparing against JSON.stringify. */
function render(data: unknown): string {
  return serialisePayload(data)
    .lines.map(({ text, depth }) => "  ".repeat(depth) + text)
    .join("\n");
}

describe("serialisePayload", () => {
  it("beautifies exactly like JSON.stringify(_, null, 2)", () => {
    const data = {
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      meta: {},
      nested: { a: [1, 2, { b: true, c: null }] },
    };
    expect(render(data)).toBe(JSON.stringify(data, null, 2));
  });

  it("keeps a value's whole range, and its contents separately", () => {
    const { ranges } = serialisePayload({
      model: "x",
      messages: [{ role: "user" }],
    });

    // Line 0 is `{`, 1 is `"model"`, 2 is `"messages": [`, 3 is `{`,
    // 4 is `"role"`, 5 is `}`, 6 is `]`, 7 is `}`.
    expect(ranges.get(pathKey(["model"]))).toMatchObject({ start: 1, end: 1 });
    expect(ranges.get(pathKey(["messages"]))).toMatchObject({
      start: 2,
      end: 6,
      innerStart: 3,
      innerEnd: 5,
    });
    // A highlight box for messages[0] wraps its keys, not its braces.
    expect(ranges.get(pathKey(["messages", 0]))).toMatchObject({
      start: 3,
      end: 5,
      innerStart: 4,
      innerEnd: 4,
    });
  });

  it("gives a primitive the same range as its contents", () => {
    const { ranges } = serialisePayload({ a: 1 });
    expect(ranges.get(pathKey(["a"]))).toMatchObject({
      start: 1,
      end: 1,
      innerStart: 1,
      innerEnd: 1,
    });
  });

  it("treats an empty container as one line", () => {
    const { lines, ranges } = serialisePayload({ tools: [] });
    expect(lines[1]?.text).toBe('"tools": []');
    expect(ranges.get(pathKey(["tools"]))).toMatchObject({ start: 1, end: 1 });
  });

  it("records the depth used to inset a highlight box", () => {
    const { ranges } = serialisePayload({ usage: { tokens: 1 } });
    // Contents of `usage` sit two levels in: root object, then usage.
    expect(ranges.get(pathKey(["usage"]))?.innerDepth).toBe(2);
  });
});

describe("annotation paths in steps.ts", () => {
  const cases = STEPS.flatMap((step) =>
    step.sections.map((section) => ({ step, section })),
  );

  // The whole reason for addressing annotations by path is that a wrong path
  // should be a caught error, not a silently-missing highlight at runtime.
  for (const { step, section } of cases) {
    it(`${step.id}/${section.id} annotations all resolve`, () => {
      const { ranges } = serialisePayload(section.payload.data);
      for (const annotation of section.payload.annotations) {
        expect(
          ranges.has(pathKey(annotation.path)),
          `no such path in payload: ${JSON.stringify(annotation.path)}`,
        ).toBe(true);
      }
    });
  }

  it("covers every section", () => {
    expect(cases.length).toBe(STEPS.reduce((n, step) => n + step.sections.length, 0));
    expect(cases.length).toBeGreaterThan(5);
  });
});
