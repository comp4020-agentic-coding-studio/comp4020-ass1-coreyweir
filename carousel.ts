// A one-way carousel: a fixed sequence of steps, moved through by prev/next
// arrows or the arrow keys only — no jumping straight to a later step, and no
// wrapping past either end.
//
// Each step holds a list of sections, and each section remembers whether it's
// expanded and which of its annotation cards are open. That remembered state
// is a cache: touching anything in one step invalidates every *later* step's
// state (see CLAUDE.md), the same way editing a prompt's prefix invalidates
// the cache for everything downstream of the edit. Steps before the one you
// touched are untouched.

import { renderPayload } from "./json-view";
import { STEPS, type Section } from "./steps";

interface SectionState {
  expanded: boolean;
  /** Indices of annotations whose card is open. */
  open: number[];
}

interface CarouselState {
  index: number;
  steps: SectionState[][];
  /** How many times a change here has thrown away state downstream of it. */
  invalidations: number;
}

function freshStepState(stepIndex: number): SectionState[] {
  return (STEPS[stepIndex]?.sections ?? []).map(() => ({ expanded: false, open: [] }));
}

function hasState(sections: SectionState[]): boolean {
  return sections.some((section) => section.expanded || section.open.length > 0);
}

function buildSectionDetail(
  section: Section,
  state: SectionState,
  onToggleAnnotation: (annotationIndex: number) => void,
): HTMLElement {
  const detail = document.createElement("div");
  detail.className = "section-detail";

  const body = document.createElement("div");
  body.className = "section-body";
  for (const paragraph of section.body) {
    const p = document.createElement("p");
    p.textContent = paragraph;
    body.append(p);
  }

  const payload = document.createElement("div");
  payload.className = "section-payload";
  payload.append(
    renderPayload(section.payload, { open: state.open, onToggle: onToggleAnnotation }),
  );

  // Prose first in the DOM, payload second; at narrow widths the payload is
  // ordered above it visually instead (see styles.css), because a paragraph of
  // explanation is a lot to scroll past before reaching the thing it's about.
  detail.append(body, payload);
  return detail;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** A bold chevron, drawn rather than set as a text glyph — text arrows
 * render inconsistently thin across fonts/browsers and were getting lost
 * against the button. */
function buildChevron(direction: "left" | "right" | "up" | "down"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("chevron-icon");

  const paths = {
    left: "M15 5 8 12l7 7",
    right: "M9 5l7 7-7 7",
    up: "M5 15l7-7 7 7",
    down: "M5 9l7 7 7-7",
  };
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", paths[direction]);
  svg.append(path);
  return svg;
}

function buildSection(
  stepIndex: number,
  sectionIndex: number,
  state: SectionState,
  handlers: { onToggleSection: () => void; onToggleAnnotation: (index: number) => void },
): HTMLElement {
  const section = STEPS[stepIndex]?.sections[sectionIndex];
  if (!section) throw new Error(`No section ${stepIndex}/${sectionIndex}`);

  const li = document.createElement("li");
  li.className = "step-section";
  li.dataset.expanded = String(state.expanded);
  li.id = `section-${section.id}`;

  const heading = document.createElement("h3");
  heading.className = "section-heading";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "section-toggle";
  toggle.setAttribute("aria-expanded", String(state.expanded));

  const num = document.createElement("span");
  num.className = "section-num";
  num.setAttribute("aria-hidden", "true");
  num.textContent = String(sectionIndex + 1);

  const title = document.createElement("span");
  title.className = "section-title";
  title.textContent = section.title;

  const caret = document.createElement("span");
  caret.className = "section-caret";
  caret.append(buildChevron(state.expanded ? "up" : "down"));

  toggle.append(num, title, caret);
  toggle.addEventListener("click", handlers.onToggleSection);
  heading.append(toggle);
  li.append(heading);

  if (state.expanded) {
    li.append(buildSectionDetail(section, state, handlers.onToggleAnnotation));
  }
  return li;
}

/** Fills the static `#step-nav` landmark (see index.html) with this render's
 * arrows and peeks. It's hydrated in place rather than recreated, so the
 * built HTML always has a real `<nav>` even before this script runs. */
function fillStepNav(nav: HTMLElement, index: number): void {
  nav.replaceChildren();

  const prevStep = STEPS[index - 1];
  const nextStep = STEPS[index + 1];
  const current = STEPS[index];
  if (!current) throw new Error(`No step at index ${index}`);

  const prevArrow = document.createElement("button");
  prevArrow.type = "button";
  prevArrow.className = "step-arrow step-arrow-prev";
  prevArrow.setAttribute("aria-label", "Previous step");
  prevArrow.append(buildChevron("left"));
  prevArrow.disabled = !prevStep;
  nav.append(prevArrow);

  // The peeks are buttons, not just decoration — clicking one goes to that
  // (adjacent) step, same as the arrow beside it. Deliberately no link/button
  // styling, so they read as the same muted preview text as before; a hover
  // effect is the only sign they're interactive (see CLAUDE.md).
  const prevPeek = document.createElement("button");
  prevPeek.type = "button";
  prevPeek.className = "step-peek step-peek-prev";
  prevPeek.textContent = prevStep?.title ?? "";
  prevPeek.disabled = !prevStep;
  if (prevStep) prevPeek.setAttribute("aria-label", `Go back to ${prevStep.title}`);
  nav.append(prevPeek);

  const currentTitle = document.createElement("h2");
  currentTitle.className = "step-current-title";
  currentTitle.textContent = current.title;
  nav.append(currentTitle);

  const nextPeek = document.createElement("button");
  nextPeek.type = "button";
  nextPeek.className = "step-peek step-peek-next";
  nextPeek.textContent = nextStep?.title ?? "";
  nextPeek.disabled = !nextStep;
  if (nextStep) nextPeek.setAttribute("aria-label", `Go on to ${nextStep.title}`);
  nav.append(nextPeek);

  const nextArrow = document.createElement("button");
  nextArrow.type = "button";
  nextArrow.className = "step-arrow step-arrow-next";
  nextArrow.setAttribute("aria-label", "Next step");
  nextArrow.append(buildChevron("right"));
  nextArrow.disabled = !nextStep;
  nav.append(nextArrow);
}

export function mountCarousel(root: HTMLElement): void {
  const nav = root.querySelector<HTMLElement>("#step-nav");
  const cardRoot = root.querySelector<HTMLElement>("#carousel-root");
  if (!nav || !cardRoot) throw new Error("carousel mount points missing from index.html");

  const state: CarouselState = {
    index: 0,
    steps: STEPS.map((_, stepIndex) => freshStepState(stepIndex)),
    invalidations: 0,
  };

  /**
   * Discards every later step's remembered state. Returns whether anything was
   * actually thrown away — a toggle with nothing open downstream isn't a cache
   * miss, and shouldn't be counted or announced as one.
   */
  function invalidateAfter(stepIndex: number): boolean {
    let discarded = false;
    for (let i = stepIndex + 1; i < STEPS.length; i += 1) {
      if (!hasState(state.steps[i] ?? [])) continue;
      state.steps[i] = freshStepState(i);
      discarded = true;
    }
    if (discarded) state.invalidations += 1;
    return discarded;
  }

  function render(): void {
    const step = STEPS[state.index];
    if (!step) throw new Error(`No step at index ${state.index}`);

    fillStepNav(nav!, state.index);
    cardRoot!.replaceChildren();

    // Visually hidden position cue for screen readers — the visual design is
    // deliberately unnumbered (prev/next titles + greyed-out styling carry the
    // position instead), but that's a visual choice, not an accessibility one.
    const srPosition = document.createElement("p");
    srPosition.className = "visually-hidden";
    srPosition.setAttribute("aria-live", "polite");
    srPosition.textContent = `Step ${state.index + 1} of ${STEPS.length}: ${step.title}`;
    cardRoot!.append(srPosition);

    const article = document.createElement("article");
    article.className = "step-card";

    const sections = document.createElement("ol");
    sections.className = "step-sections";
    step.sections.forEach((_, sectionIndex) => {
      const sectionState = state.steps[state.index]?.[sectionIndex];
      if (!sectionState) return;
      sections.append(
        buildSection(state.index, sectionIndex, sectionState, {
          onToggleSection: () => toggleSection(sectionIndex),
          onToggleAnnotation: (annotationIndex) =>
            toggleAnnotation(sectionIndex, annotationIndex),
        }),
      );
    });
    article.append(sections);
    cardRoot!.append(article);
  }

  function goTo(newIndex: number): void {
    const clamped = Math.min(Math.max(newIndex, 0), STEPS.length - 1);
    if (clamped === state.index) return;
    state.index = clamped;
    render();
  }

  /** Any change to a step's expand state is an edit to the prefix. */
  function afterEdit(): void {
    invalidateAfter(state.index);
    render();
  }

  function toggleSection(sectionIndex: number): void {
    const sectionState = state.steps[state.index]?.[sectionIndex];
    if (!sectionState) return;
    sectionState.expanded = !sectionState.expanded;
    afterEdit();
  }

  function toggleAnnotation(sectionIndex: number, annotationIndex: number): void {
    const sectionState = state.steps[state.index]?.[sectionIndex];
    if (!sectionState) return;
    sectionState.open = sectionState.open.includes(annotationIndex)
      ? sectionState.open.filter((index) => index !== annotationIndex)
      : [...sectionState.open, annotationIndex];
    afterEdit();
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".step-arrow-prev, .step-peek-prev")) goTo(state.index - 1);
    else if (target.closest(".step-arrow-next, .step-peek-next")) goTo(state.index + 1);
  });

  // Left/right only: an expanded step is taller than the viewport, so binding
  // up/down here would have to preventDefault page scrolling to work, and
  // stealing scroll to move the carousel is worse than not having the shortcut.
  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const targetTag = (event.target as HTMLElement | null)?.tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(state.index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(state.index - 1);
    }
  });

  render();
}
