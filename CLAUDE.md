# Claude Code session guide

This project uses AI-OS v9 for delivery governance. The full constitution is in `AGENTS.md`.

Before starting any work:

1. Read `AGENTS.md` — the delivery constitution
2. Read `.ai-os/MISSION.md` — shared host-project context and lane topology
3. Read the relevant lane `STATE.md` — default is `.ai-os/lanes/default/STATE.md`
4. Read the relevant lane `MISSION.md` — default is `.ai-os/lanes/default/MISSION.md`

Key rules summarized:

- Do not write business code before user-confirmed mission and design
- Follow the behavior rules in `AGENTS.md` for task routing (new project / change / debug / verify / ship)
- Provide project-native static-check evidence for verification (not just ReadLints)
- Stop at confirmation points and wait for explicit user approval
- This repo has multiple lanes; do not assume `default` if the user request clearly maps to another lane
