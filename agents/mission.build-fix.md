# Mission Objective — Autonomous Build Recovery

## Goal
Continuously monitor and repair build failures (local or Vercel) until a successful deployment occurs.

## Tasks
1. **Detect Build Errors**
   - Parse the latest Vercel build logs (via `vercel logs --since 30m`).
   - Identify the error type: missing env var, import/path issue, TS build error, Prisma schema error, etc.
   - Map each error to the responsible file or config.

2. **Diagnose & Fix**
   - Apply a patch or configuration fix.
   - Re-run a local build using:
     ```bash
     bash scripts/run-full-tests.sh
     pnpm build
     ```
   - If build succeeds locally, trigger a new Vercel deploy:
     ```bash
     vercel --prod --confirm
     ```

3. **Verify Success**
   - Wait for deployment logs to confirm `state: READY`.
   - Run health check:
     ```bash
     curl -I https://YOUR_APP_URL.vercel.app
     ```
   - Log results to `/logs/build-progress.md`.

4. **Iterate**
   - If build fails again:
     - Log the error snippet.
     - Apply another patch.
     - Repeat steps 1–3.

5. **Exit**
   - Stop only when:
     - Vercel deployment succeeds (`state: READY`)
     - and site responds with HTTP 200.
   - Write a final summary of fixes in `/logs/build-progress.md`.

## Safety Rules
- Never expose secrets from `.env`.
- For env var errors, request verification before creating defaults.
- Prefer minimal file edits.
- Keep a patch log in `/logs/build-patches.md`.

## Execution Safety
Do not run commands that pipe or filter long-running output
(e.g., using `| tail`, `| grep`, or `| head`) during autonomous runs.
Instead, redirect output to a log file and read it from there.
