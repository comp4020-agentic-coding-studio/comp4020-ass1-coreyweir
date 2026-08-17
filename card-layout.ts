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
//  - Left of the box, in the column the prose is in, but never over the prose
//    itself: the copy is two or three short paragraphs and the payload beside it
//    is far taller, so most of that column is empty. Only reachable while the
//    layout is side by side, which is also the only time the column exists.
//  - Below the box, flowed into rows. Overlaps the prose, which is fine: a card
//    is closable and draggable, so overlap is recoverable in a way that being
//    off-screen isn't.
//  - Above the box, when the box's bottom edge is near the bottom of the window
//    and cards placed below it would open off-screen — the worst outcome
//    available, since the reader clicks and apparently nothing happens.
//
// A "left of the box" zone was tried and removed once before, on the arithmetic
// that the margin beside the content column is (viewport − 1024px) / 2 and only
// exceeds a card's width above ~1580px, by which point the right-hand gutter
// already fits. That was measuring the wrong gap. Beside the payload isn't the
// page margin, it's the prose column — 460-odd pixels of it — and it's empty
// from the end of the copy downwards. What the old arithmetic got right is that
// the room runs out with the column: below 900px the layout stacks, the payload
// spans the full width, and the horizontal check drops the zone on its own.
//
// The window where left earns its place is a squarish one, roughly 900–1540px
// wide: too narrow for the right-hand gutter, too short for a stack under the
// box. Without it the cards land on top of the JSON while half the section sits
// empty.
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

type Zone = "right" | "left" | "below" | "above";

/**
 * The *visible* viewport, excluding the classic scrollbar gutter.
 *
 * Not window.innerWidth, which includes it: bounds computed from innerWidth let
 * a card extend into the space the vertical scrollbar occupies, and the document
 * then overflows horizontally — the one failure this module exists to prevent.
 * It doesn't show up in a headless browser, which reports a scrollbar width of
 * zero, so it survived every check here and turned up on a real machine.
 */
function viewportWidth(): number {
  return document.documentElement.clientWidth;
}

function viewportHeight(): number {
  return document.documentElement.clientHeight;
}

/**
 * The highest a card may go: below the carousel's own nav.
 *
 * Covering prose is recoverable — you can read it once the card is closed. But
 * the arrows and the step title are how you get anywhere, and a card sitting on
 * top of them looks like the site has stopped working rather than like something
 * is in the way. So the room above the payload is measured from the nav, not the
 * top of the window, and a stack that only fits by covering the controls doesn't
 * count as fitting.
 */
function ceiling(): number {
  const nav = document.querySelector("#step-nav")?.getBoundingClientRect().bottom ?? 0;
  return Math.max(EDGE_PX, nav + GAP_PX);
}

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
  return box.x >= EDGE_PX && box.x + box.width <= viewportWidth() - EDGE_PX;
}

function overlaps(box: Box, rect: DOMRect): boolean {
  return (
    box.x < rect.right &&
    box.x + box.width > rect.left &&
    box.y < rect.bottom &&
    box.y + box.height > rect.top
  );
}

/**
 * The lowest edge of the copy a column at this x would run into, or −∞ when it
 * passes the copy by. Cards may not start above it, which is what keeps the
 * left-hand zone in the empty part of the prose column rather than on the words.
 */
function copyFloor(copy: DOMRect[], x: number, width: number): number {
  let floor = Number.NEGATIVE_INFINITY;
  for (const rect of copy) {
    if (rect.right <= x || rect.left >= x + width) continue;
    floor = Math.max(floor, rect.bottom + GAP_PX);
  }
  return floor;
}

/**
 * Cards beside the box, each vertically centred on its own region, then pushed
 * down out of each other's way — two annotations a few lines apart anchor to
 * nearly the same height, and a card is taller than a few lines of code.
 *
 * A dragged card is left out of that: it's where the reader put it, so it
 * neither gets pushed nor pushes anything else around.
 *
 * On the left the copy is a second floor: the column starts below the last
 * paragraph rather than level with its region, and if it can't clear the copy
 * and stay on screen at the same time, the zone is refused and the cards stack
 * instead. Sitting a little low beside the right lines is a small loss; sitting
 * on the sentence the reader is halfway through isn't.
 */
function placeBeside(
  cards: Card[],
  payload: DOMRect,
  side: "right" | "left",
  copy: DOMRect[],
): boolean {
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const card of cards) {
    const { width, height } = card.box;
    const x = side === "right" ? payload.right + GAP_PX : payload.left - GAP_PX - width;
    if (!fitsHorizontally({ x, y: 0, width, height })) return false;

    const floor =
      side === "left" ? copyFloor(copy, x, width) : Number.NEGATIVE_INFINITY;
    const centred = card.anchor.top + card.anchor.height / 2 - height / 2;
    const y = isDragged(card.offset)
      ? centred
      : Math.max(centred, floor, previousBottom + STACK_GAP_PX);
    card.box = { x, y, width, height };
    if (!isDragged(card.offset)) previousBottom = y + height;
  }

  // In a short window a card level with its region can still hang off the
  // bottom, so the whole group slides back into view together — keeping their
  // spacing, and giving up being exactly level with their own lines, which is
  // the lesser loss. Dragged cards are left where the reader put them.
  const placed = cards.filter((card) => !isDragged(card.offset));
  if (placed.length > 0) {
    const top = Math.min(...placed.map((card) => card.box.y));
    const bottom = Math.max(...placed.map((card) => card.box.y + card.box.height));
    const shift = Math.max(
      Math.min(0, viewportHeight() - EDGE_PX - bottom),
      ceiling() - top,
    );
    if (shift !== 0) {
      for (const card of placed) card.box = { ...card.box, y: card.box.y + shift };
    }
  }

  // That slide is what can undo the floor: a column too tall for the room under
  // the copy is pushed back up over it. Checked after the fact rather than
  // predicted, so the answer is about where the cards actually ended up.
  if (side === "left" && cards.some((c) => copy.some((r) => overlaps(c.box, r)))) {
    return false;
  }
  return true;
}

/**
 * Packs the cards into rows starting at the box's left edge and y = 0, and
 * returns the height of the block. Rows start at the box's left edge so they
 * never spill sideways over the prose, but they may run past its right edge into
 * the gutter, which is empty — being under the box matters, being no wider than
 * it doesn't.
 */
function flowRows(cards: Card[], payload: DOMRect): number {
  const rowRight = viewportWidth() - EDGE_PX;
  const widthOf = (row: Card[]): number =>
    row.reduce((total, card) => total + card.box.width, 0) +
    STACK_GAP_PX * Math.max(0, row.length - 1);

  // Rows are packed against the width of the *viewport*, not the width of the
  // payload box, and then aligned to the box's left edge — sliding left only as
  // far as they must to stay on screen. Wrapping instead would put two cards in
  // a column, and in the zone above the box a column forces the upper card's
  // leader to run behind the lower card, which reads as the wrong line.
  const rows: Card[][] = [];
  for (const card of cards) {
    const row = rows[rows.length - 1];
    if (!row || widthOf([...row, card]) > rowRight - EDGE_PX) rows.push([card]);
    else row.push(card);
  }

  let y = 0;
  rows.forEach((row, index) => {
    const width = widthOf(row);
    let x = Math.max(EDGE_PX, Math.min(payload.left, rowRight - width));
    let rowHeight = 0;
    for (const card of row) {
      card.box = { ...card.box, x, y };
      x += card.box.width + STACK_GAP_PX;
      rowHeight = Math.max(rowHeight, card.box.height);
    }
    y += rowHeight + (index === rows.length - 1 ? 0 : STACK_GAP_PX);
  });
  return y;
}

/**
 * Cards in rows below the box, or above it when below wouldn't be on screen.
 *
 * Below is preferred — it reads in the same direction as the page — but the
 * payload can easily sit with its bottom edge near the bottom of the window, and
 * cards placed under it then open off-screen entirely, which is the worst
 * outcome available: the reader clicks and apparently nothing happens. Above
 * covers the section's own heading and some prose, which is recoverable.
 *
 * The choice is made from the room visible when the card is opened, so it can go
 * stale if the page is then scrolled. Re-deciding on scroll would mean cards
 * hopping from one side of the payload to the other as the page moves, which is
 * worse than a stale-but-stable choice.
 */
function placeStacked(cards: Card[], payload: DOMRect): Zone {
  const height = flowRows(cards, payload);
  const roomBelow = viewportHeight() - EDGE_PX - (payload.bottom + GAP_PX);
  const roomAbove = payload.top - GAP_PX - ceiling();

  const zone: Zone =
    height <= roomBelow
      ? "below"
      : height <= roomAbove
        ? "above"
        : // Neither fits: take the roomier side and let the page scroll.
          roomAbove > roomBelow
          ? "above"
          : "below";

  // When neither side has room the stack still has to be visible, so it slides
  // back into view and overlaps the payload rather than hanging off the edge.
  // Overlapping the JSON is recoverable — the card is closable and draggable —
  // and a card that opens off-screen looks like nothing happened at all.
  const wanted =
    zone === "below" ? payload.bottom + GAP_PX : payload.top - GAP_PX - height;
  const originY = Math.max(
    ceiling(),
    Math.min(wanted, viewportHeight() - EDGE_PX - height),
  );
  for (const card of cards) card.box = { ...card.box, y: card.box.y + originY };
  return zone;
}

function chooseZone(cards: Card[], payload: DOMRect, copy: DOMRect[]): Zone {
  if (placeBeside(cards, payload, "right", copy)) return "right";
  if (placeBeside(cards, payload, "left", copy)) return "left";
  return placeStacked(cards, payload);
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
 * On the left it's a straight line too, but drawn from the region's own left
 * edge rather than from the dot. The dot sits in the gutter on the far side of
 * the box, and a line from there to a card on the left would be drawn straight
 * through the JSON it's pointing at. The region is outlined, so a line leaving
 * its left border still says which lines the card belongs to.
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
  /** Right edge of the stack, when the cards are in a single column. */
  columnRight: number | undefined,
): Array<{ x: number; y: number }> {
  const { x, y, width, height } = card.box;
  const nearestTo = (point: { x: number; y: number }): { x: number; y: number } => ({
    x: Math.min(Math.max(point.x, x), x + width),
    y: Math.min(Math.max(point.y, y), y + height),
  });
  if (zone === "left") {
    const edge = {
      x: card.anchor.left,
      y: card.anchor.top + card.anchor.height / 2,
    };
    return [edge, nearestTo(edge)];
  }
  if (zone === "right" || isDragged(card.offset)) return [from, nearestTo(from)];

  // A single column of cards can't be entered through the edge facing the box:
  // whichever card is nearer, the other one's leader has to run behind it, and a
  // line that disappears under a card and stops looks like that card's line. So
  // it goes round instead — out past the side of the column, along it, and into
  // the card's own side, each card one step further out so the runs stay apart.
  if (columnRight !== undefined) {
    const laneX = Math.min(
      columnRight + 6 + index * LANE_STEP_PX,
      viewportWidth() - EDGE_PX - 1,
    );
    const approachY = y + height / 2;
    return [
      from,
      { x: laneX, y: from.y },
      { x: laneX, y: approachY },
      { x: x + width, y: approachY },
    ];
  }

  // Lanes stay inside the box's right-hand padding, which holds the markers and
  // no text; clamped so a narrow payload doesn't push them over the border.
  const laneX = Math.min(from.x + LANE_STEP_PX * (index + 1), payload.right - 4);
  const above = zone === "above";
  const corridorY = above
    ? payload.top - GAP_PX / 2 - index * CORRIDOR_STEP_PX
    : payload.bottom + GAP_PX / 2 + index * CORRIDOR_STEP_PX;
  const inset = Math.min(14, width / 2);
  const targetX = Math.min(Math.max(laneX, x + inset), x + width - inset);
  return [
    from,
    { x: laneX, y: from.y },
    { x: laneX, y: corridorY },
    { x: targetX, y: corridorY },
    // Meets the edge of the card that faces the box.
    { x: targetX, y: above ? y + height : y },
  ];
}

function drawLeader(
  card: Card,
  zone: Zone,
  payload: DOMRect,
  index: number,
  columnRight: number | undefined,
): void {
  const from = markerCentre(card);
  if (!from) return;
  const origin = card.region.getBoundingClientRect();
  const points = route(from, card, zone, payload, index, columnRight);

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

/**
 * The section's prose, paragraph by paragraph.
 *
 * Per paragraph rather than per container: `.section-body` is a grid item beside
 * the payload, so it's stretched to the height of the taller of the two and its
 * own rect claims the whole column even when the words stop a third of the way
 * down. That measurement makes the left-hand zone look permanently blocked.
 */
function copyRects(payload: HTMLElement): DOMRect[] {
  const detail = payload.closest(".section-detail");
  const paragraphs = detail?.querySelectorAll<HTMLElement>(".section-body p") ?? [];
  return [...paragraphs].map((el) => el.getBoundingClientRect());
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
  const zone = chooseZone(cards, payloadRect, copyRects(payload));

  // One card per row: no two share a top edge. Only then does a leader have to
  // go round the side of the stack (see route()).
  const isColumn =
    cards.length > 1 && new Set(cards.map((card) => card.box.y)).size === cards.length;
  const columnRight = isColumn
    ? Math.max(...cards.map((card) => card.box.x + card.box.width))
    : undefined;

  cards.forEach((card, index) => {
    // The drag offset is applied on top of the placement, not instead of it, so
    // a dragged card still travels with its region on a resize or a rewrap.
    // Only x is clamped to the viewport: horizontal scroll is the failure worth
    // preventing, and clamping y would tug cards about as the page is scrolled.
    const maxX = Math.max(EDGE_PX, viewportWidth() - EDGE_PX - card.box.width);
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
    drawLeader(card, zone, payloadRect, index, columnRight);
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
