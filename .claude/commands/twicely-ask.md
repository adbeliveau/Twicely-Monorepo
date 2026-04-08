# /twicely-ask — Ask a Twicely Domain Expert

Route a question to one or more Twicely domain expert agents. Each expert reads
its own canonicals before answering and cites every claim it makes.

**Input:** `$ARGUMENTS`

| Argument form | Behavior |
|---|---|
| `<domain> <question>` | Ask one expert. E.g. `/twicely-ask hub-finance where does the goal tracker store its data?` |
| `all <question>` | Fan out to all 18 experts in parallel. Useful for cross-cutting questions. |
| `layer mk <question>` | Fan out to all marketplace experts. |
| `layer hub <question>` | Fan out to all hub experts. |
| `layer engine <question>` | Fan out to all engine experts. |
| `list` | List every domain id with its title and one-line summary. |
| _(empty)_ | Print this help. |

---

## Step 0 — Read the registry

Before doing anything, read `.claude/twicely-agents.yaml`. It is the source
of truth for which domains exist, what they own, and how they hand off.

---

## Step 1 — Parse $ARGUMENTS

- If empty → print help and exit.
- If first token is `list` → print every domain id, title, layer, and summary
  from the registry. Exit.
- If first token is `all` → set targets = every `domains[].id` in the registry.
  The remainder of $ARGUMENTS is the question.
- If first token is `layer` and second token is `mk|hub|engine` → set targets
  = every `domains[].id` whose `layer` matches. Question = remaining tokens.
- Otherwise → first token is the domain id. Question = remaining tokens.
  Verify the id exists in the registry. If not, suggest the closest match
  and exit.

---

## Step 2 — Dispatch

For each target domain id, launch the corresponding expert agent via the
Agent tool with `subagent_type=twicely-<id>`. Pass the question verbatim.

**Parallel rule:** if there is more than one target, launch ALL of them in a
single message with multiple `Agent` tool calls. Do NOT launch them
sequentially.

**Cost guardrail:** before launching `all` (18 parallel opus invocations),
warn the user with: "This will invoke 18 opus agents in parallel. Confirm?"
unless `$ARGUMENTS` contains `--yes`.

---

## Step 3 — Collect and synthesize

For a single target: forward the agent's answer verbatim to the user.

For multiple targets:

1. Print each agent's answer under a header `## twicely-<id>`.
2. After all answers, print a `## Synthesis` section that:
   - Notes any agreement across agents.
   - Notes any contradictions (most useful for cross-cutting questions).
   - Lists out-of-scope handoffs that were declared by each agent.
3. If any agent reported file/canonical drift in its Step 0 spot-check,
   surface those at the top of the synthesis as `## ⚠ Drift detected`.

---

## Step 4 — Never invent

This command is a router. It does not answer questions itself. If no expert
exists for the requested topic, say so explicitly and suggest the closest
domain id from the registry. Do not make up an answer.

---

## Examples

```
/twicely-ask hub-finance what schema tables does the financial center own?
→ launches twicely-hub-finance, returns its answer with citations

/twicely-ask all what's the policy on integer cents for money?
→ fans out to all 18 experts; synthesis notes the universal CLAUDE.md rule

/twicely-ask layer hub which agents own subscription tier UI?
→ launches all hub experts in parallel; synthesis shows hub-subscriptions owns it

/twicely-ask list
→ prints all 18 domain ids with their layer and summary
```
