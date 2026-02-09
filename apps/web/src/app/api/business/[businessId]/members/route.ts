import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { z } from "zod";

const createMemberSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
});

export async function POST(
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
    const data = createMemberSchema.parse(body);

    // Verify user has OWNER or ADMIN access to this business
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        users: {
          some: {
            userId: session.user.id,
            role: { in: ["OWNER", "ADMIN"] },
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found or insufficient permissions" },
        { status: 404 }
      );
    }

    const emailLower = data.email.toLowerCase();

    // Check if consumer already exists
    let consumer = await prisma.consumer.findUnique({
      where: { email: emailLower },
    });

    if (consumer) {
      // Check if they already have a Member record for this business
      const existingMember = await prisma.member.findUnique({
        where: {
          businessId_consumerId: {
            businessId,
            consumerId: consumer.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "This customer already exists for this business" },
          { status: 409 }
        );
      }

      // Update name/phone if provided and consumer doesn't have them
      if ((data.name && !consumer.name) || (data.phone && !consumer.phone)) {
        consumer = await prisma.consumer.update({
          where: { id: consumer.id },
          data: {
            ...(data.name && !consumer.name ? { name: data.name } : {}),
            ...(data.phone && !consumer.phone ? { phone: data.phone } : {}),
          },
        });
      }
    } else {
      // Create new consumer
      consumer = await prisma.consumer.create({
        data: {
          email: emailLower,
          name: data.name || null,
          phone: data.phone || null,
        },
      });
    }

    // Create the Member (business-consumer link)
    const member = await prisma.member.create({
      data: {
        businessId,
        consumerId: consumer.id,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      id: consumer.id,
      name: consumer.name,
      email: consumer.email,
      phone: consumer.phone,
      memberId: member.id,
    });
  } catch (error: any) {
    console.error("Create member error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
