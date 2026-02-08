import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { MembersTable } from "@/components/members/MembersTable";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug } = await params;
  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  // Get all consumers who have subscriptions to this business's plans
  const planSubscriptions = await prisma.planSubscription.findMany({
    where: {
      plan: {
        businessId: business.id,
      },
    },
    include: {
      consumer: true,
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Group subscriptions by consumer email
  const consumersMap = new Map<string, {
    consumer: typeof planSubscriptions[0]["consumer"];
    subscriptions: typeof planSubscriptions;
  }>();

  planSubscriptions.forEach((sub) => {
    const email = sub.consumer.email.toLowerCase();

    if (!consumersMap.has(email)) {
      consumersMap.set(email, {
        consumer: sub.consumer,
        subscriptions: [],
      });
    } else {
      const existing = consumersMap.get(email)!;
      if (!existing.consumer.name && sub.consumer.name) {
        existing.consumer = sub.consumer;
      }
    }

    consumersMap.get(email)!.subscriptions.push(sub);
  });

  // Shape into flat member objects
  const members = Array.from(consumersMap.values()).map((entry) => {
    const activeStatuses = ["active", "ACTIVE", "trialing"];
    const activeSubs = entry.subscriptions.filter((s) => activeStatuses.includes(s.status));
    const activePlans = [...new Set(activeSubs.map((s) => s.plan.name))];

    return {
      id: entry.consumer.id,
      name: entry.consumer.name || entry.consumer.email.split("@")[0],
      email: entry.consumer.email,
      status: (activeSubs.length > 0 ? "ACTIVE" : "INACTIVE") as "ACTIVE" | "INACTIVE",
      joinedAt: entry.consumer.createdAt,
      activePlans,
    };
  });

  // Collect all unique plan names for filter dropdown
  const allPlanNames = [...new Set(planSubscriptions.map((s) => s.plan.name))].sort();

  return (
    <div className="max-w-7xl mx-auto">
      <MembersTable
        members={members}
        allPlanNames={allPlanNames}
        businessSlug={business.slug}
        timeZone={business.timeZone}
      />
    </div>
  );
}
