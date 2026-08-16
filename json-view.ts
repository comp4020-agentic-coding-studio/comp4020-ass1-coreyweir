// Turns a PayloadBlock (see steps.ts) into a syntax-highlighted, annotated
// JSON box: beautified JSON on the left/top, numbered markers inline at the
// annotated lines, and a matching numbered note list. Clicking a marker or
// its note toggles a shared highlight on both — the actual API request/
// response shape is the point, not a diagram of it.

import type { PayloadBlock } from "./steps";

const TOKEN_RE =
  /(?<key>"(?:\\.|[^"\\])*")(?=\s*:)|(?<string>"(?:\\.|[^"\\])*")|(?<bool>\btrue\b|\bfalse\b)|(?<null>\bnull\b)|(?<number>-?\d+(?:\.\d+)?)/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wraps JSON tokens on a single line in classed spans for CSS highlighting. */
function highlightLine(line: string): string {
  let out = "";
  let lastIndex = 0;
  for (const match of line.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    out += escapeHtml(line.slice(lastIndex, index));
    const groups = match.groups ?? {};
    const [cls, text] = groups.key
      ? ["tok-key", groups.key]
      : groups.string
        ? ["tok-string", groups.string]
        : groups.bool
          ? ["tok-bool", groups.bool]
          : groups.null
            ? ["tok-null", groups.null]
            : ["tok-number", groups.number ?? ""];
    out += `<span class="${cls}">${escapeHtml(text)}</span>`;
    lastIndex = index + match[0].length;
  }
  out += escapeHtml(line.slice(lastIndex));
  return out;
}

/** Finds, for each annotation, the first JSON line containing its match text. */
function assignAnnotationsToLines(lines: string[], block: PayloadBlock): number[][] {
  const byLine: number[][] = lines.map(() => []);
  block.annotations.forEach((annotation, annotationIndex) => {
    const lineIndex = lines.findIndex((line) => line.includes(annotation.match));
    if (lineIndex === -1) {
      console.warn(
        `[json-view] annotation match not found in "${block.label}": ${JSON.stringify(annotation.match)}`,
      );
      return;
    }
    byLine[lineIndex]?.push(annotationIndex);
  });
  return byLine;
}

function toggleSharedHighlight(scope: HTMLElement, event: MouseEvent): void {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>("[data-annotation]");
  if (!trigger) return;
  const index = trigger.dataset.annotation;
  const wasActive = trigger.classList.contains("is-active");
  for (const node of scope.querySelectorAll<HTMLElement>("[data-annotation]")) {
    node.classList.remove("is-active");
  }
  if (!wasActive && index !== undefined) {
    for (const node of scope.querySelectorAll<HTMLElement>(`[data-annotation="${index}"]`)) {
      node.classList.add("is-active");
    }
  }
}

export function renderPayloadBlock(block: PayloadBlock): HTMLElement {
  const json = JSON.stringify(block.data, null, 2);
  const lines = json.split("\n");
  const lineAnnotations = assignAnnotationsToLines(lines, block);

  const figure = document.createElement("figure");
  figure.className = "payload-block";

  const caption = document.createElement("figcaption");
  caption.textContent = block.label;
  figure.append(caption);

  const pre = document.createElement("pre");
  pre.className = "payload-json";
  const code = document.createElement("code");

  lines.forEach((lineText, lineIndex) => {
    const lineEl = document.createElement("div");
    lineEl.className = "payload-line";
    lineEl.innerHTML = highlightLine(lineText);
    for (const annotationIndex of lineAnnotations[lineIndex] ?? []) {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "annotation-marker";
      marker.textContent = String(annotationIndex + 1);
      marker.dataset.annotation = String(annotationIndex);
      marker.setAttribute(
        "aria-label",
        `Annotation ${annotationIndex + 1}: ${block.annotations[annotationIndex]?.note ?? ""}`,
      );
      lineEl.append(" ", marker);
    }
    code.append(lineEl);
  });

  pre.append(code);
  figure.append(pre);

  if (block.annotations.length > 0) {
    const notes = document.createElement("ol");
    notes.className = "payload-annotations";
    block.annotations.forEach((annotation, annotationIndex) => {
      const li = document.createElement("li");
      li.dataset.annotation = String(annotationIndex);
      li.tabIndex = 0;
      li.textContent = annotation.note;
      notes.append(li);
    });
    figure.append(notes);
    figure.addEventListener("click", (event) => toggleSharedHighlight(figure, event));
  }

  return figure;
}
