import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { z } from "zod";

const createNoteSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function POST(
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
    const data = createNoteSchema.parse(body);

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

    // Create note
    const note = await prisma.memberNote.create({
      data: {
        consumerId,
        content: data.content,
        createdById: session.user.id,
      },
      // include: {
      //   createdBy: {
      //     select: {
      //       name: true,
      //       email: true,
      //     },
      //   },
      // },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("Create note error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

