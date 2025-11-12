# Agent Operating Manual

## Overview
- `mission.foundation.md` defines global operating principles that **all** missions inherit.
- `dev-assistant.md` orchestrates day-to-day execution.
- Specialized missions (`mission.*.md`) provide focused workflows for specific scenarios.
- `diagnostic.md` provides rapid triage steps for critical failures.
- `mission.readiness.md` conducts comprehensive codebase health audits.

## Activation Flow
1. Load `dev-assistant.md`.
2. Follow its boot sequence to select the correct mission.
3. Execute the mission loop until the exit criteria are met.
4. Return to `dev-assistant.md` to select the next mission or await instructions.

## Mission Router
| Trigger | Switch To | Notes |
| --- | --- | --- |
| **Always active** | `mission.foundation.md` | **Required.** Global rules for all missions. |
| Codebase health check needed | `mission.readiness.md` | Comprehensive stability and readiness audit. |
| Build or deploy failure | `mission.build-fix.md` | Continue until local + Vercel builds succeed. |
| Critical failures requiring triage | `diagnostic.md` | Rapid debugging and root cause analysis. |
| PR creation and merge workflow | `mission.pr-automation.md` | Automate PR lifecycle from creation to production. |
| Routine maintenance tasks | `mission.maintenance.md` | Dependencies, tests, cleanup, optimization, docs. |

## Operating Standards
**All missions must follow `/agents/mission.foundation.md`** which defines:
- Branching strategy (always create feature branches)
- Test-first development (run tests before every commit)
- Commit standards (conventional commit format)
- Verification checklist (tests + builds + linters pass)
- Deployment workflow (local → commit → push → deploy → verify)
- Logging standards (document all progress)
- Security rules (never hardcode secrets)
- Error handling protocol

Additional standards:
- Always run the relevant verification suite before moving on.
- Keep `/logs/*.md` up to date with timestamps and outcomes.
- Never hardcode secrets; follow the repository secret management rules.
- Prefer small, reviewable diffs and explicit commit messages.

## Extending the System
- Follow the standard section order: **Trigger → Objective → Prerequisites → Operating Loop → Verification → Exit → Safety**.
- Name files `mission.<topic>.md` and place supporting triage docs alongside them.
- Update this README router table and `dev-assistant.md` whenever a mission is added or retired.
- Create or reuse a log in `/logs/*.md` so every mission has a persistence trail.
- Document any new commands that need auto-approval in `.cursor/rules.json`.
- Keep instructions linear; avoid branching logic inside a single mission.

