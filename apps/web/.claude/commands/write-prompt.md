# /project:write-prompt — Generate Install Prompt

Generate an install prompt for a build step without executing it.

**Input:** `$ARGUMENTS` (e.g., `D6`, `E3`, `F1.2`)

---

## Step 1: Launch Prompt Writer

Launch the **install-prompt-writer** agent (opus):

> "Write the install prompt for phase **$ARGUMENTS**. Read all relevant canonical specs
> from `C:\Users\XPS-15\Projects\Twicely\read-me\`, the schema doc, page registry,
> feature lock-in, build sequence tracker, and decision rationale. Output the full
> structured install prompt including:
> - Header (phase, feature name, summary)
> - Canonical sources referenced
> - Pre-implementation reads
> - File Approval List
> - Step-by-step implementation instructions
> - Verification criteria
> - Parallel Streams section (if the feature can be decomposed)"

---

## Step 2: Present the Prompt

Show the full install prompt output.

Then say: "To execute this prompt, run `/project:build $ARGUMENTS`.
To review the prompt first, read through the File Approval List and verify
the spec references are correct."
