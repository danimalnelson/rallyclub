import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@wine-club/db";

/**
 * Cached business lookup by slug + user ID.
 * React's `cache()` deduplicates this call within a single request,
 * so layout.tsx and page.tsx can both call it without hitting the DB twice.
 */
export const getBusinessBySlug = cache(
  async (slug: string, userId: string) => {
    return prisma.business.findFirst({
      where: {
        slug,
        users: {
          some: {
            userId,
          },
        },
      },
    });
  }
);

/**
 * Cached fetch of all businesses for a user (used in the business switcher).
 * Uses unstable_cache for cross-request caching (60s) since business list
 * changes infrequently. Also deduplicated within a request via React cache().
 */
export const getUserBusinesses = cache(async (userId: string) => {
  const cachedFetch = unstable_cache(
    async () => {
      return prisma.business.findMany({
        where: {
          users: {
            some: {
              userId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      });
    },
    [`user-businesses-${userId}`],
    { revalidate: 60, tags: [`user-businesses-${userId}`] }
  );
  return cachedFetch();
});
