import { NextResponse } from "next/server";
import { prisma } from "@wine-club/db";

export async function GET() {
  try {
    const testConsumer = await prisma.consumer.findUnique({
      where: { email: "test@example.com" },
      include: {
        planSubscriptions: {
          include: {
            plan: true,
          },
        },
      },
    });

    return NextResponse.json({
      found: !!testConsumer,
      consumer: testConsumer,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

