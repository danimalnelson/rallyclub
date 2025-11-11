# Diagnostic Directive — Auth Flow

## Objective
Investigate and fix issues with the NextAuth `/auth/signin` route in the deployed Vercel environment.

## Steps
1. **Run local and build-time logs**
   - Check Vercel logs for build/runtime errors on `auth/*` routes.
   - Run `pnpm dev` locally and inspect any NextAuth warnings.

2. **Check environment variables**
   - Verify `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and provider credentials are defined both locally and on Vercel.
   - Confirm `NEXTAUTH_URL` matches `https://membership-saas-1mpiqobwh-dannelson.vercel.app`.

3. **Confirm Prisma + DB connection**
   - Ensure `DATABASE_URL` (Neon) matches what Prisma expects.
   - Run `pnpm prisma db pull` and `pnpm prisma migrate status` to confirm connectivity.

4. **Check Adapter**
   - Ensure NextAuth is using the correct Prisma adapter in `/lib/auth.ts` or `/pages/api/auth/[...nextauth].ts`.

5. **Browser-side**
   - Open dev console on `/auth/signin`.
   - Note any 500/404 network calls to `api/auth`.

6. **Remediation Loop**
   - For each failing area:
     - Propose or apply a patch (code, env, config).
     - Re-run build/test.
     - Verify sign-in success locally.
   - Repeat until the page loads correctly.

## Rules
- Always check for missing env vars before code edits.
- Do not hardcode secrets.
- Document fixes and update `.env.example`.

## Output
A concise summary:
- Root cause
- Fix applied
- Verification result
