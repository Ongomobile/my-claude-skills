# Fable Goal Prompt Writer

Ramble your idea out loud, get back one exceptional `/goal` prompt you can paste straight into a fresh Fable session.

This skill doesn't build the thing. It designs the prompt that builds the thing. The philosophy is simple: **get out of the model's way.** A great `/goal` prompt nails *what* you want, hands the model its tools, grants real creative freedom on the *how*, and demands the model verify its own work before calling anything done.

## Install

1. Copy the `fable-goal` folder into your Claude Code skills directory:
   ```bash
   cp -r fable-goal ~/.claude/skills/
   ```
2. Restart Claude Code (or start a new session).
3. Invoke it by typing `/fable-goal`.

## How to use

Type `/fable-goal` and then describe what you want, however messy. The skill pulls out the deliverable, fills small gaps with sensible defaults, asks a question only when the answer would actually change the prompt, and hands you a finished `/goal` prompt in a copy-ready block with a short list of the assumptions it made.

Paste that prompt into a fresh Fable session and let it run.
