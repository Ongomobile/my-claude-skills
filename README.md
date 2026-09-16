# my-claude-skills

My portable Claude Code setup: skills, slash commands, and output style.

## What is in here

| Folder | Goes to | What it is |
|---|---|---|
| `skills/` | `~/.claude/skills` | 14 skills |
| `commands/` | `~/.claude/commands` | slash commands |
| `output-styles/` | `~/.claude/output-styles` | the ELI5 style |

## Set up on a new Mac

Clone it, then link the three folders into `~/.claude`.

```bash
git clone https://github.com/Ongomobile/my-claude-skills.git ~/my-claude-skills
```

```bash
cd ~/.claude && for d in skills commands output-styles; do [ -e "$d" ] && mv "$d" "$d.bak-$(date +%s)"; ln -s ~/my-claude-skills/"$d" "$d"; done
```

Restart Claude Code. Run `/skills` to confirm they loaded.

## Keep both machines in sync

Pull the latest:

```bash
git -C ~/my-claude-skills pull
```

Push a change you made:

```bash
git -C ~/my-claude-skills add -A && git -C ~/my-claude-skills commit -m "update skills" && git -C ~/my-claude-skills push
```

Because `~/.claude/skills` is a link into this repo, editing a skill edits the repo. No copying needed.

## Using these in Claude Code on the web / cloud

A cloud session does not read `~/.claude`. It reads your project repo. So for the cloud, copy the skills you need into the project instead:

```bash
mkdir -p .claude/skills && cp -R ~/my-claude-skills/skills/<skill-name> .claude/skills/
```

Then commit them with the project.

## Not included

Plugin skills (small-business, marketing, design, pdf-viewer, and so on) are not files in here. Re-add those with `/plugin` on each machine.
