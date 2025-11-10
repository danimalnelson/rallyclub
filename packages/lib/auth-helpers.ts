/**
 * Extended session type with businessId
 */
export interface ExtendedSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  businessId?: string;
  expires: string;
}

/**
 * Check if user has access to a business
 */
export async function hasBusinessAccess(
  userId: string,
  businessId: string,
  prisma: any // PrismaClient type
): Promise<boolean> {
  const businessUser = await prisma.businessUser.findUnique({
    where: {
      userId_businessId: {
        userId,
        businessId,
      },
    },
  });
  return !!businessUser;
}

/**
 * Check if user has a specific role in a business
 */
export async function hasBusinessRole(
  userId: string,
  businessId: string,
  roles: string[],
  prisma: any
): Promise<boolean> {
  const businessUser = await prisma.businessUser.findUnique({
    where: {
      userId_businessId: {
        userId,
        businessId,
      },
    },
  });
  return !!businessUser && roles.includes(businessUser.role);
}

/**
 * Get user's businesses
 */
export async function getUserBusinesses(userId: string, prisma: any) {
  return prisma.business.findMany({
    where: {
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
}

