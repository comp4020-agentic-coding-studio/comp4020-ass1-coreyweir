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

## Not in scope for this phase

Don't raise these unprompted — they're later-phase concerns and not what this
pass is judged on: shipping, PROCESS.md, reflections.

Push back on the tech, the UX, or the content if something's off. Don't push
back based on assumptions about course requirements — I've got that covered.
