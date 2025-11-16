import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ alertId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { alertId } = await context.params;

    // Get alert and verify access
    const alert = await prisma.businessAlert.findFirst({
      where: {
        id: alertId,
        business: {
          users: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: "Alert not found or access denied" },
        { status: 404 }
      );
    }

    // Resolve alert
    const updatedAlert = await prisma.businessAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });

    return NextResponse.json(updatedAlert);
  } catch (error) {
    console.error("Resolve alert error:", error);
    return NextResponse.json(
      { error: "Failed to resolve alert" },
      { status: 500 }
    );
  }
}

