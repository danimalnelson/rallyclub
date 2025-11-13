/**
 * Reusable authentication utilities for API routes
 * 
 * Reduces boilerplate and ensures consistent auth patterns across all API endpoints.
 */

import { getServerSession } from "next-auth";
import type { AuthOptions } from "next-auth";
import { ApiErrors } from "./api-errors";

/**
 * Result of authentication check
 */
export interface AuthResult {
  /** Authenticated user with ID and email */
  user: {
    id: string;
    email: string;
  };
  /** User's default business ID (if any) */
  businessId?: string;
}

/**
 * Gets the current authenticated session or returns an error response.
 * 
 * Use this at the start of protected API routes to ensure user is logged in.
 * Returns either the session data or a standardized 401 error response.
 * 
 * @param authOptions - NextAuth configuration
 * @returns Object with `session` (if authenticated) or `error` (if not)
 * 
 * @example
 * export async function GET(req: NextRequest) {
 *   const auth = await requireAuth(authOptions);
 *   if ('error' in auth) return auth.error;
 *   
 *   const { user } = auth.session;
 *   // ... rest of handler
 * }
 */
export async function requireAuth(
  authOptions: AuthOptions
): Promise<
  | { session: AuthResult; error?: never }
  | { error: ReturnType<typeof ApiErrors.unauthorized>; session?: never }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: ApiErrors.unauthorized() };
  }

  return {
    session: {
      user: {
        id: session.user.id,
        email: session.user.email || "",
      },
      businessId: (session as any).businessId,
    },
  };
}

/**
 * Checks if the authenticated user has access to a specific business.
 * 
 * Verifies that the user is a member of the specified business via BusinessUser table.
 * Returns standardized error responses for unauthorized or not found cases.
 * 
 * @param prisma - Prisma client instance
 * @param userId - ID of the authenticated user
 * @param businessId - ID of the business to check access for
 * @returns Object with `business` (if authorized) or `error` (if not)
 * 
 * @example
 * export async function GET(req: NextRequest, { params }: { params: { businessId: string } }) {
 *   const auth = await requireAuth(authOptions);
 *   if ('error' in auth) return auth.error;
 *   
 *   const businessAccess = await requireBusinessAccess(
 *     prisma,
 *     auth.session.user.id,
 *     params.businessId
 *   );
 *   if ('error' in businessAccess) return businessAccess.error;
 *   
 *   const { business } = businessAccess;
 *   // ... rest of handler
 * }
 */
export async function requireBusinessAccess(
  prisma: any, // PrismaClient type, but avoiding import for flexibility
  userId: string,
  businessId: string
): Promise<
  | { business: any; error?: never }
  | { error: ReturnType<typeof ApiErrors.notFound | typeof ApiErrors.forbidden>; business?: never }
> {
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      users: {
        some: {
          userId,
        },
      },
    },
    include: {
      users: {
        where: {
          userId,
        },
        select: {
          role: true,
        },
      },
    },
  });

  if (!business) {
    return { error: ApiErrors.notFound("Business", { businessId }) };
  }

  return { business };
}

/**
 * Combined auth check for routes that need both authentication and business access.
 * 
 * Convenience function that combines requireAuth() and requireBusinessAccess() into one call.
 * 
 * @param authOptions - NextAuth configuration
 * @param prisma - Prisma client instance
 * @param businessId - ID of the business to check access for
 * @returns Object with `session` and `business` (if authorized) or `error` (if not)
 * 
 * @example
 * export async function GET(req: NextRequest, { params }: { params: { businessId: string } }) {
 *   const auth = await requireBusinessAuth(authOptions, prisma, params.businessId);
 *   if ('error' in auth) return auth.error;
 *   
 *   const { session, business } = auth;
 *   // ... rest of handler
 * }
 */
export async function requireBusinessAuth(
  authOptions: AuthOptions,
  prisma: any,
  businessId: string
): Promise<
  | { session: AuthResult; business: any; error?: never }
  | { error: any; session?: never; business?: never }
> {
  // Check authentication
  const authResult = await requireAuth(authOptions);
  if ("error" in authResult) {
    return authResult;
  }

  // Check business access
  const businessResult = await requireBusinessAccess(
    prisma,
    authResult.session.user.id,
    businessId
  );
  if ("error" in businessResult) {
    return businessResult;
  }

  return {
    session: authResult.session,
    business: businessResult.business,
  };
}

