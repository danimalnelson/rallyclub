import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { requireBusinessAuth, withMiddleware } from "@wine-club/lib";

export const GET = withMiddleware(async (req: NextRequest, context) => {
  const { businessId } = (await context.params) as { businessId: string };

  // Authenticate and authorize
  const authResult = await requireBusinessAuth(authOptions, prisma, businessId);

  if ("error" in authResult) {
    return authResult.error;
  }

  // Get all members with their subscriptions
  const subscriptions = await prisma.planSubscription.findMany({
    where: {
      plan: { businessId },
    },
    include: {
      consumer: true,
      plan: {
        include: {
          membership: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Dedupe by consumer (one row per member with their most recent subscription)
  const memberMap = new Map<
    string,
    {
      name: string;
      email: string;
      plan: string;
      status: string;
      joinDate: string;
    }
  >();

  for (const sub of subscriptions) {
    // Skip if we already have this consumer (keep the most recent)
    if (memberMap.has(sub.consumerId)) continue;

    memberMap.set(sub.consumerId, {
      name: sub.consumer.name || "",
      email: sub.consumer.email,
      plan: `${sub.plan.membership.name} - ${sub.plan.name}`,
      status: formatStatus(sub.status),
      joinDate: sub.createdAt.toISOString().split("T")[0],
    });
  }

  // Generate CSV
  const headers = ["Name", "Email", "Plan", "Status", "Join Date"];
  const rows = Array.from(memberMap.values()).map((member) => [
    escapeCsvField(member.name),
    escapeCsvField(member.email),
    escapeCsvField(member.plan),
    escapeCsvField(member.status),
    member.joinDate,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Get business name for filename
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  const filename = `${slugify(business?.name || "members")}-members-${new Date().toISOString().split("T")[0]}.csv`;

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

/**
 * Escape a field for CSV (wrap in quotes if contains comma, quote, or newline)
 */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format subscription status for display
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past Due",
    canceled: "Canceled",
    paused: "Paused",
    unpaid: "Unpaid",
    incomplete: "Incomplete",
  };
  return statusMap[status] || status;
}

/**
 * Convert string to URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
