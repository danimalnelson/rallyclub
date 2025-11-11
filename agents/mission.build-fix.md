# Mission — Build Recovery

## Trigger
- Activate when `pnpm build`, CI, or Vercel deployments fail.
- Resume normal missions once builds pass locally and on Vercel.

## Objective
Restore a clean, deployable build pipeline and publish a healthy production deployment.

## Prerequisites
- Access to Vercel CLI (`vercel`) and project credentials.
- Local environment variables configured; secrets never hardcoded.
- Logging destinations ready (`/logs/build-progress.md`, `/logs/build-patches.md`).

## Operating Loop
1. **Capture Error**
   - Fetch recent logs: `vercel logs --since 30m`.
   - Record the failure signature in `/logs/build-patches.md`.
2. **Diagnose**
   - Categorize the issue (env var, import, schema, TS, etc.).
   - Pinpoint responsible files/configuration.
3. **Fix**
   - Apply minimal patches to resolve the root cause.
   - Run locally:
     - `bash scripts/run-full-tests.sh`
     - `pnpm build`
4. **Redeploy**
   - When local tests + build succeed, run `vercel --prod --confirm`.
   - Wait for deployment to reach `state: READY`.
5. **Verify**
   - Health check: `curl -I https://YOUR_APP_URL.vercel.app`.
   - Log outcomes and links in `/logs/build-progress.md`.
6. **Iterate**
   - If any step fails, document the attempt, update the diagnosis, and repeat from step 1.

## Verification
- Local tests and builds succeed without errors.
- Vercel deployment status READY.
- Health check returns HTTP 200.

## Exit Criteria
- Latest production build healthy with documented summary in `/logs/build-progress.md`.
- No unresolved build errors or pending follow-ups.

## Safety
- Never expose secrets; reference `process.env.*` only.
- Confirm with a human before introducing placeholder env values.
- Prefer reversible patches and maintain a chronological log of changes.
- Avoid piping long-running commands (`| tail`, `| grep`, `| head`); redirect to a log file if filtering is required.
