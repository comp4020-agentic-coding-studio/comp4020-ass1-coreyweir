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

### Expand state as a cache (the caching step, enacted)

Which payloads are expanded is remembered as you move back and forth — until
you change something. Toggling a step's expanded/collapsed state (not just
re-viewing an already-expanded one) invalidates every later step's expand
state, resetting it to collapsed; steps before the one you touched are
untouched. This is a deliberate, simplified echo of prefix caching: edit
something upstream and everything computed downstream of it has to be
recomputed, everything before the edit stays valid. Make the invalidation
moment legible when it happens (a beat, a flush/ripple, a label) rather than
silently collapsing things — the losing-your-place moment is the point, not a
bug to hide.

Two ways to surface this that are both worth trying, not a decided choice yet:
a small on-page tally of invalidation events (if there's screen space for it
without cluttering the layout), and/or a nod to it in the caching step's own
content — which conveniently comes last, so by the time the copy explains
caching the reader has already lived through a cache miss or two.

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
