# How Claude Code Works — prototype

An interactive, one-idea explainer: a one-way carousel walks through how Claude
Code works (the request loop, tools, skills, compaction, caching), and clicking
into a step reveals the actual request/response payload behind it, annotated.
The point isn't to describe context management — it's to make the reader
manage their own attention across a fixed sequence of information, the same
way the agent does. Minimal, focused, one idea carried all the way. If a
feature doesn't serve that, it's probably not worth building yet.

## Current thinking on the interaction (not locked in)

This is the plan going into prototyping, not a spec. I haven't built this yet
and don't know if it'll feel right — figuring that out is the point of this
phase. If something you try contradicts this and feels better, say so and
we'll change the plan and this file together, rather than forcing the build to
match stale intentions.

- One-way carousel: a fixed sequence of steps, forward/back only, no branching.
- Move between steps via arrow keys, clicking a next/prev affordance, or drag.
- Clicking into a step reveals its payload (the actual request/response shape
  for that stage), with highlighting and annotations pointing at what matters.
- Overview line at the top stating the point of the site, plain and short.

### Sections and annotation cards (settled from mockups, built)

A step is a list of numbered sections, each pairing one payload with the prose
explaining it, expanded independently. Annotations are addressed by JSON path
rather than by matching text, so a callout can cover a whole nested object and
a stale one fails a test instead of silently vanishing.

Hovering an annotated region outlines it; clicking opens a card beside it, with
a leader line back to a marker that collapses to a dot once the card carries
the number. Cards are closable, several can be open, and Escape clears them.

Card placement, in preference order — the rule being "land in empty space",
and which direction that is inverts between the two layouts:

- Side by side (prose | payload): right of the box, then **below** it. Never
  left, because left is the prose: covering the text you're reading is worse
  than hanging under the box.
- Stacked (payload above prose): right, then left — the page margins beside the
  box are free there — then below.
- All of a payload's cards go to the same zone. A mix of one beside the box and
  another under it reads as a bug even when each is individually sensible.
- Overlapping a heading or the prose is fine: cards are closable and (soon)
  draggable, so overlap is recoverable. Going off-screen isn't, and horizontal
  scroll is never acceptable — that's the constraint the placement pass exists
  to satisfy.
- Cards should be draggable. Not yet built; the plumbing (position as an offset
  from the region, recomputed on resize) is in place for it. Once it exists,
  the "orbit the anchor point until it fits" idea becomes cheap — it's just
  choosing a different initial offset — but the four zones above cover the real
  cases, so intermediate angles are only worth it if something specific needs
  dodging.

### Expand state as a cache (the caching step, enacted)

Which sections are expanded, and which annotation cards are open, is remembered
as you move back and forth — until you change something. Toggling any of that
(not just re-viewing it) invalidates every later step's state, resetting it;
steps before the one you touched are untouched. Sections within the step you
touched are also untouched — the unit of invalidation is the step. This is a deliberate, simplified echo of prefix caching: edit
something upstream and everything computed downstream of it has to be
recomputed, everything before the edit stays valid. Make the invalidation
moment legible when it happens (a beat, a flush/ripple, a label) rather than
silently collapsing things — the losing-your-place moment is the point, not a
bug to hide.

Surfaced two ways, both built. The collapse itself happens on steps that
aren't on screen, so the feedback has to be where the reader is looking or the
moment passes unnoticed:

- A tally of cache misses beside the carousel, whose count flashes as it
  increments. It only counts when state was really discarded — a toggle with
  nothing open downstream isn't a miss, and counting it would make the number
  mean nothing.
- A wipe passing across the next step's name in the nav, travelling away from
  the reader in the direction of the steps just cleared. It can only gesture at
  the whole downstream, since the step that was holding state might be three
  along, but a symbol pointing the right way beats no feedback.

The caching step's own copy also nods to it — that step comes last, so by the
time the text explains caching the reader has already paid for a miss or two.

## Content: placeholder-quality is fine for now

I don't have the real internals content ready — that's separate prep work
happening outside this repo. For this phase, write good-enough placeholder
copy for each step (loop, tools, skills, compaction, caching) from general
knowledge of how Claude Code works. It doesn't need to be authoritative yet;
it needs to be roughly the right shape so we can judge the interaction and
layout against real-feeling content. I'll swap in the researched version
later — don't treat placeholder copy as a decision that needs defending.

## What "holds up under misuse" means here

Build toward these from the start rather than bolting them on at the end:

- Survives a resize mid-interaction — no lost state, no broken layout.
- Works at both mobile and desktop widths.
- Something sensible is on screen before everything has loaded; preload where
  it's cheap to.

## How to work in here

- `pnpm dev` running while you work; look at the rendered page, not your
  mental model of it. The `agent-browser` CLI is installed — use it to open
  the page, check a viewport, or screenshot a resize, rather than guessing.
- Small commits as the interaction takes shape — I want the harness and the
  history to show real iteration this time, not a single dump.
- Single-threaded: no subagents for this repo. Keep the reasoning in this
  session so the back-and-forth stays visible.
- Stack is the template default (Vite/TS/plain HTML) — no decision made to
  change it. If a real reason to switch shows up during prototyping, we'll do
  it deliberately and it'll be a visible change to this file, not a silent one.
  Bringing in dependencies (fonts, a small library) or switching pieces of the
  stack is fair game if there's a real reason — just make the reason visible
  here rather than reaching for something silently.
- Research tool order: try a plain `webfetch` first. Only fall back to the
  `ddg_jina_fetch` MCP tool when `webfetch` errors or the page is clearly
  client-side rendered (empty/near-empty markdown back), or when fetching a
  PDF — `ddg_jina_fetch` goes through r.jina.ai and returns it as markdown.
  Use `ddg_jina_search` for web search. `gh` is available for anything
  GitHub-shaped (issues, PRs, releases, repo contents).

## Not in scope for this phase

Don't raise these unprompted — they're later-phase concerns and not what this
pass is judged on: shipping, PROCESS.md, reflections.

Push back on the tech, the UX, or the content if something's off. Don't push
back based on assumptions about course requirements — I've got that covered.
