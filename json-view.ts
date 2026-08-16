// Renders a payload as a terminal-style window of syntax-highlighted JSON,
// with each annotated region wrapped in its own element so the highlight box
// and the marker beside it are positioned by layout rather than by measuring
// anything. Regions come from JSON paths (see payload-lines.ts), so they nest
// properly and survive rewrapping at any width — no JS runs on resize.

import { pathKey, serialisePayload, type PayloadLine } from "./payload-lines";
import type { Payload } from "./steps";

export interface PayloadViewOptions {
  /** Indices of annotations whose card is open. Owned by the carousel's state. */
  open: readonly number[];
  onToggle: (annotationIndex: number) => void;
}

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

/**
 * An annotated span of lines. Because these come from JSON paths, one region
 * is always either wholly inside another or wholly outside it — never half
 * overlapping — so they form a tree and can be rendered as nested elements.
 */
interface Region {
  annotationIndex: number;
  start: number;
  end: number;
  /** Indent level of the region's lines, used to inset it from the box edge. */
  depth: number;
  children: Region[];
}

function contains(outer: Region, inner: Region): boolean {
  return outer.start <= inner.start && outer.end >= inner.end;
}

/** Nests regions by containment. Outer-first ordering makes one pass enough. */
function buildRegionTree(regions: Region[]): Region[] {
  const sorted = [...regions].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.annotationIndex - b.annotationIndex,
  );
  const roots: Region[] = [];
  const stack: Region[] = [];
  for (const region of sorted) {
    while (stack.length > 0 && !contains(stack[stack.length - 1]!, region)) stack.pop();
    (stack[stack.length - 1]?.children ?? roots).push(region);
    stack.push(region);
  }
  return roots;
}

function resolveRegions(payload: Payload): Region[] {
  const { ranges } = serialisePayload(payload.data);
  const regions: Region[] = [];
  payload.annotations.forEach((annotation, annotationIndex) => {
    const range = ranges.get(pathKey(annotation.path));
    if (!range) {
      // payload-lines.test.ts asserts every authored path resolves, so this is
      // a belt-and-braces guard rather than an expected runtime state.
      console.warn(`[json-view] no such path in ${payload.label}:`, annotation.path);
      return;
    }
    regions.push({
      annotationIndex,
      start: range.innerStart,
      end: range.innerEnd,
      depth: range.innerDepth,
      children: [],
    });
  });
  return buildRegionTree(regions);
}

/** Indentation as padding, not literal spaces, so wrapped lines hang-indent. */
function renderLine(line: PayloadLine, enclosingDepth: number): HTMLElement {
  const el = document.createElement("span");
  el.className = "payload-line";
  el.style.setProperty("--indent", String(Math.max(0, line.depth - enclosingDepth)));
  el.innerHTML = highlightLine(line.text);
  return el;
}

function buildMarker(
  region: Region,
  payload: Payload,
  options: PayloadViewOptions,
): HTMLElement {
  const annotation = payload.annotations[region.annotationIndex];
  const isOpen = options.open.includes(region.annotationIndex);

  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "annotation-marker";
  marker.dataset.annotation = String(region.annotationIndex);
  marker.setAttribute("aria-expanded", String(isOpen));
  marker.setAttribute(
    "aria-label",
    `Annotation ${region.annotationIndex + 1}: ${annotation?.title ?? ""}`,
  );

  // The number is hidden (by CSS) once the card is open, because the card's own
  // heading carries it — the marker shrinks to the dot the leader line meets.
  const num = document.createElement("span");
  num.className = "annotation-marker-num";
  num.textContent = String(region.annotationIndex + 1);
  marker.append(num);

  marker.addEventListener("click", (event) => {
    event.stopPropagation();
    options.onToggle(region.annotationIndex);
  });
  return marker;
}

/**
 * Walks `lines[from..to]`, emitting plain lines and recursing into regions.
 * `enclosingDepth` is the indent level already applied by ancestor elements,
 * so each level only adds its own step in — which is what makes a region's
 * box start at its first key rather than at the box's left edge.
 */
function renderRange(
  lines: PayloadLine[],
  from: number,
  to: number,
  regions: Region[],
  enclosingDepth: number,
  payload: Payload,
  options: PayloadViewOptions,
): Node[] {
  const out: Node[] = [];
  let index = from;
  const pending = [...regions];

  while (index <= to) {
    const region = pending[0]?.start === index ? pending.shift() : undefined;
    if (region) {
      out.push(renderRegion(lines, region, enclosingDepth, payload, options));
      index = region.end + 1;
    } else {
      out.push(renderLine(lines[index]!, enclosingDepth));
      index += 1;
    }
  }
  return out;
}

function renderRegion(
  lines: PayloadLine[],
  region: Region,
  enclosingDepth: number,
  payload: Payload,
  options: PayloadViewOptions,
): HTMLElement {
  const el = document.createElement("span");
  el.className = "payload-region";
  el.dataset.annotation = String(region.annotationIndex);
  el.style.setProperty("--indent", String(Math.max(0, region.depth - enclosingDepth)));
  if (options.open.includes(region.annotationIndex)) el.dataset.open = "true";

  el.append(
    ...renderRange(
      lines,
      region.start,
      region.end,
      region.children,
      region.depth,
      payload,
      options,
    ),
  );
  el.append(buildMarker(region, payload, options));
  return el;
}

export function renderPayload(payload: Payload, options: PayloadViewOptions): HTMLElement {
  const { lines } = serialisePayload(payload.data);
  const regions = resolveRegions(payload);

  const figure = document.createElement("figure");
  figure.className = "payload";

  // A title bar rather than a label above the box: the payload is the real
  // thing being shown, so it's framed as a window onto it (see the mockups).
  const bar = document.createElement("figcaption");
  bar.className = "payload-bar";
  const lights = document.createElement("span");
  lights.className = "payload-lights";
  lights.setAttribute("aria-hidden", "true");
  for (const which of ["close", "min", "max"]) {
    const light = document.createElement("span");
    light.className = `payload-light payload-light-${which}`;
    lights.append(light);
  }
  const label = document.createElement("span");
  label.className = "payload-label";
  label.textContent = payload.label;
  bar.append(lights, label);
  figure.append(bar);

  const pre = document.createElement("pre");
  pre.className = "payload-json";
  const code = document.createElement("code");
  code.append(...renderRange(lines, 0, lines.length - 1, regions, 0, payload, options));
  pre.append(code);
  figure.append(pre);

  return figure;
}
