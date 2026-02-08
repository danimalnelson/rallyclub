import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasourceUrl: addConnectionParams(process.env.DATABASE_URL),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Append connection pool params to the DATABASE_URL if not already present.
 * - connection_limit=5: keeps pool small for serverless (Vercel spins many instances)
 * - pool_timeout=20: gives more time before timing out
 */
function addConnectionParams(url: string | undefined): string | undefined {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  // Don't override if already set
  if (url.includes("connection_limit")) return url;
  return `${url}${separator}connection_limit=5&pool_timeout=20`;
}

export * from "@prisma/client";
