import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@wine-club/db";

/**
 * Checks whether a user has the platform-level superadmin flag.
 * Deduplicated within a single request via React cache().
 */
export const checkSuperAdmin = cache(async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return user?.isSuperAdmin === true;
});

/**
 * Cached business lookup by slug + user ID.
 * React's `cache()` deduplicates this call within a single request,
 * so layout.tsx and page.tsx can both call it without hitting the DB twice.
 * Superadmins bypass the membership check and get OWNER-level access.
 */
export const getBusinessBySlug = cache(
  async (slug: string, userId: string) => {
    const superAdmin = await checkSuperAdmin(userId);

    if (superAdmin) {
      const business = await prisma.business.findFirst({ where: { slug } });
      if (!business) return null;
      return { ...business, userRole: "OWNER" as const };
    }

    const business = await prisma.business.findFirst({
      where: {
        slug,
        users: {
          some: {
            userId,
          },
        },
      },
      include: {
        users: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!business) return null;

    const { users, ...rest } = business;
    return {
      ...rest,
      userRole: (users[0]?.role ?? "STAFF") as "OWNER" | "ADMIN" | "STAFF",
    };
  }
);

/**
 * Cached fetch of all businesses for a user (used in the business switcher).
 * Superadmins see every business on the platform.
 */
export const getUserBusinesses = cache(async (userId: string) => {
  const superAdmin = await checkSuperAdmin(userId);

  const cachedFetch = unstable_cache(
    async () => {
      return prisma.business.findMany({
        where: superAdmin
          ? undefined
          : { users: { some: { userId } } },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
        orderBy: { name: "asc" },
      });
    },
    [superAdmin ? `all-businesses` : `user-businesses-${userId}`],
    { revalidate: 60, tags: [superAdmin ? `all-businesses` : `user-businesses-${userId}`] }
  );
  return cachedFetch();
});
