import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId } = await params;

  // Verify user has access to this business
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      users: { some: { userId: session.user.id } },
    },
    select: { id: true, name: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get all subscriptions with member and plan info
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
    orderBy: [
      { consumer: { email: "asc" } },
      { createdAt: "desc" },
    ],
  });

  // Generate CSV - one row per subscription (most compatible format)
  const headers = ["Name", "Email", "Membership", "Plan", "Status", "Start Date"];
  const rows = subscriptions.map((sub) => [
    escapeCsvField(sub.consumer.name || ""),
    escapeCsvField(sub.consumer.email),
    escapeCsvField(sub.plan.membership.name),
    escapeCsvField(sub.plan.name),
    escapeCsvField(formatStatus(sub.status)),
    sub.createdAt.toISOString().split("T")[0],
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Use business name for filename (already fetched above)
  const filename = `${slugify(business.name || "members")}-members-${new Date().toISOString().split("T")[0]}.csv`;

  // Return CSV file directly using Response (not NextResponse)
  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

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
