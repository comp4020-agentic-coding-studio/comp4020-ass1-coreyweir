// Dragging an annotation card by its header.
//
// The card keeps its placement (see card-layout.ts) and a drag is stored as an
// offset from it, so a dragged card still travels with the lines it describes
// when the payload rewraps or the window resizes — it doesn't come loose and
// sit at a fixed point on the page.
//
// The live offset lives on the element as a data attribute and the carousel's
// state is written once, at drag end. Writing state on every pointermove would
// mean re-rendering the step mid-drag: the element being dragged would be
// replaced underneath the pointer.
//
// Moving a card is deliberately NOT treated as an edit for the caching mechanic:
// it doesn't invalidate later steps or count as a cache miss. But the position
// is remembered state like any other, so a flush caused by something else does
// reset it (see freshStepState in carousel.ts).

import { readOffset, writeOffset, type Offset } from "./card-layout";

export interface DragHooks {
  /** Commits the final offset to state. Called once, at drag end. */
  commit: (offset: Offset) => void;
  /** Re-runs the placement pass so the card and its leader line follow. */
  relayout: () => void;
}

export function startCardDrag(
  event: PointerEvent,
  card: HTMLElement,
  hooks: DragHooks,
): void {
  // Left button / touch / pen only, and never from the close button.
  if (event.button !== 0) return;
  if ((event.target as HTMLElement).closest(".annotation-card-close")) return;

  const start = { x: event.clientX, y: event.clientY };
  const base = readOffset(card);
  card.dataset.dragging = "true";

  let frame = 0;
  const schedule = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      hooks.relayout();
    });
  };

  const onMove = (moveEvent: PointerEvent): void => {
    writeOffset(card, {
      dx: base.dx + (moveEvent.clientX - start.x),
      dy: base.dy + (moveEvent.clientY - start.y),
    });
    schedule();
  };

  const onEnd = (): void => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    if (frame) cancelAnimationFrame(frame);
    delete card.dataset.dragging;
    hooks.relayout();
    hooks.commit(readOffset(card));
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd);
  window.addEventListener("pointercancel", onEnd);
  // Stops the drag turning into a text selection of the card's own heading.
  event.preventDefault();
}

/** Puts a card back where the placement pass wants it. */
export function resetCardOffset(card: HTMLElement, hooks: DragHooks): void {
  writeOffset(card, { dx: 0, dy: 0 });
  hooks.relayout();
  hooks.commit({ dx: 0, dy: 0 });
}
