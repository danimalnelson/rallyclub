# Mission — Routine Maintenance

## Trigger
- Activate for scheduled maintenance windows or when technical debt accumulates.
- Use for dependency updates, code cleanup, performance optimization, and preventive maintenance.
- Switch here when platform is stable and no critical features are pending.

## Objective
Keep the codebase healthy, dependencies up to date, and technical debt under control through systematic maintenance and optimization.

## Prerequisites
**Foundation:** Must follow all rules in `/agents/mission.foundation.md`.

- Platform stable with no critical bugs.
- All tests passing.
- Recent backup of production database (if making schema changes).
- Maintenance window scheduled (if production impact expected).

## Maintenance Categories

### 1. Dependency Updates

#### Regular Updates (Monthly)
Keep dependencies current to get security fixes and improvements.

**Process:**
1. **Check for updates**:
   ```bash
   pnpm outdated
   ```

2. **Review changelog** for breaking changes:
   - Major version updates: Check migration guides
   - Minor updates: Usually safe, review notes
   - Patch updates: Generally safe

3. **Update strategy**:
   ```bash
   # Update patch versions (safest)
   pnpm update
   
   # Update minor versions
   pnpm update --latest
   
   # Update specific package
   pnpm update <package-name>
   ```

4. **Test thoroughly**:
   ```bash
   bash scripts/run-full-tests.sh
   pnpm build
   ```

5. **Create branch**: `git checkout -b chore/dependency-updates-YYYY-MM`

6. **Commit**: `chore(deps): update dependencies to latest versions`

#### Security Updates (Immediate)
When security vulnerabilities detected:

1. **Check for vulnerabilities**:
   ```bash
   pnpm audit
   ```

2. **Fix automatically**:
   ```bash
   pnpm audit fix
   ```

3. **Manual fixes** for complex issues:
   ```bash
   pnpm update <vulnerable-package>@<safe-version>
   ```

4. **Verify fix**:
   ```bash
   pnpm audit
   # Should show 0 vulnerabilities
   ```

5. **Test immediately**:
   ```bash
   bash scripts/run-full-tests.sh
   ```

6. **Commit with priority**: `fix(security): update <package> to patch CVE-XXXX`

#### Prisma Updates
Special care for database-related updates:

1. **Update Prisma**:
   ```bash
   pnpm --filter db update @prisma/client prisma
   ```

2. **Regenerate client**:
   ```bash
   pnpm --filter db prisma generate
   ```

3. **Test migrations**:
   ```bash
   pnpm --filter db prisma migrate diff
   ```

4. **Verify schema**:
   ```bash
   pnpm --filter db prisma validate
   ```

### 2. Code Cleanup

#### Remove Dead Code
1. **Identify unused exports**:
   ```bash
   # Use TypeScript unused exports check
   pnpm tsc --noUnusedLocals --noUnusedParameters
   ```

2. **Find unused files**:
   - Check git history for files not modified in 6+ months
   - Verify they're not imported anywhere
   - Remove safely with tests to verify

3. **Clean up commented code**:
   ```bash
   # Find excessive comments
   grep -r "// " --include="*.ts" --include="*.tsx" | wc -l
   ```

4. **Remove console.logs**:
   ```bash
   # Find all console statements
   grep -r "console\." --include="*.ts" --include="*.tsx"
   ```

#### Refactor Duplicated Code
1. **Identify duplication**:
   - Look for similar functions across files
   - Find repeated patterns
   - Note copy-pasted code blocks

2. **Extract to shared utilities**:
   - Move to `/packages/lib/` for shared functions
   - Create reusable components for UI patterns
   - Document in `/docs/architecture.md`

3. **Update imports**:
   - Replace duplicated code with imports
   - Test each replacement

4. **Verify no regressions**:
   ```bash
   bash scripts/run-full-tests.sh
   ```

#### Improve Type Safety
1. **Replace `any` types**:
   ```bash
   # Find all 'any' usage
   grep -r ": any" --include="*.ts" --include="*.tsx"
   ```

2. **Add missing types**:
   - Function return types
   - Component prop types
   - API request/response types

3. **Strengthen validation**:
   - Add Zod schemas for API inputs
   - Validate environment variables at startup
   - Add runtime type guards

### 3. Performance Optimization

#### Database Optimization
1. **Review slow queries**:
   - Check Prisma query logs
   - Identify N+1 query problems
   - Add missing indexes

2. **Optimize queries**:
   ```typescript
   // Before: N+1 query
   const businesses = await prisma.business.findMany()
   for (const b of businesses) {
     b.plans = await prisma.plan.findMany({ where: { businessId: b.id } })
   }
   
   // After: Single query with include
   const businesses = await prisma.business.findMany({
     include: { plans: true }
   })
   ```

3. **Add indexes**:
   ```prisma
   model Business {
     slug String @unique
     @@index([slug])
   }
   ```

#### Frontend Optimization
1. **Optimize bundle size**:
   ```bash
   pnpm build
   pnpm --filter web analyze # If bundle analyzer configured
   ```

2. **Add lazy loading**:
   ```typescript
   const HeavyComponent = lazy(() => import('./HeavyComponent'))
   ```

3. **Optimize images**:
   - Use Next.js Image component
   - Add proper width/height
   - Use WebP format

4. **Add caching**:
   - Cache API responses
   - Use React Query or SWR
   - Add HTTP cache headers

#### API Optimization
1. **Add rate limiting**:
   - Protect expensive endpoints
   - Prevent abuse

2. **Implement caching**:
   - Cache computed values
   - Use Redis for session data
   - Add edge caching

3. **Optimize payload size**:
   - Return only needed fields
   - Use pagination
   - Compress responses

### 4. Documentation Updates

#### Keep Documentation Current
1. **Review and update**:
   - `/README.md` - Installation, setup
   - `/docs/architecture.md` - System design
   - `/docs/api.md` - API endpoints
   - `/docs/deploy.md` - Deployment process

2. **Add missing docs**:
   - New features
   - Configuration options
   - Troubleshooting guides

3. **Fix outdated info**:
   - Remove deprecated features
   - Update command examples
   - Refresh screenshots

#### Code Documentation
1. **Add JSDoc comments**:
   ```typescript
   /**
    * Creates a new business with Stripe Connect account
    * @param data - Business creation data
    * @returns Created business with Stripe account ID
    * @throws {Error} If Stripe account creation fails
    */
   export async function createBusiness(data: BusinessData) { ... }
   ```

2. **Document complex logic**:
   - Add inline comments for non-obvious code
   - Explain "why" not just "what"
   - Link to relevant documentation

3. **Update README files**:
   - Package READMEs in `/packages/`
   - Feature READMEs in `/docs/features/`

### 5. Test Maintenance

#### Improve Test Coverage
1. **Identify gaps**:
   ```bash
   pnpm --filter web vitest run --coverage
   ```

2. **Add missing tests**:
   - Uncovered branches
   - Edge cases
   - Error paths

#### Fix Flaky Tests
1. **Identify flaky tests**:
   - Run suite multiple times
   - Note intermittent failures

2. **Debug root cause**:
   - Race conditions
   - Timing issues
   - Shared state

3. **Apply fixes**:
   - Add proper waits
   - Improve test isolation
   - Use deterministic data

### 6. Environment & Infrastructure

#### Clean Up Environments
1. **Review environment variables**:
   - Remove unused variables
   - Document required variables
   - Update `.env.example`

2. **Clean up deployments**:
   ```bash
   vercel ls
   vercel rm <old-deployment>
   ```

3. **Review Vercel settings**:
   - Environment variables
   - Build settings
   - Domain configuration

#### Database Maintenance
1. **Review Prisma schema**:
   - Remove unused models/fields
   - Optimize indexes
   - Add missing constraints

2. **Clean up migrations**:
   - Squash old migrations (carefully)
   - Document migration history

3. **Backup verification**:
   - Test backup restoration
   - Verify backup schedule

### 7. Security Maintenance

#### Regular Security Audits
1. **Scan for vulnerabilities**:
   ```bash
   pnpm audit
   ```

2. **Review secret management**:
   - Verify no secrets in git history
   - Check `.gitignore` is comprehensive
   - Rotate old secrets

3. **Update security dependencies**:
   - Authentication libraries
   - Encryption packages
   - Security middleware

4. **Review access controls**:
   - API authentication
   - Database permissions
   - Deployment access

## Operating Loop

1. **Assess**: Identify maintenance needs (dependencies, code quality, performance)
2. **Prioritize**: Sort by urgency (security > bugs > optimization > cleanup)
3. **Plan**: Create branch, define scope, set acceptance criteria
4. **Implement**: Make changes incrementally, keeping diffs reviewable
5. **Test**: Run full test suite after each change
6. **Document**: Update relevant docs and logs
7. **Deploy**: Follow standard deployment workflow
8. **Verify**: Confirm improvements in production
9. **Iterate**: Move to next maintenance item

## Maintenance Schedule (Recommended)

| Task | Frequency | Priority |
| --- | --- | --- |
| Security updates | Immediate | Critical |
| Patch updates | Weekly | High |
| Minor updates | Monthly | Medium |
| Major updates | Quarterly | Medium |
| Code cleanup | Monthly | Low |
| Performance audit | Quarterly | Medium |
| Documentation review | Quarterly | Medium |
| Test coverage review | Monthly | Medium |
| Database optimization | Quarterly | Medium |

## Verification Checklist
- [ ] All updates tested thoroughly
- [ ] No breaking changes introduced
- [ ] Tests still passing
- [ ] Build successful
- [ ] Performance not degraded
- [ ] Documentation updated
- [ ] Logs updated with maintenance summary
- [ ] Security audit clean

## Exit Criteria
- Planned maintenance items completed.
- All tests passing.
- Production deployment verified.
- Documentation updated.
- Maintenance log entries created.
- Ready to return to `dev-assistant.md` for next mission.

## Safety
- **Never update all dependencies at once** (update incrementally)
- **Always test after each update**
- **Keep rollback plan ready** for major changes
- **Schedule downtime** for risky maintenance
- **Backup before major changes** (especially database)
- **Monitor production** closely after deployment
- **Rollback immediately** if issues detected

## Logging
Document all maintenance in `/logs/maintenance.log`:

```markdown
## [YYYY-MM-DD] Routine Maintenance

**Updates:**
- Updated Next.js 13.5.0 → 13.5.4
- Updated @stripe/stripe-js 2.1.0 → 2.1.7
- Updated Playwright 1.38.0 → 1.39.0

**Code Changes:**
- Removed 15 unused utility functions
- Refactored duplicate form validation logic
- Added JSDoc comments to API routes

**Performance:**
- Added database index on Business.slug
- Optimized /api/plans query (300ms → 50ms)
- Implemented React.lazy for heavy components

**Tests:**
- Added 12 missing unit tests
- Fixed 3 flaky E2E tests
- Coverage: 78% → 82%

**Verification:**
- All tests passing ✓
- Build successful ✓
- Production deployment healthy ✓

**Next Maintenance:**
- Major dependency updates (Next.js 14)
- Database migration squashing
- API documentation generation
```

## Integration with Foundation
This mission inherits all standards from `/agents/mission.foundation.md`:
- Branching strategy (chore/<scope>)
- Commit format (chore(scope): message)
- Verification requirements
- Security standards
- Logging requirements

---

**Remember:** Regular maintenance prevents technical debt accumulation and keeps the codebase healthy. Small, consistent maintenance is better than large, risky overhauls.

