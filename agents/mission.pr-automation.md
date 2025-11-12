# Mission — PR Automation & Workflow

## Trigger
- Activate when feature work is complete and ready for review.
- Use for automating PR creation, review checks, and merge workflows.
- Switch here when code needs to transition from local development to production.

## Objective
Automate the pull request lifecycle from creation through merge, ensuring code quality, test coverage, and deployment verification at each stage.

## Prerequisites
**Foundation:** Must follow all rules in `/agents/mission.foundation.md`.

- Feature branch with completed work and passing tests.
- Clean commit history with conventional commit messages.
- All logs updated with work summary.
- GitHub CLI installed (optional but recommended): `gh`

## PR Workflow Stages

### Stage 1: Pre-PR Verification
Before creating a PR, ensure:

1. **Branch is up to date**:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **All tests pass**:
   ```bash
   bash scripts/run-full-tests.sh
   ```

3. **Build succeeds**:
   ```bash
   pnpm build
   ```

4. **Linter passes**:
   ```bash
   pnpm lint
   ```

5. **No secrets committed**:
   ```bash
   git diff main...HEAD | grep -E "(sk_|pk_|whsec_|re_|postgresql://.*:.*@)"
   ```
   Should return no results.

6. **Logs updated**:
   - Relevant `/logs/*.md` files reflect work completed
   - Clear summary of changes and outcomes

### Stage 2: PR Creation

#### Automated PR Creation (GitHub CLI)
```bash
gh pr create \
  --title "feat(scope): descriptive title" \
  --body "$(cat PR_TEMPLATE.md)" \
  --base main \
  --head feature/<feature-slug>
```

#### Manual PR Creation
1. Push branch: `git push origin feature/<feature-slug>`
2. Navigate to GitHub repository
3. Click "Create Pull Request"
4. Fill in PR template

#### PR Description Template
```markdown
## Description
Brief summary of what this PR accomplishes.

## Type of Change
- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] test: Test improvements
- [ ] docs: Documentation update
- [ ] refactor: Code refactoring
- [ ] chore: Maintenance

## Related Issues
Closes #<issue-number>

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

### Test Results
```
bash scripts/run-full-tests.sh
[Paste test output summary]
```

## Deployment
- [ ] Local build successful
- [ ] Vercel preview deployed
- [ ] Preview URL tested: [URL]

## Checklist
- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No secrets committed
- [ ] Logs updated
- [ ] Conventional commit format used

## Screenshots (if applicable)
[Add screenshots of UI changes]

## Additional Notes
[Any context reviewers should know]
```

### Stage 3: Automated Checks

#### CI/CD Pipeline
The following should be automated via GitHub Actions (if configured):

1. **Test Suite**:
   - Unit tests
   - Integration tests
   - E2E tests
   
2. **Build Verification**:
   - `pnpm build` succeeds
   
3. **Linting**:
   - `pnpm lint` passes
   
4. **Type Checking**:
   - TypeScript compilation succeeds
   
5. **Secret Scanning**:
   - No hardcoded API keys or credentials
   
6. **Preview Deployment**:
   - Vercel preview deployment
   - Preview URL generated

#### Manual Checks (if CI not configured)
Run these commands and document results:

```bash
# Full test suite
bash scripts/run-full-tests.sh

# Build
pnpm build

# Lint
pnpm lint

# Type check
pnpm tsc --noEmit
```

### Stage 4: Review Process

#### Self-Review Checklist
Before requesting review:

- [ ] Review your own diff on GitHub
- [ ] Check for debugging code (console.logs, commented code)
- [ ] Verify all files intended to be committed are included
- [ ] Ensure no unintended files committed (.env, node_modules, etc.)
- [ ] Validate commit messages follow convention
- [ ] Confirm PR description is clear and complete

#### Code Review Guidelines
What reviewers should check:

1. **Functionality**: Does it work as intended?
2. **Tests**: Are critical paths covered?
3. **Security**: No secrets, proper validation?
4. **Performance**: Any potential bottlenecks?
5. **Maintainability**: Is code clear and well-organized?
6. **Documentation**: Are changes documented?

#### Addressing Review Feedback
1. **Make requested changes** on same feature branch
2. **Commit with descriptive messages**:
   ```bash
   git commit -m "fix: address review feedback - improve error handling"
   ```
3. **Push updates**:
   ```bash
   git push origin feature/<feature-slug>
   ```
4. **Respond to comments** on GitHub
5. **Re-request review** when ready

### Stage 5: Merge Strategy

#### Pre-Merge Verification
1. **All checks green**: CI/CD pipeline passed
2. **Review approved**: At least one approval (if team workflow)
3. **Branch up to date**: Rebase if needed
4. **Conflicts resolved**: No merge conflicts
5. **Final test run**: Re-run tests if significant time passed

#### Merge Methods

**Squash and Merge (Recommended)**
- Combines all commits into one
- Clean main branch history
- Preserves detailed history in PR

```bash
# Via GitHub UI: "Squash and merge" button
# Or via CLI:
gh pr merge <pr-number> --squash --delete-branch
```

**Merge Commit**
- Preserves all individual commits
- Clear feature branch boundaries
- More verbose history

```bash
gh pr merge <pr-number> --merge --delete-branch
```

**Rebase and Merge**
- Linear history
- Preserves individual commits
- No merge commits

```bash
gh pr merge <pr-number> --rebase --delete-branch
```

#### Post-Merge Actions
1. **Delete feature branch**:
   ```bash
   git branch -d feature/<feature-slug>
   git push origin --delete feature/<feature-slug>
   ```

2. **Update local main**:
   ```bash
   git checkout main
   git pull origin main
   ```

3. **Verify production deployment**:
   - Check Vercel dashboard for successful deployment
   - Test production URL
   - Monitor for errors

4. **Update logs**:
   - Add merge info to relevant `/logs/*.md`
   - Note deployment URL and timestamp

5. **Close related issues**:
   - Verify issues are auto-closed (if configured)
   - Manually close if needed

### Stage 6: Production Verification

#### Health Checks
1. **Deployment Status**:
   ```bash
   vercel ls --prod
   vercel inspect <deployment-url>
   ```

2. **Application Health**:
   ```bash
   curl -I https://your-app.vercel.app
   # Should return 200 OK
   ```

3. **Feature Verification**:
   - Manually test the feature in production
   - Check for console errors
   - Verify database changes applied

4. **Monitoring**:
   - Watch Vercel logs for errors: `vercel logs --prod --since 10m`
   - Check error tracking (if configured)
   - Monitor performance metrics

#### Rollback Procedure (if issues detected)
1. **Identify issue** in production
2. **Document problem** in `/logs/build-patches.md`
3. **Revert merge commit**:
   ```bash
   git revert -m 1 <merge-commit-hash>
   git push origin main
   ```
4. **Verify rollback** deployed successfully
5. **Fix issue** on new branch
6. **Repeat PR process** with fix

## Operating Loop

1. **Pre-PR Check**: Verify all local checks pass
2. **Create PR**: With complete description and test results
3. **Automated Checks**: Ensure CI/CD passes (or run manual checks)
4. **Review**: Self-review then request team review if applicable
5. **Address Feedback**: Make changes and update PR
6. **Merge**: Use appropriate merge strategy
7. **Verify**: Check production deployment and health
8. **Document**: Update logs with merge and deployment info

## Verification Checklist
- [ ] All tests passing before PR creation
- [ ] PR description complete with all required sections
- [ ] All automated checks green (or manual checks completed)
- [ ] Code reviewed (self-review at minimum)
- [ ] Merge successful
- [ ] Production deployment verified
- [ ] Feature works in production
- [ ] Logs updated with merge info
- [ ] Feature branch deleted

## Exit Criteria
- PR successfully merged to main.
- Production deployment verified and healthy.
- Documentation and logs updated.
- Feature branch cleaned up.
- Ready to return to `dev-assistant.md` for next mission.

## Safety
- **Never force push** to main or protected branches
- **Never merge without passing tests**
- **Never skip review process** for significant changes
- **Never merge with known issues** (address or document them)
- **Always verify production** after merge
- **Keep rollback plan ready** for critical changes
- If production issues detected after merge, rollback immediately and fix separately

## Automation Opportunities

### GitHub Actions Workflow Example
```yaml
name: CI/CD Pipeline

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check for secrets
        run: |
          if git diff origin/main...HEAD | grep -E "(sk_|pk_|whsec_|re_)"; then
            echo "Potential secret detected!"
            exit 1
          fi
```

### Auto-Merge Configuration (Advanced)
For low-risk PRs (docs, tests) that pass all checks:

```bash
gh pr merge <pr-number> --auto --squash --delete-branch
```

Requires:
- Branch protection rules configured
- Required checks defined
- Auto-merge enabled in repository settings

## Integration with Foundation
This mission inherits all standards from `/agents/mission.foundation.md`:
- Branching strategy
- Commit format
- Verification requirements
- Security standards
- Logging requirements

---

**Remember:** PRs are the gateway to production. A rigorous PR process prevents bugs, maintains code quality, and creates a clear audit trail for all changes.

