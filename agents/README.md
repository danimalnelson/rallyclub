# Agent Operating Manual

## Overview
- `mission.md` defines the current product phase.
- `dev-assistant.md` orchestrates day-to-day execution.
- Specialized missions (`mission.*.md`) cover focused recovery or feature work.
- `diagnostic.md` provides rapid triage steps for critical failures.

## Activation Flow
1. Load `dev-assistant.md`.
2. Follow its boot sequence to select the correct mission.
3. Execute the mission loop until the exit criteria are met.
4. Return to `dev-assistant.md` to select the next mission or await instructions.

## Escalation Map
| Trigger | Switch To | Notes |
| --- | --- | --- |
| Build or deploy failure | `mission.build-fix.md` | Stop once Vercel + local builds pass. |
| Onboarding UX or data gaps | `mission.onboarding.md` | Guides end-to-end onboarding buildout. |
| Onboarding regression tests failing | `mission.onboarding.tests.md` | Keeps Stripe Connect + flows healthy. |
| Authentication outage | `mission.auth.md` | Uses `diagnostic.md` for deeper triage. |
| Email delivery issues | `mission.email.md` | Focuses on Resend + transactional messaging. |
| Stable platform, ready for roadmap work | `mission.features.md` | Runs the feature expansion sprint. |

## Operating Standards
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

