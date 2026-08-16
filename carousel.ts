// A one-way carousel: a fixed sequence of steps, moved through by prev/next
// controls or the arrow keys only — no jumping straight to a later step, and
// no wrapping past either end. Clicking a step reveals its payload; that
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

function render(root: HTMLElement, state: CarouselState): void {
  const { index, expanded } = state;
  const step = STEPS[index];
  if (!step) throw new Error(`No step at index ${index}`);
  const isExpanded = expanded[index] ?? false;

  root.replaceChildren();

  const section = document.createElement("section");
  section.className = "carousel";
  section.setAttribute("aria-roledescription", "carousel");
  section.setAttribute("aria-label", "How Claude Code works");

  const status = document.createElement("div");
  status.className = "carousel-status";
  const position = document.createElement("p");
  position.className = "carousel-position";
  position.setAttribute("aria-live", "polite");
  position.textContent = `Step ${index + 1} of ${STEPS.length}`;
  status.append(position);

  const dots = document.createElement("div");
  dots.className = "carousel-dots";
  dots.setAttribute("aria-hidden", "true");
  STEPS.forEach((_, dotIndex) => {
    const dot = document.createElement("span");
    dot.className = "carousel-dot";
    if (dotIndex === index) dot.classList.add("is-current");
    dots.append(dot);
  });
  status.append(dots);
  section.append(status);

  const article = document.createElement("article");
  article.className = "carousel-step";
  article.dataset.expanded = String(isExpanded);

  const header = document.createElement("header");
  header.className = "step-header";
  const h2 = document.createElement("h2");
  h2.textContent = step.title;
  header.append(h2);
  const summary = document.createElement("p");
  summary.className = "step-summary";
  summary.textContent = step.summary;
  header.append(summary);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "step-toggle";
  toggle.setAttribute("aria-expanded", String(isExpanded));
  toggle.textContent = isExpanded ? "Hide the request" : "Show the request";
  header.append(toggle);
  article.append(header);

  if (isExpanded) {
    article.append(buildStepDetail(index));
  }
  section.append(article);

  const nav = document.createElement("nav");
  nav.className = "carousel-nav";
  nav.setAttribute("aria-label", "Step navigation");

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "carousel-prev";
  prev.textContent = "← Back";
  prev.disabled = index === 0;
  nav.append(prev);

  const next = document.createElement("button");
  next.type = "button";
  next.className = "carousel-next";
  next.textContent = "Next →";
  next.disabled = index === STEPS.length - 1;
  nav.append(next);

  section.append(nav);
  root.append(section);
}

export function mountCarousel(root: HTMLElement): void {
  const state: CarouselState = {
    index: 0,
    expanded: STEPS.map(() => false),
  };

  function goTo(newIndex: number): void {
    const clamped = Math.min(Math.max(newIndex, 0), STEPS.length - 1);
    if (clamped === state.index) return;
    state.index = clamped;
    render(root, state);
  }

  function toggleExpanded(): void {
    state.expanded[state.index] = !state.expanded[state.index];
    render(root, state);
  }

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".step-toggle")) toggleExpanded();
    else if (target.closest(".carousel-prev")) goTo(state.index - 1);
    else if (target.closest(".carousel-next")) goTo(state.index + 1);
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

  render(root, state);
}
