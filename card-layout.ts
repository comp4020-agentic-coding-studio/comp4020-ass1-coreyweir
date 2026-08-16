// Places the annotation cards, and draws the leader line from each card back
// to its marker dot.
//
// CSS anchors a card beside the region it describes, which is right whenever
// there's room in the gutter — but at a laptop width the gutter isn't wide
// enough and the card ends up off-screen, and stacked on a phone it pushes the
// page wider than the viewport. Horizontal scroll is the one outcome that isn't
// acceptable, so this pass finds somewhere the cards do fit:
//
//  - Right of the box — the default, each card level with its own region.
//  - Below the box, flowed into rows — the fallback that always has room,
//    because it can grow downwards. It overlaps the prose, which is fine: a
//    card is closable and draggable, so overlap is recoverable in a way that
//    being off-screen isn't.
//
// A "left of the box" zone was tried and removed: the payload always spans the
// content column, so the margin beside it is (viewport − 1024px) / 2, which
// only exceeds a card's width above ~1580px — by which point the layout is side
// by side and the right-hand gutter already fits. There is no viewport where it
// could trigger, and a branch that can never run implies coverage it hasn't got.
//
// All of a payload's cards go to the same zone rather than each picking its own
// best spot: a mix of one card beside the box and another under it reads as a
// mistake, even when each placement is individually sensible.
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
/** Cap on how far a card can be dragged vertically from its anchor. Bounding
 *  the offset (rather than clamping the result into the viewport) keeps a
 *  dragged card's position stable when the page is scrolled or resized. */
const MAX_DRAG_Y_PX = 800;
/** Spacing between the vertical legs of two routed leaders, and between the
 *  horizontal corridors they turn into. Every dot sits in the same gutter
 *  column, so without a lane of its own each route runs down the identical
 *  line and there's no telling which card belongs to which snippet. */
const LANE_STEP_PX = 9;
const CORRIDOR_STEP_PX = 6;

/** How far a card has been dragged from where this pass would have put it. */
export interface Offset {
  dx: number;
  dy: number;
}

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
  offset: Offset;
}

type Zone = "right" | "below";

export function readOffset(el: HTMLElement): Offset {
  return {
    dx: Number(el.dataset.dx) || 0,
    dy: Number(el.dataset.dy) || 0,
  };
}

/** Live during a drag; the carousel's state is only written at drag end. */
export function writeOffset(el: HTMLElement, offset: Offset): void {
  el.dataset.dx = String(Math.round(offset.dx));
  el.dataset.dy = String(
    Math.round(Math.min(Math.max(offset.dy, -MAX_DRAG_Y_PX), MAX_DRAG_Y_PX)),
  );
}

function isDragged(offset: Offset): boolean {
  return offset.dx !== 0 || offset.dy !== 0;
}

function fitsHorizontally(box: Box): boolean {
  return box.x >= EDGE_PX && box.x + box.width <= window.innerWidth - EDGE_PX;
}

/**
 * Cards beside the box, each vertically centred on its own region, then pushed
 * down out of each other's way — two annotations a few lines apart anchor to
 * nearly the same height, and a card is taller than a few lines of code.
 *
 * A dragged card is left out of that: it's where the reader put it, so it
 * neither gets pushed nor pushes anything else around.
 */
function placeRight(cards: Card[], payload: DOMRect): boolean {
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const card of cards) {
    const { width, height } = card.box;
    const x = payload.right + GAP_PX;
    if (!fitsHorizontally({ x, y: 0, width, height })) return false;

    const centred = card.anchor.top + card.anchor.height / 2 - height / 2;
    const y = isDragged(card.offset)
      ? centred
      : Math.max(centred, previousBottom + STACK_GAP_PX);
    card.box = { x, y, width, height };
    if (!isDragged(card.offset)) previousBottom = y + height;
  }
  return true;
}

/**
 * Cards flowed into rows under the box, left to right. Rows start at the box's
 * left edge so they never spill sideways over the prose, but they may run past
 * its right edge into the gutter, which is empty — being under the box matters,
 * being no wider than it doesn't.
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

function chooseZone(cards: Card[], payload: DOMRect): Zone {
  if (placeRight(cards, payload)) return "right";
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
 * rule that covers a card level with its region, one nudged down, and one
 * dragged anywhere.
 *
 * Below the box it has to be routed rather than direct: a straight line from a
 * dot at the box's right edge to a card underneath it cuts diagonally across
 * the JSON. So it steps sideways into a lane of its own, drops down the marker
 * gutter — the one column of the box with no text in it — into a corridor
 * between box and cards, and only then runs across to its card.
 *
 * The lane and the corridor are both per-card. Every dot sits at the same x, so
 * routes that dropped straight down from them ran along the identical path and
 * you couldn't tell which card went with which snippet. Lines may still cross
 * where the cards' order doesn't match their dots'; crossing is legible, sharing
 * a path isn't.
 *
 * A dragged card gets the straight line whichever zone it's in: once it's been
 * moved by hand the corridor may be nowhere near it, and a route through a
 * corridor it has left behind reads worse than a direct line.
 */
function route(
  from: { x: number; y: number },
  card: Card,
  zone: Zone,
  payload: DOMRect,
  index: number,
): Array<{ x: number; y: number }> {
  const { x, y, width, height } = card.box;
  const nearest = {
    x: Math.min(Math.max(from.x, x), x + width),
    y: Math.min(Math.max(from.y, y), y + height),
  };
  if (zone !== "below" || isDragged(card.offset)) return [from, nearest];

  // Lanes stay inside the box's right-hand padding, which holds the markers and
  // no text; clamped so a narrow payload doesn't push them over the border.
  const laneX = Math.min(from.x + LANE_STEP_PX * (index + 1), payload.right - 4);
  const corridorY = payload.bottom + GAP_PX / 2 + index * CORRIDOR_STEP_PX;
  const inset = Math.min(14, width / 2);
  const targetX = Math.min(Math.max(laneX, x + inset), x + width - inset);
  return [
    from,
    { x: laneX, y: from.y },
    { x: laneX, y: corridorY },
    { x: targetX, y: corridorY },
    { x: targetX, y },
  ];
}

function drawLeader(card: Card, zone: Zone, payload: DOMRect, index: number): void {
  const from = markerCentre(card);
  if (!from) return;
  const origin = card.region.getBoundingClientRect();
  const points = route(from, card, zone, payload, index);

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

  // Sorted by annotation number, not by DOM order: a region's card is appended
  // after the lines it wraps, so a *nested* annotation's card comes first in the
  // document even though its number is higher. Left unsorted, the cards stack in
  // the wrong order and their leader lines cross over each other.
  const elements = [...payload.querySelectorAll<HTMLElement>(".annotation-card")].sort(
    (a, b) => Number(a.dataset.annotation) - Number(b.dataset.annotation),
  );
  if (elements.length === 0) return;

  // Clear the last pass's positions first: the CSS-anchored position is the
  // starting point, and the natural size is what needs measuring.
  for (const el of elements) {
    el.style.removeProperty("left");
    el.style.removeProperty("top");
    el.style.removeProperty("transform");
  }

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
      offset: readOffset(el),
    });
  }

  const payloadRect = payload.getBoundingClientRect();
  const zone = chooseZone(cards, payloadRect);

  cards.forEach((card, index) => {
    // The drag offset is applied on top of the placement, not instead of it, so
    // a dragged card still travels with its region on a resize or a rewrap.
    // Only x is clamped to the viewport: horizontal scroll is the failure worth
    // preventing, and clamping y would tug cards about as the page is scrolled.
    const maxX = Math.max(EDGE_PX, window.innerWidth - EDGE_PX - card.box.width);
    card.box = {
      ...card.box,
      x: Math.min(Math.max(card.box.x + card.offset.dx, EDGE_PX), maxX),
      y: card.box.y + card.offset.dy,
    };

    const origin = card.region.getBoundingClientRect();
    card.el.dataset.zone = zone;
    card.el.style.left = `${Math.round(card.box.x - origin.left)}px`;
    card.el.style.top = `${Math.round(card.box.y - origin.top)}px`;
    card.el.style.transform = "none";
    drawLeader(card, zone, payloadRect, index);
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
