# Mission — Codebase Readiness & Health Audit

## Trigger
- Activate before major deployments or releases.
- Use periodically (quarterly) to assess codebase health.
- Invoke when returning to codebase after extended absence.
- Run when onboarding new developers or agents.

## Objective
Perform comprehensive health checks of the repository to ensure it is stable, consistent, and ready for development or deployment. Produce actionable reports identifying issues and required setup.

## Prerequisites
**Foundation:** Must follow all rules in `/agents/mission.foundation.md`.

- Repository access with read permissions
- Ability to run build and test commands
- Access to check environment configuration status

## Audit Scope

### 1. Repository Structure
- Verify package.json and dependency integrity
- Check for missing or conflicting dependencies
- Validate monorepo workspace configuration
- Confirm lock file is up to date

### 2. Build System
- Execute full production build
- Check for TypeScript errors
- Verify all packages compile successfully
- Validate Next.js configuration
- Check bundle sizes and optimization

### 3. Database Schema
- Validate Prisma schema syntax
- Check for missing migrations
- Verify database connection (if available)
- Review model relationships and constraints
- Check for missing indexes on frequently queried fields

### 4. Test Infrastructure
- Verify test configuration (Vitest, Playwright)
- Check test file organization
- Attempt test execution (report env requirements)
- Review test coverage scope
- Identify missing critical path tests

### 5. Integration Health
- Verify Stripe integration setup
- Check Resend email configuration
- Validate NextAuth configuration
- Review API key patterns (ensure no hardcoding)
- Check external service client initialization

### 6. Git Hygiene
- Review .gitignore completeness
- Check for uncommitted changes
- Verify branch naming conventions
- Scan for accidentally committed secrets
- Review commit message patterns

### 7. Security Posture
- Scan for hardcoded secrets or API keys
- Verify environment variable usage
- Check .env file patterns in .gitignore
- Review dependency vulnerabilities (`pnpm audit`)
- Validate authentication implementation

### 8. Autonomous Development Readiness
- Verify agent foundation files present
- Check script execution permissions
- Validate log directory structure
- Review .cursor/rules.json configuration
- Ensure mission files reference foundation

## Operating Loop

### Phase 1: Quick Health Check
1. **Dependencies**: `pnpm install`
2. **Build**: `pnpm build`
3. **Lint**: `pnpm lint`
4. **Type Check**: `pnpm tsc --noEmit` (if available)

### Phase 2: Database Validation
1. **Schema Check**: `pnpm --filter db prisma validate`
2. **Migration Status**: Check for migrations folder
3. **Connection**: Attempt connection if DATABASE_URL available
4. Document requirements if environment not configured

### Phase 3: Test Assessment
1. **Discover Tests**: List all test files
2. **Configuration**: Verify test configs exist
3. **Attempt Execution**: Run tests if environment allows
4. **Document Requirements**: Note missing env vars blocking tests

### Phase 4: Security Scan
1. **Secret Patterns**: Search for `sk_`, `pk_`, `whsec_`, `re_`, `postgresql://`
2. **Environment Files**: Verify .env* files are gitignored
3. **Dependency Audit**: Run `pnpm audit`
4. **Gitignore Review**: Check coverage of sensitive patterns

### Phase 5: Agent Ecosystem Check
1. **Foundation Present**: Verify `/agents/mission.foundation.md` exists
2. **Orchestrator**: Check `/agents/dev-assistant.md` references foundation
3. **Scripts**: Verify execution permissions on `/scripts/*`
4. **Logs**: Ensure `/logs/` directory exists and is writable
5. **Cursor Config**: Validate `.cursor/rules.json` lists core agents

### Phase 6: Report Generation
1. **Compile Findings**: Organize by severity (blocker, warning, info)
2. **Generate Report**: Create `/logs/readiness-report.md`
3. **Prioritize Actions**: Rank recommendations by urgency
4. **Document Setup**: List required environment variables
5. **Provide Next Steps**: Clear instructions for resolution

## Report Structure

```markdown
# Codebase Readiness Report

**Date:** [timestamp]
**Status:** [READY / SETUP REQUIRED / ISSUES FOUND]

## Executive Summary
- Overall assessment
- Readiness score (0-100)
- Critical blockers (if any)

## Detailed Results

### ✅ Passed Checks
- [List all successful validations]

### ⚠️ Warnings
- [Non-blocking issues with recommendations]

### ❌ Blockers
- [Critical issues preventing development]

## Required Setup
- [Step-by-step setup instructions]
- [Environment variable reference]

## Recommendations
### High Priority
- [Urgent fixes]

### Medium Priority
- [Important improvements]

### Low Priority
- [Nice-to-have enhancements]

## Next Steps
- [Immediate actions needed]
- [Verification commands]

---
> Readiness verification complete. Repository is [status].
```

## Verification Checklist

- [ ] All dependencies installed without errors
- [ ] Production build succeeds
- [ ] No TypeScript compilation errors
- [ ] Prisma schema valid
- [ ] Test infrastructure configured
- [ ] No hardcoded secrets found
- [ ] .gitignore covers sensitive files
- [ ] Agent foundation files present
- [ ] Scripts have execution permissions
- [ ] Report generated with actionable recommendations

## Exit Criteria
- Comprehensive readiness report created in `/logs/readiness-report.md`
- All audits completed (even if some areas require setup)
- Clear recommendations provided for any issues
- Environment requirements documented
- Ready to return to `dev-assistant.md` for next mission

## Safety
- **Never expose actual secret values** in reports
- **Don't attempt destructive operations** during audits
- **Document, don't fix** - provide recommendations only
- **Handle missing env vars gracefully** - report requirements, don't fail
- If audits take >10 minutes, provide interim report and continue
- Store detailed logs separately from summary report

## Common Findings & Solutions

### Missing Environment Variables
**Finding:** Tests/builds fail due to missing env vars  
**Solution:** Create `.env.local` with required variables  
**Document:** List all required vars with descriptions

### Outdated Dependencies
**Finding:** `pnpm outdated` shows available updates  
**Solution:** Review changelog, test updates incrementally  
**Refer to:** `/agents/mission.maintenance.md` for update procedures

### Test Failures
**Finding:** Some tests failing  
**Solution:** Categorize failures (env, logic, flaky)  
**Refer to:** `/agents/mission.maintenance.md` for test fixes

### Build Warnings
**Finding:** Build succeeds but with warnings  
**Solution:** Review and address warnings incrementally  
**Priority:** Medium (doesn't block development)

### Missing Migrations
**Finding:** Prisma schema exists but no migrations  
**Solution:** Run `prisma migrate dev` or `prisma db push`  
**Document:** Migration status in report

## Integration with Foundation
This mission inherits all standards from `/agents/mission.foundation.md`:
- Documentation requirements
- Logging standards
- Security protocols
- Error handling
- Autonomous decision-making guidelines

## Automation Opportunities

### Pre-Deployment Checklist
Run this mission before every production deployment to catch issues early.

### Onboarding Workflow
Use this mission when onboarding new team members to verify their local setup.

### Quarterly Health Checks
Schedule regular audits to maintain codebase quality and catch drift.

### Post-Update Validation
Run after major dependency updates or framework upgrades.

---

**Remember:** Readiness audits are about **visibility and planning**, not immediate fixing. Provide clear, actionable reports that enable informed decision-making.

