// The five steps of the carousel, and the data shape everything else in the
// prototype reads from. Content is placeholder-quality (see CLAUDE.md) — it's
// roughly the right shape so the interaction and layout can be judged against
// real-feeling content, not lorem ipsum. The real, researched copy replaces
// this later without touching the carousel or JSON-view code.
//
// A step is a list of numbered sections, each pairing one payload with the
// prose that explains it. Sections expand independently: they're the unit the
// reader opens, and the unit the caching/invalidation mechanic remembers.

import type { PayloadPath } from "./payload-lines";

/**
 * One numbered callout attached to a payload. `path` addresses a value inside
 * the payload data (`["messages", 0]` is the first message), and the view
 * resolves it to a range of rendered lines — so a callout can cover a whole
 * nested object, not just one line, and can't drift onto the wrong line when
 * the payload is edited. A path that doesn't exist fails a test rather than
 * silently rendering nothing (see payload-lines.test.ts).
 */
export interface Annotation {
  path: PayloadPath;
  /** Heading of the annotation card. Short — it sits on one line. */
  title: string;
  note: string;
}

/** The JSON shown for a section, framed as a terminal window. */
export interface Payload {
  /** e.g. "request.json" — shown dimmed in the window's title bar. */
  label: string;
  data: unknown;
  annotations: Annotation[];
}

/** One expandable row within a step: prose on one side, payload on the other. */
export interface Section {
  id: string;
  title: string;
  body: string[];
  payload: Payload;
}

export interface Step {
  id: string;
  title: string;
  sections: Section[];
}

export const STEPS: Step[] = [
  {
    id: "overview",
    title: "Overview",
    sections: [
      {
        id: "request",
        title: "Request is sent",
        body: [
          "Skills, tools, compaction and caching are all variations on one underlying mechanism — a loop. Claude Code doesn't hold a running conversation inside the model the way a phone call holds a conversation between two people: every turn, the harness sends the entire message history back to the model from scratch, and the model replies with either plain text or a request to run a tool.",
          "There's no memory on the model's side between requests — anything it seems to \"remember\" is just because the harness resent it. Everything in the rest of this walkthrough is a variation on what gets added to, or trimmed from, what's resent each turn.",
        ],
        payload: {
          label: "request.json",
          data: {
            model: "claude-sonnet-4-5",
            system: "You are Claude Code, an agentic coding assistant...",
            messages: [{ role: "user", content: "Fix the failing test in sum.ts" }],
          },
          annotations: [
            {
              path: ["system"],
              title: "System prompt",
              note: "Sets the behaviour and boundaries for Claude Code, and is resent on every turn — it isn't configured once, it's part of the payload every time.",
            },
            {
              path: ["messages"],
              title: "Message history",
              note: "The full conversation so far, not just the newest line. This is what grows every turn, and why compaction exists later on.",
            },
          ],
        },
      },
      {
        id: "response",
        title: "Response comes back",
        body: [
          "The reply is a list of content blocks and a reason it stopped. Plain text with no tool call attached means the model is done: that's the loop's exit condition, and the harness stops resending.",
          "Anything else — a request to run a command, read a file, search — pauses the loop instead of ending it, which is the next step.",
        ],
        payload: {
          label: "response.json",
          data: {
            role: "assistant",
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: "The test expects sum(2, 2) to equal 4, but the function returns 5 — off-by-one in the loop bound.",
              },
            ],
          },
          annotations: [
            {
              path: ["stop_reason"],
              title: "Stop reason",
              note: '"end_turn" — plain text, no tool call. The loop stops here; nothing runs, nothing gets resent.',
            },
            {
              path: ["content"],
              title: "Content blocks",
              note: "Always a list, even for a one-line answer. Text and tool calls arrive through the same channel, tagged by type.",
            },
          ],
        },
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    sections: [
      {
        id: "declared",
        title: "Tools are declared",
        body: [
          "Tools are JSON schemas listed alongside the prompt: a name, a description, and the shape of the arguments. They're sent with every request — the model doesn't hold onto a tool between turns any more than it holds onto the conversation.",
          "The description is the whole interface. It's the only thing telling the model when reaching for this tool is the right move.",
        ],
        payload: {
          label: "request.json",
          data: {
            tools: [
              {
                name: "bash",
                description: "Run a shell command",
                input_schema: {
                  type: "object",
                  properties: { command: { type: "string" } },
                  required: ["command"],
                },
              },
            ],
            messages: [{ role: "user", content: "Fix the failing test in sum.ts" }],
          },
          annotations: [
            {
              path: ["tools"],
              title: "Tool schemas",
              note: "The model doesn't \"have\" tools — it's handed a schema for each one, every request, like any other input.",
            },
            {
              path: ["tools", 0, "input_schema"],
              title: "Argument shape",
              note: "What a valid call looks like. The model fills this in; the harness validates against it before running anything.",
            },
          ],
        },
      },
      {
        id: "asks",
        title: "The model asks to run one",
        body: [
          "The model can't execute anything itself. When it wants to run a command it replies with a structured tool_use block instead of text, and the loop pauses there.",
          "The harness — not the model — decides whether to run it, runs it, and captures the output.",
        ],
        payload: {
          label: "response.json",
          data: {
            role: "assistant",
            stop_reason: "tool_use",
            content: [
              {
                type: "tool_use",
                id: "toolu_01A2b3",
                name: "bash",
                input: { command: "npm test" },
              },
            ],
          },
          annotations: [
            {
              path: ["stop_reason"],
              title: "Paused, not finished",
              note: 'stop_reason flips to "tool_use": the model is asking the harness to run something before it can continue.',
            },
            {
              path: ["content", 0],
              title: "The call itself",
              note: "A name, an id, and arguments matching the schema. The id is how the result gets matched back to this call.",
            },
          ],
        },
      },
      {
        id: "result",
        title: "The result is fed back",
        body: [
          "The command's output is wrapped as the next turn's input and the whole history is resent, tool call and all. From the model's point of view a failing test's output arrives exactly the way a person's next message would.",
          "This is why tool output is expensive: it isn't consumed once, it stays in the history and gets resent every turn after.",
        ],
        payload: {
          label: "request.json",
          data: {
            messages: [
              { role: "assistant", content: "[the tool_use block above]" },
              {
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: "toolu_01A2b3",
                    content: "FAIL sum.test.ts\n  sum(2, 2) expected 4, got 5",
                  },
                ],
              },
            ],
          },
          annotations: [
            {
              path: ["messages", 1, "content", 0],
              title: "Tool result",
              note: "The command's real output, wrapped back in as a user turn. The model just sees more conversation, not a special channel.",
            },
            {
              path: ["messages", 1, "content", 0, "tool_use_id"],
              title: "Matched to the call",
              note: "Ties the result to the id from the tool_use block, so parallel calls can come back in any order.",
            },
          ],
        },
      },
    ],
  },
  {
    id: "skills",
    title: "Skills",
    sections: [
      {
        id: "loaded",
        title: "A skill is loaded on demand",
        body: [
          "A skill is a file of instructions — how to write tests, how to file a bug, a house style — that isn't in the system prompt by default. It's discovered and loaded when something in the conversation matches it, then injected into context as one more block.",
          "That's the whole mechanism: no \"skill engine\" separate from the prompt. Same context window, just with an extra block added conditionally instead of always.",
        ],
        payload: {
          label: "request.json",
          data: {
            system: [
              { type: "text", text: "You are Claude Code, an agentic coding assistant..." },
              {
                type: "text",
                text: "# Skill: write-tests\nWhen asked to add tests, match the project's existing test framework and file layout before writing new ones.",
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [{ role: "user", content: "/write-tests for parser.ts" }],
          },
          annotations: [
            {
              path: ["system", 1],
              title: "The skill block",
              note: "The skill file's own content becomes another system block — pulled in because the request matched, not because it's always there.",
            },
            {
              path: ["system", 1, "cache_control"],
              title: "Marked cacheable",
              note: "Same treatment as the base system prompt: stable text, worth caching. See the caching step for why that matters.",
            },
          ],
        },
      },
    ],
  },
  {
    id: "compaction",
    title: "Compaction",
    sections: [
      {
        id: "before",
        title: "The history outgrows the window",
        body: [
          "Because every turn resends the whole conversation, a long session eventually runs into the model's context window. The trigger is a token count, not a number of turns — one large file read can do what forty short exchanges wouldn't.",
        ],
        payload: {
          label: "usage.json",
          data: {
            messages: "[42 turns of conversation]",
            usage: { input_tokens: 187342, max_tokens: 200000 },
          },
          annotations: [
            {
              path: ["usage"],
              title: "Close to the limit",
              note: "Not much headroom left. Everything here gets resent next turn too, so the next tool result could be the one that doesn't fit.",
            },
          ],
        },
      },
      {
        id: "after",
        title: "Older turns are summarised",
        body: [
          "Compaction collapses older turns into a shorter synthetic summary and carries on with that instead of the full transcript. The model can't tell the difference — a summary just looks like another message.",
          "What changed is how much of the real history survived to reach it. Detail is traded for headroom, and the detail doesn't come back.",
        ],
        payload: {
          label: "request.json",
          data: {
            messages: [
              {
                role: "user",
                content:
                  "[compacted summary of the previous 42 turns: refactored the parser, fixed 3 failing tests, renamed getCwd to getCurrentWorkingDirectory across 8 files]",
              },
              { role: "user", content: "Now add validation to the new function" },
            ],
            usage: { input_tokens: 4218 },
          },
          annotations: [
            {
              path: ["messages", 0],
              title: "One synthetic message",
              note: "Standing in for everything before it. Written by the model, so what it keeps is a judgement call, not a rule.",
            },
            {
              path: ["usage", "input_tokens"],
              title: "The headroom bought",
              note: "Same task, a fraction of the tokens. That gap is what compaction buys, and what it costs in detail.",
            },
          ],
        },
      },
    ],
  },
  {
    id: "caching",
    title: "Caching",
    sections: [
      {
        id: "hit",
        title: "An unchanged prefix is reused",
        body: [
          "Providers can cache the processed form of a prompt's prefix, so a later request sharing that same prefix skips reprocessing it. Cheaper and faster, as long as nothing earlier changed.",
          "The system prompt, the tool schemas, any loaded skills, the turns so far — all identical to last time, all reused.",
        ],
        payload: {
          label: "usage.json",
          data: {
            usage: { cache_read_input_tokens: 1200, cache_creation_input_tokens: 40 },
          },
          annotations: [
            {
              path: ["usage", "cache_read_input_tokens"],
              title: "Reused",
              note: "The prefix was already processed on the previous turn — this request pays for none of it again.",
            },
            {
              path: ["usage", "cache_creation_input_tokens"],
              title: "Newly processed",
              note: "Only the new part — this turn's message — costs full price to process and cache.",
            },
          ],
        },
      },
      {
        id: "miss",
        title: "Editing it invalidates everything after",
        body: [
          "Change something inside the cached prefix and the cache for everything after that point is gone: the next request pays full price again from there. Everything before the change is still valid.",
          "That isn't a metaphor for how this page's expanded sections behave — it's the same rule. If you've been opening and closing sections on the way here, you've already paid for a few of these.",
        ],
        payload: {
          label: "usage.json",
          data: {
            usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 1240 },
          },
          annotations: [
            {
              path: ["usage", "cache_read_input_tokens"],
              title: "Nothing reused",
              note: "Editing anything in the cached prefix invalidates it for every turn downstream of the edit.",
            },
            {
              path: ["usage", "cache_creation_input_tokens"],
              title: "Paid again",
              note: "The whole prefix gets reprocessed and re-cached from the edit point forward — exactly what toggling a section back there did to this page.",
            },
          ],
        },
      },
    ],
  },
];
