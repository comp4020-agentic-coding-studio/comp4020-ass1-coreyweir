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

Card placement, in preference order — the rule being "land in empty space":

- Right of the box, each card level with its own region.
- Below the box, flowed into rows.
- Above the box, when the box's bottom sits near the bottom of the window and
  cards below it would open off-screen — the worst outcome available, since the
  reader clicks and it looks like nothing happened.
- If neither above nor below has room, the stack slides back into view and
  overlaps the payload. Overlap is the lesser loss.
- All of a payload's cards go to the same zone. A mix of one beside the box and
  another under it reads as a bug even when each is individually sensible.
- Overlapping a heading or the prose is fine: cards are closable and draggable,
  so overlap is recoverable. Going off-screen isn't, and horizontal scroll is
  never acceptable — that's the constraint the placement pass exists to satisfy.
- Cards may not cover the carousel's own nav, though. Covering prose is
  recoverable; covering the arrows and the step title looks like the site has
  stopped working rather than like something is in the way, so the room above
  the payload is measured from the nav rather than from the top of the window.
- Bounds come from `documentElement.clientWidth/Height`, not `window.inner*`,
  which includes the classic scrollbar gutter — measuring from innerWidth lets a
  card sit under the scrollbar and forces exactly the horizontal scroll this is
  meant to prevent. It can't be caught in a headless browser, which reports a
  scrollbar width of zero.

A "left of the box" zone was planned for the stacked layout, built, and then
removed: the payload always spans the content column, so the margin beside it is
(viewport − 1024px) / 2, which only exceeds a card's width above ~1580px — by
which point the layout is side by side and the right-hand gutter already fits.
No viewport could reach it. Capping the payload's width doesn't rescue it
either: at 820px an aggressive cap still leaves ~150px a side, and a 150px-wide
card isn't readable. Worth recording because "left or right, whichever has room"
is the obvious instinct, and the arithmetic says the room isn't there.

Cards are draggable by their header (double-click puts one back). A drag is
stored as an offset from the placement, not an absolute position, so a dragged
card still travels with its region on a resize. Dragging is **not** an edit for
the caching mechanic below — it doesn't invalidate anything or count as a miss —
but the position is remembered state like the rest, so a flush caused by
something else resets it. Closing a card also forgets its position, so
reopening it from the marker starts beside the lines it describes.

With the four-zone idea reduced to two, "orbit the anchor until it fits" has
nothing left to solve: intermediate angles only pay off when dodging specific
content, and overlapping content is allowed here.

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

## Content: the copy pass

The prototype's copy is placeholder — written from general knowledge of how
Claude Code works, and swapped in wholesale with the real thing once it exists.
What's here now is the *shape* that's been settled by building against it: don't
treat the placeholder text as content decisions, but do treat the structure as
decided. For each section, the prose goes left and the payload goes right (the
payload reorders above the prose on narrow widths — that's layout, not a
statement about content); each section pairs one payload with two-ish short
paragraphs; each annotation has a one-line card title and a note of roughly one
to three sentences.

### What the copy does and doesn't carry

The site's idea is **attention, not context**: it isn't a reference on
management, and the copy shouldn't try to be one. The sections' prose should be
plain and confident — someone who understands the loop explaining it to you,
not a manual. Where the old placeholder copy worked, it worked by *taking the
payload at face value and explaining what's actually in it* — the note
"Content blocks" points out the array is a list even for one line; "Same task,
a fraction of the tokens" does the arithmetic the payload implies. That framing,
not the specific sentences, is what the copy pass should keep. It's also what
the caching step is *for*: "That isn't a metaphor for how this page's expanded
sections behave — it's the same rule. If you've been opening and closing
sections on the way here, you've already paid for a few of these." is the
strongest writing in the file, because it makes the reader the subject.

### Hard constraints

- **The step headings are fixed.** Overview, Tools, Skills, Compaction, Caching
  — don't change them, and don't rename or reorder the steps. Keep every section
  with its payload (the section's own `title` may change).
- **The payloads are placeholder too.** The `data` values are invented examples
  (the model name, the token counts, the fake `sum.ts` bug), not a reference
  spec — replace them with the researched reality. But a payload is the anchor
  of its section: the prose and every annotation must stay consistent with what
  is actually shown in the JSON, so when the shape changes, the paths and notes
  change with it. Don't write copy that describes a payload that isn't there.
- **No structural, layout, or code changes.** This pass is copy only. If
  something isn't expressible in `steps.ts`, say so rather than reaching for
  other files.
- The payload label (`request.json`, `usage.json`, …) may change. The
  annotation `path` is functional in one narrow sense: it must resolve against
  its payload's data, and the tests enforce that — update it to match a changed
  payload. A stale path is a caught error, not a silent miss.

### Sources, and how to use them

The research lives as a folder of markdown and Mermaid diagrams. Use them as a
base — but treat them as raw material, not as copy to import:
there could be too much detail; the structure or focus could be wrong for this
site; the tone could be off; a diagram could be vertical when it should be
horizontal, or too dense, or just not worth including. Nothing in the research
trumps the settled shape above.

This is a content role, not a research role: the job is to **write the copy**
and be the editor. If a claim genuinely needs verifying, verify it quietly —
don't treat "the markdown says so" as sufficient authority, and don't
over-research. You're not writing a spec.

### What to consider

- **The tone** is the main thing this pass is judged on. The right tone is
  *informative, plain, and calm* — precise and confident, with a light touch of
  craft ("costs full price" rather than "is charged"), never hypey, never
  technical-speak for its own sake. A capitalised term first lands in backticks
  or quotes so it reads as a name rather than a shout. Address the reader
  sparingly, for real moments ("you've already paid for a few of these"), not
  as a habit.
- **Precision before charm.** If there's a gap between a cool metaphor and what
  the payload actually shows, the payload wins. Don't invent capabilities,
  performance claims, or "under the hood" detail the research doesn't support.
- **The balance** is between being informative, relevant/concise, and engaging.
  This is a quick, rhythmic read, not a deep dive. When in doubt, shorter — cut
  a section to one tight paragraph rather than padding to two. Leave room for
  the payload; the page's job is to get the reader to look at it.
- **Pay off the annotations.** Each section's prose should set up its
  annotations — the payload boxes are the point. A good note *uses* the payload
  (quoting a value, doing the arithmetic) instead of glossing it.
- **Speak to the reader's moment.** A reader has navigated forward through prior
  steps to reach this one; they've seen compaction and caching advertised
  before. Echo forward, don't re-explain. Where the site's own mechanics echo
  the material (toggling a section *is* an invalidation), use that rather than
  hiding it.
- **Think about structure.** The placeholder has one payload per section, but
  there may be better cuts or sections than the current shape suggests. The
  section headings and the prose count as fair game; the *step* structure is
  fixed. If something fits better as a different set of sections, propose it
  with confidence and a reason.
- **Keep numbers and claims honest.** Facts are the deal. If the research
  contradicts a placeholder figure or a claim, fix it — flag it in the diff if
  it's load-bearing.

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
