import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { z } from "zod";

const updateMemberSchema = z.object({
  name: z.string().min(1).max(200).nullable(),
  phone: z.string().max(50).nullable(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ consumerId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { consumerId } = await context.params;
    const body = await req.json();
    const data = updateMemberSchema.parse(body);

    // Verify the user has access to this consumer
    const consumer = await prisma.consumer.findUnique({
      where: { id: consumerId },
      include: {
        planSubscriptions: {
          include: {
            plan: {
              include: {
                business: {
                  include: {
                    users: {
                      where: {
                        userId: session.user.id,
                        role: {
                          in: ["OWNER", "ADMIN"],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!consumer || consumer.planSubscriptions.length === 0) {
      return NextResponse.json({ error: "Consumer not found" }, { status: 404 });
    }

    if (consumer.planSubscriptions[0].plan.business.users.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Update consumer
    const updated = await prisma.consumer.update({
      where: { id: consumerId },
      data: {
        name: data.name,
        phone: data.phone,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update member error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ consumerId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { consumerId } = await context.params;

    // Find all Member records for this consumer that the user has access to
    const members = await prisma.member.findMany({
      where: {
        consumerId,
        business: {
          users: {
            some: {
              userId: session.user.id,
              role: { in: ["OWNER", "ADMIN"] },
            },
          },
        },
      },
    });

    if (members.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Delete the Member records (business–consumer link)
    await prisma.member.deleteMany({
      where: {
        id: { in: members.map((m) => m.id) },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}

