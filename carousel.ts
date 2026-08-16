// A one-way carousel: a fixed sequence of steps, moved through by prev/next
// arrows or the arrow keys only — no jumping straight to a later step, and no
// wrapping past either end. Clicking a step reveals its payload; that
// expand/collapse state is what a later pass wires into a caching-style
// invalidation mechanic (see CLAUDE.md). For now it's a plain toggle.

import { renderPayloadBlock } from "./json-view";
import { STEPS } from "./steps";

interface CarouselState {
  index: number;
  expanded: boolean[];
}

function buildStepDetail(stepIndex: number): HTMLElement {
  const step = STEPS[stepIndex];
  if (!step) throw new Error(`No step at index ${stepIndex}`);

  const detail = document.createElement("div");
  detail.className = "step-detail";

  const body = document.createElement("div");
  body.className = "step-body";
  for (const paragraph of step.body) {
    const p = document.createElement("p");
    p.textContent = paragraph;
    body.append(p);
  }
  detail.append(body);

  const payloads = document.createElement("div");
  payloads.className = "step-payloads";
  for (const block of step.payloads) {
    payloads.append(renderPayloadBlock(block));
  }
  detail.append(payloads);

  return detail;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** A bold chevron, drawn rather than set as a text glyph — text arrows
 * render inconsistently thin across fonts/browsers and were getting lost
 * against the button. */
function buildChevron(direction: "left" | "right"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("step-arrow-icon");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", direction === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7");
  svg.append(path);
  return svg;
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

function render(nav: HTMLElement, cardRoot: HTMLElement, state: CarouselState): void {
  const { index, expanded } = state;
  const step = STEPS[index];
  if (!step) throw new Error(`No step at index ${index}`);
  const isExpanded = expanded[index] ?? false;

  fillStepNav(nav, index);

  cardRoot.replaceChildren();

  // Visually hidden position cue for screen readers — the visual design is
  // deliberately unnumbered (prev/next titles + greyed-out styling carry the
  // position instead), but that's a visual choice, not an accessibility one.
  const srPosition = document.createElement("p");
  srPosition.className = "visually-hidden";
  srPosition.setAttribute("aria-live", "polite");
  srPosition.textContent = `Step ${index + 1} of ${STEPS.length}: ${step.title}`;
  cardRoot.append(srPosition);

  const article = document.createElement("article");
  article.className = "carousel-step";
  article.dataset.expanded = String(isExpanded);

  const header = document.createElement("header");
  header.className = "step-header";
  const summary = document.createElement("p");
  summary.className = "step-summary";
  summary.textContent = step.summary;
  header.append(summary);
  article.append(header);

  // A numbered, link-styled disclosure rather than a boxed button — there's
  // only one section per step today, so it's always "1", but the numbering
  // is there for when a step splits into several independently-expandable
  // sections (see CLAUDE.md).
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "step-toggle";
  toggle.setAttribute("aria-expanded", String(isExpanded));

  const num = document.createElement("span");
  num.className = "step-toggle-num";
  num.textContent = "1.";
  toggle.append(num, " Request & response ");

  const caret = document.createElement("span");
  caret.className = "step-toggle-caret";
  caret.setAttribute("aria-hidden", "true");
  caret.textContent = isExpanded ? "▾" : "▸";
  toggle.append(caret);

  article.append(toggle);

  if (isExpanded) {
    article.append(buildStepDetail(index));
  }
  cardRoot.append(article);
}

export function mountCarousel(root: HTMLElement): void {
  const nav = root.querySelector<HTMLElement>("#step-nav");
  const cardRoot = root.querySelector<HTMLElement>("#carousel-root");
  if (!nav || !cardRoot) throw new Error("carousel mount points missing from index.html");

  const state: CarouselState = {
    index: 0,
    expanded: STEPS.map(() => false),
  };

  function goTo(newIndex: number): void {
    const clamped = Math.min(Math.max(newIndex, 0), STEPS.length - 1);
    if (clamped === state.index) return;
    state.index = clamped;
    render(nav!, cardRoot!, state);
  }

  function toggleExpanded(): void {
    state.expanded[state.index] = !state.expanded[state.index];
    render(nav!, cardRoot!, state);
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".step-toggle")) toggleExpanded();
    else if (target.closest(".step-arrow-prev, .step-peek-prev")) goTo(state.index - 1);
    else if (target.closest(".step-arrow-next, .step-peek-next")) goTo(state.index + 1);
  });

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const targetTag = (event.target as HTMLElement | null)?.tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      goTo(state.index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      goTo(state.index - 1);
    }
  });

  render(nav, cardRoot, state);
}
