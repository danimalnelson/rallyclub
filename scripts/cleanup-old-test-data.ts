#!/usr/bin/env tsx
/**
 * Cleanup Old Test Data
 * 
 * This script removes old test data from deprecated models:
 * - MembershipPlan (Phase 2 - deprecated)
 * - Price (Phase 2 - deprecated)
 * - Old Subscription records
 * - Test consumers/members without real subscriptions
 * 
 * Keeps:
 * - User accounts
 * - Business records
 * - New Membership and Plan models (Phase 3+)
 * - Real PlanSubscription records
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanup() {
  console.log("🧹 Starting cleanup of old test data...\n");

  try {
    // 1. Delete old Subscription records (Phase 2 model)
    const deletedSubscriptions = await prisma.subscription.deleteMany({});
    console.log(`✅ Deleted ${deletedSubscriptions.count} old Subscription records`);

    // 2. Delete old Price records (Phase 2 model)
    const deletedPrices = await prisma.price.deleteMany({});
    console.log(`✅ Deleted ${deletedPrices.count} old Price records`);

    // 3. Delete old MembershipPlan records (Phase 2 model)
    const deletedPlans = await prisma.membershipPlan.deleteMany({});
    console.log(`✅ Deleted ${deletedPlans.count} old MembershipPlan records`);

    // 4. Delete test Member records (only those without PlanSubscriptions)
    const testMembers = await prisma.member.findMany({
      where: {
        OR: [
          { consumer: { email: { contains: "@example.com" } } },
          { consumer: { email: { contains: "member1@" } } },
          { consumer: { email: { contains: "member2@" } } },
          { consumer: { email: { contains: "member3@" } } },
        ],
      },
      include: {
        consumer: {
          include: {
            planSubscriptions: true,
          },
        },
      },
    });

    let deletedMembersCount = 0;
    for (const member of testMembers) {
      // Only delete if consumer has no real subscriptions
      if (member.consumer.planSubscriptions.length === 0) {
        await prisma.member.delete({ where: { id: member.id } });
        deletedMembersCount++;
      }
    }
    console.log(`✅ Deleted ${deletedMembersCount} test Member records`);

    // 5. Delete test Consumer records (only those without PlanSubscriptions)
    const testConsumers = await prisma.consumer.findMany({
      where: {
        OR: [
          { email: { contains: "@example.com" } },
          { email: { contains: "member1@" } },
          { email: { contains: "member2@" } },
          { email: { contains: "member3@" } },
        ],
      },
      include: {
        planSubscriptions: true,
        members: true,
      },
    });

    let deletedConsumersCount = 0;
    for (const consumer of testConsumers) {
      // Only delete if no real subscriptions or members
      if (consumer.planSubscriptions.length === 0 && consumer.members.length === 0) {
        await prisma.consumer.delete({ where: { id: consumer.id } });
        deletedConsumersCount++;
      }
    }
    console.log(`✅ Deleted ${deletedConsumersCount} test Consumer records`);

    console.log("\n🎉 Cleanup complete!");
    console.log("\n📋 What remains:");
    console.log("   ✓ User accounts (for authentication)");
    console.log("   ✓ Business records");
    console.log("   ✓ New Membership records (Phase 3+)");
    console.log("   ✓ New Plan records (Phase 3+)");
    console.log("   ✓ Real PlanSubscription records");
    console.log("\n💡 Next steps:");
    console.log("   1. Verify your real memberships and plans are still visible");
    console.log("   2. Test the consumer flow at /[slug]");
    console.log("   3. Create new test subscriptions through the UI");

  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

cleanup()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

