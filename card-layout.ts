// Places the annotation cards, and draws the leader line from each card back
// to its marker dot.
//
// CSS anchors a card beside the region it describes, which is right whenever
// there's room in the gutter — but at a laptop width the gutter isn't wide
// enough and the card ends up off-screen, and stacked on a phone it pushes the
// page wider than the viewport. Horizontal scroll is the one outcome that isn't
// acceptable, so this pass finds somewhere the cards do fit.
//
// All of a payload's cards go to the same zone rather than each picking its own
// best spot: a mix of one card beside the box and another under it reads as a
// mistake, even when each placement is individually sensible. The zones, in
// order of preference:
//
//  - Right of the box — the default, each card level with its own region.
//  - Left of the box — only when the payload is stacked above the prose, where
//    the page margin beside it is free. In the side-by-side layout, left is the
//    prose, and covering the text you're reading is worse than hanging below.
//  - Below the box, flowed into rows — the fallback that always has room,
//    because it can grow downwards.
//
// Everything is expressed as an offset from the card's own region, so the cards
// stay attached to the lines they describe, and re-running this after a resize
// is all it takes to put them right.

/** Clearance between a card and the payload box it sits beside. */
const GAP_PX = 14;
/** Breathing room left between two cards. */
const STACK_GAP_PX = 10;
/** How close to the viewport edge a card may sit before it counts as off. */
const EDGE_PX = 8;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Card {
  el: HTMLElement;
  region: HTMLElement;
  /** The lines this card describes, in viewport coordinates. */
  anchor: DOMRect;
  box: Box;
}

type Zone = "right" | "left" | "below";

/** Whether the payload sits beside the prose ("side") or above it ("stack").
 *  Read from CSS so the breakpoint isn't duplicated as a number in here. */
function layoutMode(payload: HTMLElement): "side" | "stack" {
  return getComputedStyle(payload).getPropertyValue("--layout").trim() === "stack"
    ? "stack"
    : "side";
}

function fitsHorizontally(box: Box): boolean {
  return box.x >= EDGE_PX && box.x + box.width <= window.innerWidth - EDGE_PX;
}

/**
 * Cards beside the box, each vertically centred on its own region, then pushed
 * down out of each other's way — two annotations a few lines apart anchor to
 * nearly the same height, and a card is taller than a few lines of code.
 */
function placeBeside(cards: Card[], payload: DOMRect, side: "right" | "left"): boolean {
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const card of cards) {
    const { width, height } = card.box;
    const x = side === "right" ? payload.right + GAP_PX : payload.left - GAP_PX - width;
    if (!fitsHorizontally({ x, y: 0, width, height })) return false;

    const centred = card.anchor.top + card.anchor.height / 2 - height / 2;
    const y = Math.max(centred, previousBottom + STACK_GAP_PX);
    card.box = { x, y, width, height };
    previousBottom = y + height;
  }
  return true;
}

/**
 * Cards flowed into rows under the box, left to right. Rows start at the box's
 * left edge so they never spill sideways over the prose, but they may run past
 * its right edge into the gutter, which is empty — being under the box matters,
 * being no wider than it doesn't. Rows can always grow downwards, which is what
 * makes this the fallback that can't fail.
 */
function placeBelow(cards: Card[], payload: DOMRect): void {
  const rowRight = window.innerWidth - EDGE_PX;
  let x = payload.left;
  let y = payload.bottom + GAP_PX;
  let rowHeight = 0;

  for (const card of cards) {
    const { width, height } = card.box;
    const startsRow = x === payload.left;
    if (!startsRow && x + width > rowRight) {
      x = payload.left;
      y += rowHeight + STACK_GAP_PX;
      rowHeight = 0;
    }
    card.box = { x, y, width, height };
    x += width + STACK_GAP_PX;
    rowHeight = Math.max(rowHeight, height);
  }
}

function chooseZone(cards: Card[], payload: DOMRect, mode: "side" | "stack"): Zone {
  if (placeBeside(cards, payload, "right")) return "right";
  if (mode === "stack" && placeBeside(cards, payload, "left")) return "left";
  placeBelow(cards, payload);
  return "below";
}

const SVG_NS = "http://www.w3.org/2000/svg";

function markerCentre(card: Card): { x: number; y: number } | undefined {
  const marker = card.region.querySelector<HTMLElement>(":scope > .annotation-marker");
  if (!marker) return undefined;
  const rect = marker.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * The route from the marker dot to the card, in viewport coordinates.
 *
 * Beside the box it's a straight line to the nearest point on the card — one
 * rule that covers a card level with its region, one nudged down, and (later)
 * one dragged anywhere.
 *
 * Below the box it has to be routed rather than direct: a straight line from a
 * dot at the box's right edge to a card underneath it cuts diagonally across
 * the JSON. So it drops down the marker gutter — the one column of the box with
 * no text in it — into the corridor between box and cards, and only then runs
 * sideways. `fan` offsets each card's corridor slightly so two routes sharing it
 * don't overlap into one line.
 */
function route(
  from: { x: number; y: number },
  card: Box,
  zone: Zone,
  payload: DOMRect,
  fan: number,
): Array<{ x: number; y: number }> {
  if (zone !== "below") {
    return [
      from,
      {
        x: Math.min(Math.max(from.x, card.x), card.x + card.width),
        y: Math.min(Math.max(from.y, card.y), card.y + card.height),
      },
    ];
  }

  const corridorY = payload.bottom + GAP_PX / 2 + fan;
  const inset = Math.min(14, card.width / 2);
  const targetX = Math.min(Math.max(from.x, card.x + inset), card.x + card.width - inset);
  return [
    from,
    { x: from.x, y: corridorY },
    { x: targetX, y: corridorY },
    { x: targetX, y: card.y },
  ];
}

function drawLeader(card: Card, zone: Zone, payload: DOMRect, fan: number): void {
  const from = markerCentre(card);
  if (!from) return;
  const origin = card.region.getBoundingClientRect();
  const points = route(from, card.box, zone, payload, fan);

  // The dot is under the card: there's nothing to join, and a stub would just
  // poke out from beneath it.
  const isInside = points.every((point) => point.x === from.x && point.y === from.y);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("annotation-leader");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (!isInside) {
    const line = document.createElementNS(SVG_NS, "polyline");
    line.setAttribute(
      "points",
      // Region-relative, so the <svg> can sit at inset: 0 and overflow.
      points.map((p) => `${p.x - origin.left},${p.y - origin.top}`).join(" "),
    );
    svg.append(line);
  }
  card.el.insertAdjacentElement("beforebegin", svg);
}

function layoutPayload(payload: HTMLElement): void {
  for (const stale of payload.querySelectorAll(".annotation-leader")) stale.remove();

  const elements = [...payload.querySelectorAll<HTMLElement>(".annotation-card")];
  if (elements.length === 0) return;

  // Clear the last pass's positions first: the CSS-anchored position is the
  // starting point, and the natural size is what needs measuring.
  for (const el of elements) {
    el.style.removeProperty("left");
    el.style.removeProperty("top");
    el.style.removeProperty("transform");
  }

  // DOM order is payload order, so the cards read top-down in the same order as
  // the lines they point at, whichever zone they end up in.
  const cards: Card[] = [];
  for (const el of elements) {
    const region = el.parentElement;
    if (!region) continue;
    const rect = el.getBoundingClientRect();
    cards.push({
      el,
      region,
      anchor: region.getBoundingClientRect(),
      box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    });
  }

  const payloadRect = payload.getBoundingClientRect();
  const zone = chooseZone(cards, payloadRect, layoutMode(payload));

  cards.forEach((card, index) => {
    const origin = card.region.getBoundingClientRect();
    card.el.dataset.zone = zone;
    card.el.style.left = `${Math.round(card.box.x - origin.left)}px`;
    card.el.style.top = `${Math.round(card.box.y - origin.top)}px`;
    card.el.style.transform = "none";
    drawLeader(card, zone, payloadRect, index * 4);
  });
}

export function layoutCards(root: HTMLElement): void {
  for (const payload of root.querySelectorAll<HTMLElement>(".payload")) {
    layoutPayload(payload);
  }
}

/**
 * Re-runs the pass on resize, coalesced to one per frame — dragging a window
 * edge fires resize continuously, and this reads layout.
 */
export function watchCardLayout(root: HTMLElement): void {
  let queued = false;
  window.addEventListener("resize", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      layoutCards(root);
    });
  });
}
