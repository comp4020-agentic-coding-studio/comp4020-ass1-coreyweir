// The five steps of the carousel, and the data shape everything else in the
// prototype reads from. Content is placeholder-quality (see CLAUDE.md) — it's
// roughly the right shape so the interaction and layout can be judged against
// real-feeling content, not lorem ipsum. The real, researched copy replaces
// this later without touching the carousel or JSON-view code.

/**
 * One numbered callout attached to a payload block. `match` is a substring
 * looked up in the block's beautified JSON text at render time — the first
 * line containing it gets the marker. Content-based matching (rather than a
 * fixed line number) means the annotation still lands in the right place if
 * the payload's JSON is reformatted or reordered later.
 */
export interface Annotation {
  match: string;
  note: string;
}

/** A single JSON box shown alongside a step (e.g. "Request", "Response"). */
export interface PayloadBlock {
  label: string;
  data: unknown;
  annotations: Annotation[];
}

export interface Step {
  id: string;
  title: string;
  /** One line shown on the collapsed carousel card. */
  summary: string;
  /** Explanatory copy for the left column when the step is expanded. */
  body: string[];
  payloads: PayloadBlock[];
}

export const STEPS: Step[] = [
  {
    id: "loop",
    title: "The loop",
    summary: "Every turn resends the whole conversation and waits for text or a tool call back.",
    body: [
      "Claude Code doesn't hold a running conversation inside the model the way a phone call holds a conversation between two people. Every turn, the harness sends the entire message history back to the model from scratch, and the model replies with either plain text or a request to run a tool.",
      "There's no memory on the model's side between requests — anything it seems to \"remember\" is just because the harness resent it. The loop ends when a reply comes back with no tool call attached: that's the model saying it's done.",
    ],
    payloads: [
      {
        label: "Request",
        data: {
          model: "claude-sonnet-4-5",
          system: "You are Claude Code, an agentic coding assistant...",
          messages: [{ role: "user", content: "Fix the failing test in sum.ts" }],
        },
        annotations: [
          {
            match: '"system"',
            note: "Resent on every turn — the system prompt isn't set up once, it's part of the payload every time.",
          },
          {
            match: '"messages"',
            note: "The full conversation so far, not just the newest line. This is what grows every turn, and why compaction exists later on.",
          },
        ],
      },
      {
        label: "Response",
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
            match: '"stop_reason"',
            note: '"end_turn" — plain text, no tool call. The loop stops here; nothing runs, nothing gets resent.',
          },
        ],
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    summary: "The model doesn't run code — it asks the harness to, then waits for the result.",
    body: [
      "Tools are just JSON schemas listed alongside the prompt: a name, a description, and the shape of the arguments. The model doesn't execute anything itself — when it wants to run something, it replies with a structured tool_use block instead of text, and the loop pauses.",
      "The harness (not the model) actually runs the command, then sends the result back as the next turn's input. From the model's point of view, a shell command's output arrives the same way a person's next message would.",
    ],
    payloads: [
      {
        label: "Request (tools attached)",
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
            match: '"tools"',
            note: "The model doesn't \"have\" tools — it's handed a schema for each one, every request, like any other input.",
          },
        ],
      },
      {
        label: "Response (asks to run one)",
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
            match: '"tool_use"',
            note: 'stop_reason flips to "tool_use": the model is pausing to ask the harness to run something before it continues.',
          },
        ],
      },
      {
        label: "Next request (result fed back)",
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
            match: '"tool_result"',
            note: "The command's real output, wrapped back in as a user turn. The model just sees more conversation, not a special channel.",
          },
        ],
      },
    ],
  },
  {
    id: "skills",
    title: "Skills",
    summary: "Reusable instructions that get pulled into context only when they match.",
    body: [
      "A skill is a file of instructions — how to write tests, how to file a bug, a house style — that isn't in the system prompt by default. Instead it's discovered and loaded when something in the conversation matches it, then injected into context as one more block.",
      "That's the whole mechanism: no special \"skill engine\" separate from the prompt. It's the same context window, just with an extra block added conditionally instead of always.",
    ],
    payloads: [
      {
        label: "Request",
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
            match: "Skill: write-tests",
            note: "The skill file's own content becomes another system block — pulled in because the request matched, not because it's always there.",
          },
          {
            match: '"cache_control"',
            note: "Marked cacheable, same as the base system prompt — see the caching step for why that matters.",
          },
        ],
      },
    ],
  },
  {
    id: "compaction",
    title: "Compaction",
    summary: "When the history gets too long, older turns are summarized instead of dropped.",
    body: [
      "Because every turn resends the whole conversation, a long session eventually runs into the model's context window. Compaction is what happens before that limit is hit: older turns are collapsed into a shorter synthetic summary, and the loop carries on with that instead of the full transcript.",
      "The model can't tell the difference — a compacted summary just looks like another message. What changed is how much of the real history survived to reach it.",
    ],
    payloads: [
      {
        label: "Before compaction",
        data: {
          messages: "[42 turns of conversation]",
          usage: { input_tokens: 187342 },
        },
        annotations: [
          {
            match: "187342",
            note: "Getting close to the context window. This is the trigger — a token count, not a fixed number of turns.",
          },
        ],
      },
      {
        label: "After compaction",
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
            match: "compacted summary",
            note: "One synthetic message standing in for everything before it — detail traded for headroom.",
          },
          {
            match: "4218",
            note: "Same task, a fraction of the tokens. That headroom is what compaction buys.",
          },
        ],
      },
    ],
  },
  {
    id: "caching",
    title: "Caching",
    summary: "Reusing an unchanged prefix is cheap. Editing it invalidates everything after.",
    body: [
      "Providers can cache the processed form of a prompt's prefix, so a later request that shares that same prefix skips reprocessing it — cheaper and faster, as long as nothing earlier changed.",
      "The moment something in the cached prefix changes, the cache for everything after that point is gone: the next request pays full price again from there. That's not a metaphor for this page's expand-state behaviour above — it's the same rule.",
    ],
    payloads: [
      {
        label: "Turn 2 (prefix reused)",
        data: {
          usage: { cache_read_input_tokens: 1200, cache_creation_input_tokens: 40 },
        },
        annotations: [
          {
            match: '"cache_read_input_tokens": 1200',
            note: "The prefix was already processed on the previous turn — this request pays for none of it again.",
          },
          {
            match: '"cache_creation_input_tokens": 40',
            note: "Only the new part (this turn's message) costs full price to process and cache.",
          },
        ],
      },
      {
        label: "Turn 3, after editing an earlier message (cache miss)",
        data: {
          usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 1240 },
        },
        annotations: [
          {
            match: '"cache_read_input_tokens": 0',
            note: "Nothing reused. Editing anything in the cached prefix invalidates it for every turn downstream of the edit.",
          },
          {
            match: '"cache_creation_input_tokens": 1240',
            note: "The whole prefix gets reprocessed and re-cached from the edit point forward — exactly what toggling a step above just did to this page.",
          },
        ],
      },
    ],
  },
];
