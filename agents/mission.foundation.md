# Mission — Agent Foundation & Global Principles

## Purpose
This file defines the foundational operating principles that **all** agent missions must inherit and follow. It establishes the shared runtime, workflow patterns, and safety standards for autonomous development at scale.

## Core Principles

### 1. Branching Strategy
- **Always** create a new branch for feature work or bug fixes.
- Branch naming conventions:
  - `feature/<feature-slug>` — New features or enhancements
  - `fix/<issue-slug>` — Bug fixes
  - `test/<test-scope>` — Test improvements
  - `docs/<doc-update>` — Documentation updates
- Never work directly on `main` or `master` unless explicitly authorized.

### 2. Test-First Development
- **Before any commit**: Run `bash scripts/run-full-tests.sh`
- Commit **only** when all tests pass.
- If tests fail:
  1. Document the failure in the appropriate log file
  2. Fix the failing tests
  3. Rerun verification
  4. Only proceed when green
- Test hierarchy:
  - Unit tests → Integration tests → E2E tests
  - Fix failures at the lowest level first

### 3. Commit Standards
All commits must follow conventional commit format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `test` — Test additions or fixes
- `docs` — Documentation updates
- `refactor` — Code refactoring
- `chore` — Maintenance tasks
- `perf` — Performance improvements
- `ci` — CI/CD changes

**Examples:**
- `feat(onboarding): add Stripe Connect account link flow`
- `fix(auth): resolve session persistence issue`
- `test(api): add webhook signature verification tests`

### 4. Verification Checklist
Before completing any mission task:

- [ ] All tests pass locally (`bash scripts/run-full-tests.sh`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Linter passes (`pnpm lint`)
- [ ] No TypeScript errors
- [ ] No hardcoded secrets or API keys
- [ ] Environment variables properly referenced as `process.env.*`
- [ ] Relevant log files updated
- [ ] Changes committed with proper message format

### 5. Deployment Workflow
1. **Local Verification**: Tests + build pass
2. **Commit**: With conventional commit message
3. **Push**: To feature branch
4. **Deploy Check**: Monitor Vercel deployment
5. **Health Check**: Verify deployment reaches `READY` state
6. **Log Update**: Append deployment info to `/logs/build-progress.md`
7. **PR Creation**: If applicable, create PR with:
   - Clear description
   - Test results
   - Deployment URL
   - Screenshots (if UI changes)

### 6. Logging Standards
All mission progress must be logged to the appropriate file:

| Activity | Log File |
| --- | --- |
| Feature development | `/logs/feature-progress.md` |
| Build/deployment | `/logs/build-progress.md` |
| Build patches | `/logs/build-patches.md` |
| Onboarding work | `/logs/onboarding-progress.md` |
| Authentication | `/logs/auth-progress.md` |
| Email functionality | `/logs/email-progress.md` |
| Agent operations | `/logs/agent-foundation.md` |
| Test output | `/logs/test-output.log` |

**Log Entry Format:**
```markdown
## [YYYY-MM-DD HH:MM] <Activity>
**Status:** [IN_PROGRESS | COMPLETE | BLOCKED]
**Changes:**
- Item 1
- Item 2

**Verification:**
- Test results: PASS/FAIL
- Build: SUCCESS/FAILURE

**Next Steps:**
- Action item 1
```

### 7. Security & Secrets Management
**CRITICAL RULES:**

- ❌ **NEVER** hardcode API keys, secrets, or credentials
- ❌ **NEVER** commit `.env`, `.env.local`, or similar files
- ❌ **NEVER** use fallback values with real secrets
- ✅ **ALWAYS** reference `process.env.VARIABLE_NAME`
- ✅ **ALWAYS** document required env vars in code comments
- ✅ **ALWAYS** verify `.gitignore` excludes sensitive files

**Patterns to watch for:**
- `sk_` (Stripe secret keys)
- `pk_` (Stripe public keys)
- `whsec_` (Stripe webhook secrets)
- `re_` (Resend API keys)
- `postgresql://` (Database URLs with credentials)

### 8. Error Handling Protocol
When encountering errors:

1. **Capture**: Log the full error message and stack trace
2. **Categorize**: Identify error type (env, import, schema, TS, runtime, etc.)
3. **Pinpoint**: Locate responsible files/functions
4. **Fix**: Apply minimal, targeted patches
5. **Verify**: Rerun tests and builds
6. **Document**: Update relevant log with resolution
7. **Iterate**: If fix fails, document attempt and try alternative approach

### 9. Autonomous Decision Making
Agents should:

- ✅ Make informed decisions based on existing patterns
- ✅ Follow established architecture from `/docs/architecture.md`
- ✅ Prefer minimal, reviewable changes
- ✅ Search existing code before introducing new patterns
- ✅ Present 2-3 options with trade-offs when uncertain
- ❌ Avoid large refactors without explicit authorization
- ❌ Never introduce breaking changes without approval
- ❌ Don't skip verification steps

### 10. Mission Lifecycle
Every mission follows this lifecycle:

```
1. ACTIVATE
   ↓
2. LOAD CONTEXT (docs, logs, recent changes)
   ↓
3. PLAN (break into tasks with acceptance criteria)
   ↓
4. IMPLEMENT (iteratively, keeping diffs reviewable)
   ↓
5. VERIFY (tests, builds, manual checks)
   ↓
6. DOCUMENT (update logs with outcomes)
   ↓
7. DELIVER (commit, push, deploy)
   ↓
8. EXIT (when criteria met) or ITERATE (if verification fails)
```

## Integration with Specialized Missions

All specialized missions (`mission.*.md`) must:

1. **Reference this file** in their prerequisites section
2. **Follow** all commit, test, and logging standards
3. **Inherit** security and error handling protocols
4. **Use** the same verification checklist
5. **Maintain** the same quality bar

## Operating Commands Reference

### Essential Commands (Auto-Approved)
```bash
# Testing
bash scripts/run-full-tests.sh
pnpm test
pnpm --filter web vitest
pnpm --filter web playwright test

# Building
pnpm build

# Deployment
vercel --prod --confirm
vercel logs

# Git Operations
git status
git log
git checkout -b <branch-name>
git add .
git commit -m "<message>"
git push origin <branch-name>
```

### Command Safety Rules
- Never use `--force` flags without explicit authorization
- Always include `--confirm` with production deployments
- Redirect long-running command output to log files
- Use `git stash` before branch switches if work is uncommitted

## Extension Guidelines

When creating new missions:

1. **File Naming**: Use `mission.<topic>.md` format
2. **Structure**: Follow standard sections (Trigger → Objective → Prerequisites → Operating Loop → Verification → Exit → Safety)
3. **Update Router**: Add entry to `/agents/README.md`
4. **Update Orchestrator**: Add trigger to `/agents/dev-assistant.md`
5. **Create Log**: Ensure corresponding log file exists in `/logs/`
6. **Document Commands**: Add any new commands to `.cursor/rules.json` if auto-approval needed
7. **Keep Linear**: Avoid branching logic; create separate missions for different paths

## Success Metrics

A well-functioning agent foundation delivers:

- ✅ Zero secrets leaked to version control
- ✅ >95% test pass rate on first attempt
- ✅ Consistent commit message format
- ✅ Complete audit trail in log files
- ✅ Successful deployments without manual intervention
- ✅ Clear escalation paths when automation hits limits
- ✅ Minimal context required to resume work after interruption

## Emergency Protocols

### If Tests Hang (>5 minutes)
1. Terminate process safely (Ctrl+C)
2. Log `[TIMEOUT DETECTED]` in relevant log file
3. Investigate hanging test (check for infinite loops, missing mocks)
4. Apply fix
5. Restart verification via `bash scripts/run-full-tests.sh`

### If Three Consecutive Builds Fail
1. STOP and summarize all attempts
2. Document failure patterns in `/logs/build-patches.md`
3. Switch to `mission.build-fix.md`
4. Do not proceed with feature work until resolved

### If Deployment Fails
1. Capture error from `vercel logs`
2. Record in `/logs/build-progress.md`
3. Categorize issue (env var, runtime error, build failure)
4. Fix locally first, then redeploy
5. Verify with health check

### If Uncertain About Next Step
1. Present 2-3 actionable options with trade-offs
2. Default to the most conservative, reversible option
3. Document decision rationale in log
4. Request human input if stakes are high (data loss, security, breaking changes)

## Version
**Foundation Version:** 1.0  
**Last Updated:** 2025-11-11  
**Compatibility:** All missions v1.0+

---

**Remember:** This foundation exists to enable autonomous, high-quality development at scale. When in doubt, refer back to these principles. They are the shared language all agents speak.

