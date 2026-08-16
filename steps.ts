// The five steps of the carousel, and the data shape everything else in the
// prototype reads from.
//
// A step is a list of numbered sections, each pairing one payload with the
// prose that explains it. Sections expand independently: they're the unit the
// reader opens, and the unit the caching/invalidation mechanic remembers.
//
// The payloads are trimmed, not invented: long text is elided with a
// [bracketed note] and unrelated keys are dropped, but the shapes and the
// arithmetic are real. Every annotation addresses a path that must resolve
// against its payload, so the prose and the JSON can't drift apart silently.

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
        title: "One request, assembled from scratch",
        body: [
          "There is no session on the model's side. Every time Claude Code needs it, the harness builds a fresh request out of the same three parts — the system prompt, the tool schemas, and the whole conversation so far — and sends the lot.",
          "So a conversation isn't something the model has. It's something the harness resends. Tools, skills, compaction and caching are all variations on what gets added to that pile, or trimmed out of it.",
        ],
        payload: {
          label: "request.json",
          data: {
            model: "claude-sonnet-4-6",
            system: [
              {
                type: "text",
                text: "You are Claude Code, Anthropic's official CLI for Claude...",
              },
              {
                type: "text",
                text: "# Environment\nWorking directory, platform, today's date...",
              },
            ],
            tools: "[14 tool schemas — the next step]",
            messages: [
              { role: "user", content: "can you add a dark mode toggle to the app?" },
            ],
          },
          annotations: [
            {
              path: ["system"],
              title: "Not configured once",
              note: "The harness's own instructions — identity, tool rules, the environment it's running in. A list of blocks, sent again in full on every request of every turn.",
            },
            {
              path: ["tools"],
              title: "Every tool, every time",
              note: "Fourteen schemas, shipped whether or not a single one gets called. That bill arrives on each pass of the loop, which is what the next step is about.",
            },
            {
              path: ["messages"],
              title: "One line, for now",
              note: "The history starts here and only grows: each pass of the loop adds a tool call and its result, and all of it comes back on the next request.",
            },
          ],
        },
      },
      {
        id: "response",
        title: "Think, speak, act",
        body: [
          'The reply is an array of content blocks, and it can hold more than one kind at a time. A "thinking" block is the model\'s reasoning — you never see it, but it is sent back with every later request in the turn, so it costs context like anything else.',
          "The last block here is a tool_use: a request for the harness to go and run something. That is what makes this a loop rather than an answer.",
        ],
        payload: {
          label: "response.json",
          data: {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking:
                  "Dark mode means a theme toggle. Find where the theme is defined before touching anything.",
                signature: "1e9f8c...",
              },
              {
                type: "text",
                text: "I'll add a dark mode toggle. Let me check where the theme is defined.",
              },
              {
                type: "tool_use",
                id: "toolu_01A7",
                name: "Grep",
                input: { pattern: "useTheme", path: "src" },
              },
            ],
            stop_reason: "tool_use",
          },
          annotations: [
            {
              path: ["content", 0],
              title: "Reasoning, out of sight",
              note: "Never shown to you, always resent. The model thinks before each action rather than once at the start, so a thinking-heavy session is a context-heavy one.",
            },
            {
              path: ["content", 2],
              title: "Asking, not doing",
              note: "A name, an id, and arguments. The model can't run Grep itself — it writes down the call and waits for the harness to come back with the output.",
            },
            {
              path: ["stop_reason"],
              title: "Paused, not finished",
              note: '"tool_use" means the turn is still going. The harness runs the tool, appends the result, and sends the whole conversation again.',
            },
          ],
        },
      },
      {
        id: "end-turn",
        title: "The turn ends when the tools stop",
        body: [
          "Sooner or later a reply comes back with text and no tool call. That's the exit condition: nothing runs, nothing is resent, and Claude Code goes quiet until you type again.",
          "The usage block is the quiet preview of everything still to come. Resending the entire conversation on every pass would be indefensible at full price — so almost none of it is charged at full price.",
        ],
        payload: {
          label: "response.json",
          data: {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "Done — the toggle lives in src/theme.ts and is wired to the header button.",
              },
            ],
            stop_reason: "end_turn",
            usage: {
              input_tokens: 12,
              cache_read_input_tokens: 130000,
              cache_creation_input_tokens: 5482,
              output_tokens: 184,
            },
          },
          annotations: [
            {
              path: ["stop_reason"],
              title: "The exit condition",
              note: '"end_turn" — the one kind of reply the harness doesn\'t answer with another request. Control comes back to you, and the next message starts a fresh loop.',
            },
            {
              path: ["usage"],
              title: "Three of these are input",
              note: "Only 12 tokens of this request were processed fresh. The other 135,482 were read back from a cache or written into one — which is where this walkthrough ends up.",
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
        id: "schema",
        title: "A tool is a schema",
        body: [
          "A tool is a name, a description, and a JSON Schema for its arguments. The model chooses by reading the description and replies with JSON that has to fit the schema. There is no code on its side of the wire.",
          "Which makes the description prompt engineering in disguise — it's the only thing standing between a well-chosen tool and a wasted call. It's also tokens, resent on every pass of the loop.",
        ],
        payload: {
          label: "tools.json",
          data: {
            name: "Bash",
            description:
              "Run a bash command in the session's shell. Prefer Read and Grep over cat and grep — the dedicated tools are faster and easier to read.",
            input_schema: {
              type: "object",
              properties: {
                command: { type: "string", description: "The command to run" },
                description: {
                  type: "string",
                  description: "A one-line explanation of what this runs and why",
                },
              },
              required: ["command", "description"],
            },
          },
          annotations: [
            {
              path: ["description"],
              title: "The whole interface",
              note: "Half of it is spent telling the model when not to reach for this. A description isn't documentation — it's where a tool competes for attention against every other one loaded.",
            },
            {
              path: ["input_schema", "properties"],
              title: "The shape of a call",
              note: "The model writes JSON to fit this, and the harness checks it before running anything — so a malformed call costs a round trip rather than a broken command.",
            },
            {
              path: ["input_schema", "required"],
              title: "Both, every time",
              note: 'The "description" argument is required, which is why every command Claude runs arrives with a one-line reason attached. The schema is doing the work of a house rule.',
            },
          ],
        },
      },
      {
        id: "result",
        title: "The result comes back as conversation",
        body: [
          "The harness runs the command, captures the output, and wraps it as the next request's input. From the model's side there is no special channel — a stack trace arrives exactly the way your message did.",
          "Which is also why tool output is expensive. It isn't consumed and discarded; it joins the history, and gets resent for the rest of the session.",
        ],
        payload: {
          label: "request.json",
          data: {
            messages: [
              { role: "user", content: "can you add a dark mode toggle to the app?" },
              { role: "assistant", content: "[thinking, text, and the Grep call]" },
              {
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: "toolu_01A7",
                    content:
                      "src/theme.ts:4:export function useTheme() {\nsrc/App.tsx:11:  const theme = useTheme();",
                  },
                ],
              },
            ],
          },
          annotations: [
            {
              path: ["messages", 1],
              title: "Already history",
              note: "The model's own reply from a moment ago, handed back to it verbatim. The loop doesn't continue a request so much as start a longer one.",
            },
            {
              path: ["messages", 2],
              title: "A result is a user turn",
              note: 'Tool output comes back in the "user" role. The model reads its own results and your words interleaved, in one flat list, with nothing marking which is which.',
            },
            {
              path: ["messages", 2, "content", 0, "tool_use_id"],
              title: "Matched to the call",
              note: "The id from the tool_use block. Several tools can run at once and finish out of order; this is the only thing keeping them straight.",
            },
          ],
        },
      },
      {
        id: "deferred",
        title: "Most tools aren't really loaded",
        body: [
          "Schemas are tokens and they're on every request. Install a handful of MCP servers and the tool definitions alone can run to tens of thousands of tokens before any work happens.",
          "So the harness defers most of them. A deferred tool is still sent, but flagged: the model sees a name and nothing else, and calls ToolSearch when it wants the real schema. What you leave loaded is a bill you pay on every turn.",
        ],
        payload: {
          label: "request.json",
          data: {
            tools: [
              { name: "Read", description: "Read a file from the filesystem..." },
              { name: "Bash", description: "Run a bash command..." },
              {
                name: "ToolSearch",
                description:
                  'Fetch the full schema for a deferred tool so it can be called. Use "select:<name>", or keywords to search.',
              },
              {
                name: "mcp__slack__send_message",
                description: "Send a message to a Slack channel...",
                defer_loading: true,
              },
              {
                name: "mcp__github__create_issue",
                description: "File an issue on a GitHub repository...",
                defer_loading: true,
              },
            ],
          },
          annotations: [
            {
              path: ["tools", 0],
              title: "Always expanded",
              note: "The few tools used constantly stay loaded in full. Reading a file shouldn't cost a round trip to find out how to read a file.",
            },
            {
              path: ["tools", 2],
              title: "The way back in",
              note: "ToolSearch is the one non-core tool that's never deferred — the model needs something already loaded to go looking for the rest with.",
            },
            {
              path: ["tools", 4, "defer_loading"],
              title: "Sent, but not shown",
              note: "The definition is right there in the request; the flag keeps it out of the model's context. It sees the name in a reminder and pays for the schema only if it searches.",
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
        id: "listing",
        title: "One line until you need it",
        body: [
          "A skill is a markdown file: a description, and instructions for a job you do often. The model doesn't get the file. It gets a listing — one line each, injected as a reminder, with the bodies left on disk.",
          "That's the whole trick, and the difference between a skill and a paragraph in CLAUDE.md. Reference material costs almost nothing until the moment it's relevant.",
        ],
        payload: {
          label: "request.json",
          data: {
            role: "user",
            isMeta: true,
            content:
              "<system-reminder>\nThe following skills are available with the Skill tool:\n- deploy: Deploy the app to staging. Use when the user asks to deploy or release.\n- commit: Create a git commit. Use when the user asks to commit changes.\n</system-reminder>",
          },
          annotations: [
            {
              path: ["isMeta"],
              title: "Not actually you",
              note: "The listing arrives as a user message because that's the only channel there is, flagged so the model reads it as harness furniture rather than something you said.",
            },
            {
              path: ["content"],
              title: "Name and description, nothing else",
              note: "No instructions, no path, no body. The description is what your request gets matched against, so it pays to write it the way you'd write search keywords.",
            },
          ],
        },
      },
      {
        id: "invoked",
        title: "Invoking it loads the body",
        body: [
          "Loading a skill is a tool call like any other — the Skill tool, by name. What comes back isn't really a result: the harness reads the file and injects it as the next message, instructions and all.",
          "And it stays. A skill's body is a recurring cost for the rest of the session, which is the argument for keeping it short and putting the one-time setup at the top.",
        ],
        payload: {
          label: "request.json",
          data: {
            messages: [
              {
                role: "assistant",
                content: [
                  {
                    type: "tool_use",
                    id: "toolu_02B3",
                    name: "Skill",
                    input: { skill: "deploy", args: "" },
                  },
                ],
              },
              {
                role: "user",
                content:
                  "<command-name>deploy</command-name>\n<skill-format>true</skill-format>\n\nBase directory: ~/projects/app\n\nDeploy to staging:\n1. Run `npm run build`\n2. Push to the staging branch\n3. Trigger the pipeline and report the URL",
              },
            ],
          },
          annotations: [
            {
              path: ["messages", 0, "content", 0, "input"],
              title: "Called by name",
              note: "The model never reads SKILL.md itself — it names the skill and the harness fetches the body. args carries whatever you typed after /deploy.",
            },
            {
              path: ["messages", 1, "content"],
              title: "The body, verbatim",
              note: "Followed like a checklist. The base directory comes with it, so the skill's supporting scripts and references can be read on demand instead of loaded up front.",
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
        id: "summarise",
        title: "Compaction is just another request",
        body: [
          "The history only grows, so the window eventually runs out. Claude Code sees it coming — with roughly thirteen thousand tokens of headroom left it compacts, rather than waiting until nothing fits.",
          "What it does then is unremarkable, which is the interesting part. It replays the conversation to the model and asks for a summary in a fixed nine-part format. No special machinery. A prompt.",
        ],
        payload: {
          label: "request.json",
          data: {
            messages: [
              "[the conversation so far, replayed in full]",
              {
                role: "user",
                content:
                  "The summary you will produce will replace everything above. Do NOT call tools.\n\nSections: 1. Primary request and intent. 2. Key technical concepts. 3. Files and code sections. 4. Errors and fixes. 5. Problem solving. 6. All user messages. 7. Pending tasks. 8. Current work. 9. Optional next step.",
              },
            ],
          },
          annotations: [
            {
              path: ["messages", 0],
              title: "Everything, one last time",
              note: "The summariser sees the full transcript — your words and every tool result. It's the most expensive request of the session, and the last one that will ever see this much detail.",
            },
            {
              path: ["messages", 1, "content"],
              title: "An instruction, not a feature",
              note: "Nine headings and an order not to call tools. What survives compaction is decided by a prompt, which is why /compact will take instructions of your own.",
            },
          ],
        },
      },
      {
        id: "replaced",
        title: "The summary takes the history's place",
        body: [
          "The old messages are dropped and the summary stands in for them as an ordinary user message. The model can't tell the difference; it just reads a conversation that happens to open with a recap.",
          "The recent turns survive word for word and the last few files read are re-attached, which is why the seam is usually invisible. The detail further back isn't destroyed — it's on disk, and the model is told where. It just isn't in the room any more.",
        ],
        payload: {
          label: "request.json",
          data: {
            messages: [
              {
                role: "user",
                content:
                  "This session is being continued from a conversation that ran out of context.\n\nSummary:\n1. Primary request and intent: add a dark mode toggle...\n3. Files and code sections: src/theme.ts, src/App.tsx...\n8. Current work: wiring the toggle to the header button.\n\nFor exact detail from before compaction, read ~/.claude/projects/.../session.jsonl",
              },
              {
                role: "user",
                content: "Continue from where you left off without asking any further questions.",
              },
              "[the most recent turns, and up to 5 recently read files, kept verbatim]",
            ],
          },
          annotations: [
            {
              path: ["messages", 0, "content"],
              title: "Lossy by design",
              note: "One message standing in for hours of work, written by the model — so what's in it is a judgement call. Restate a hard constraint rather than trusting it to survive.",
            },
            {
              path: ["messages", 1],
              title: "Carry on",
              note: "Added so the model resumes the task instead of greeting you with a summary of the summary you can already see.",
            },
            {
              path: ["messages", 2],
              title: "The fresh end, untouched",
              note: "Only the older part is summarised. The turns you're in the middle of come through as they were, which is most of why compaction doesn't feel like starting over.",
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
        id: "prefix",
        title: "The cache works on prefixes",
        body: [
          "The API can keep the processed form of a request's opening stretch and reuse it, as long as the next request begins with exactly the same bytes. cache_control marks where that stretch ends — up to four points per request.",
          "Claude Code puts them where the stability is: the system prompt, which doesn't change mid-session, and the newest message, which moves forward every turn. The prefix is built tools, then system, then messages, so a change high up costs everything below it.",
        ],
        payload: {
          label: "request.json",
          data: {
            tools: "[14 tool schemas]",
            system: [
              {
                type: "text",
                text: "You are Claude Code, Anthropic's official CLI for Claude...",
                cache_control: { type: "ephemeral", ttl: "1h" },
              },
            ],
            messages: [
              "[every turn so far, tool calls and results included]",
              {
                role: "user",
                content: "can you add a light-mode fallback too?",
                cache_control: { type: "ephemeral", ttl: "1h" },
              },
            ],
          },
          annotations: [
            {
              path: ["system", 0, "cache_control"],
              title: "The stable end",
              note: 'A breakpoint goes on the last block identical to last time. Claude Code asks for "1h" rather than the default five minutes, because sessions have coffee breaks in them.',
            },
            {
              path: ["messages", 0],
              title: "Along for the ride",
              note: "Everything between the two breakpoints is covered by the later one. The entire conversation is cached without being marked, simply by sitting in front of the mark.",
            },
            {
              path: ["messages", 1, "cache_control"],
              title: "The point that moves",
              note: "The second breakpoint rides on the newest message, so each turn writes a slightly longer prefix and finds the previous one by looking back a few blocks.",
            },
          ],
        },
      },
      {
        id: "hit",
        title: "A hit, in three numbers",
        body: [
          "When the prefix matches, the reply says so. Two consecutive turns of the same session: the read is what was already processed, the write is what this turn added and stored for next time.",
          "Reading an entry also resets its clock, so a loop that keeps moving stays warm on its own. Leave it alone past the hour and the next request is a cold start.",
        ],
        payload: {
          label: "usage.json",
          data: {
            turn_11: {
              input_tokens: 4,
              cache_read_input_tokens: 128412,
              cache_creation_input_tokens: 1086,
              output_tokens: 240,
            },
            turn_12: {
              input_tokens: 4,
              cache_read_input_tokens: 129498,
              cache_creation_input_tokens: 892,
              output_tokens: 156,
            },
          },
          annotations: [
            {
              path: ["turn_12", "input_tokens"],
              title: "Four tokens",
              note: "input_tokens only counts what sits after the final breakpoint, not the size of the request. Add the three input figures and this turn processed 130,394.",
            },
            {
              path: ["turn_12", "cache_read_input_tokens"],
              title: "Last turn's write is this turn's read",
              note: "129,498 is the turn before it, 128,412, plus the 1,086 it wrote. The prefix grows by exactly what the previous pass added, and comes back at a tenth the price of fresh input.",
            },
            {
              path: ["turn_12", "cache_creation_input_tokens"],
              title: "The only part at full price",
              note: "892 tokens — your message and the model's last reply — processed properly and stored. A write on the hour-long cache costs twice plain input; the read it becomes next turn costs a tenth.",
            },
          ],
        },
      },
      {
        id: "miss",
        title: "Edit something early and the rest is gone",
        body: [
          "The cache is keyed on the exact bytes of the prefix, so an edit doesn't cost you the block you touched — it costs everything after it, which is now a different prefix. One changed tool schema invalidates the tools, the system prompt and every message behind them.",
          "That isn't a metaphor for how this page's expanded sections behave. It's the same rule. If you've been opening and closing them on the way here, you've already paid for a few of these.",
        ],
        payload: {
          label: "usage.json",
          data: {
            turn_13: {
              input_tokens: 4,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 131182,
              output_tokens: 210,
            },
          },
          annotations: [
            {
              path: ["turn_13", "input_tokens"],
              title: "Still four",
              note: "Unchanged, because the part after the breakpoint was never the expensive bit. Everything in front of it was.",
            },
            {
              path: ["turn_13", "cache_read_input_tokens"],
              title: "Nothing reused",
              note: "Zero, one turn after reading 129,498. The conversation didn't change — a schema in front of it did, and the prefix stopped matching from there on.",
            },
            {
              path: ["turn_13", "cache_creation_input_tokens"],
              title: "Paid for, and cached again",
              note: "131,182 tokens reprocessed from scratch and written back at a premium: an order of magnitude dearer than the otherwise identical turn before it.",
            },
          ],
        },
      },
    ],
  },
];
