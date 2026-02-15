import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";

// Default preferences — all enabled (opt-out model)
const DEFAULT_PREFERENCES = {
  newMember: true,
  paymentReceived: true,
  paymentFailed: true,
  cancellationScheduled: true,
  subscriptionCanceled: true,
  subscriptionPaused: true,
  subscriptionResumed: true,
};

export type NotificationPreferences = typeof DEFAULT_PREFERENCES;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { businessId } = await params;

    const businessUser = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: session.user.id,
          businessId,
        },
      },
    });

    if (!businessUser) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...((businessUser.notificationPreferences as any) || {}),
    };

    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error("[NOTIFICATION_PREFS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { businessId } = await params;
    const body = await req.json();

    const businessUser = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: session.user.id,
          businessId,
        },
      },
    });

    if (!businessUser) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validate: only allow known preference keys with boolean values
    const validKeys = Object.keys(DEFAULT_PREFERENCES);
    const preferences: Record<string, boolean> = {};
    for (const key of validKeys) {
      if (typeof body[key] === "boolean") {
        preferences[key] = body[key];
      }
    }

    await prisma.businessUser.update({
      where: { id: businessUser.id },
      data: {
        notificationPreferences: preferences,
      },
    });

    return NextResponse.json({
      preferences: { ...DEFAULT_PREFERENCES, ...preferences },
    });
  } catch (error: any) {
    console.error("[NOTIFICATION_PREFS_PUT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
