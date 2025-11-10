import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create owner user
  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@rubytap.com" },
    update: {},
    create: {
      email: "owner@rubytap.com",
      name: "Ruby Tap Owner",
    },
  });

  // Create staff user
  const staffUser = await prisma.user.upsert({
    where: { email: "staff@rubytap.com" },
    update: {},
    create: {
      email: "staff@rubytap.com",
      name: "Ruby Tap Staff",
    },
  });

  // Create business (using placeholder Stripe account for dev)
  const business = await prisma.business.upsert({
    where: { slug: "rubytap" },
    update: {},
    create: {
      name: "Ruby Tap",
      slug: "rubytap",
      country: "US",
      currency: "USD",
      timeZone: "America/New_York",
      stripeAccountId: "acct_12345_placeholder", // TODO: Replace with real Connect account in dev
    },
  });

  // Link users to business
  await prisma.businessUser.upsert({
    where: {
      userId_businessId: {
        userId: ownerUser.id,
        businessId: business.id,
      },
    },
    update: {},
    create: {
      userId: ownerUser.id,
      businessId: business.id,
      role: "OWNER",
    },
  });

  await prisma.businessUser.upsert({
    where: {
      userId_businessId: {
        userId: staffUser.id,
        businessId: business.id,
      },
    },
    update: {},
    create: {
      userId: staffUser.id,
      businessId: business.id,
      role: "STAFF",
    },
  });

  // Create membership plans
  const premiumPlan = await prisma.membershipPlan.upsert({
    where: { id: "premium-plan-seed" },
    update: {},
    create: {
      id: "premium-plan-seed",
      businessId: business.id,
      name: "Premium Wine Club",
      description: "Enjoy 2 bottles of hand-selected wine each month",
      status: "ACTIVE",
      benefits: {
        items: [
          "2 premium bottles monthly",
          "20% off all wines in-store",
          "Exclusive tasting events",
          "Free shipping",
        ],
      },
      stripeProductId: "prod_placeholder_premium",
    },
  });

  const classicPlan = await prisma.membershipPlan.upsert({
    where: { id: "classic-plan-seed" },
    update: {},
    create: {
      id: "classic-plan-seed",
      businessId: business.id,
      name: "Classic Wine Club",
      description: "Perfect for casual wine lovers",
      status: "ACTIVE",
      benefits: {
        items: [
          "1 curated bottle monthly",
          "10% off all wines in-store",
          "Member-only events",
        ],
      },
      stripeProductId: "prod_placeholder_classic",
    },
  });

  // Create prices
  await prisma.price.upsert({
    where: { id: "premium-monthly-seed" },
    update: {},
    create: {
      id: "premium-monthly-seed",
      membershipPlanId: premiumPlan.id,
      nickname: "Premium Monthly",
      interval: "month",
      unitAmount: 8900, // $89.00
      currency: "USD",
      stripePriceId: "price_placeholder_premium_monthly",
      isDefault: true,
    },
  });

  await prisma.price.upsert({
    where: { id: "premium-yearly-seed" },
    update: {},
    create: {
      id: "premium-yearly-seed",
      membershipPlanId: premiumPlan.id,
      nickname: "Premium Yearly",
      interval: "year",
      unitAmount: 95000, // $950.00 (save ~$118/yr)
      currency: "USD",
      stripePriceId: "price_placeholder_premium_yearly",
      isDefault: false,
    },
  });

  await prisma.price.upsert({
    where: { id: "classic-monthly-seed" },
    update: {},
    create: {
      id: "classic-monthly-seed",
      membershipPlanId: classicPlan.id,
      nickname: "Classic Monthly",
      interval: "month",
      unitAmount: 4900, // $49.00
      currency: "USD",
      stripePriceId: "price_placeholder_classic_monthly",
      isDefault: true,
    },
  });

  // Create sample consumers
  const consumer1 = await prisma.consumer.upsert({
    where: { email: "member1@example.com" },
    update: {},
    create: {
      email: "member1@example.com",
      name: "Jane Doe",
      phone: "+1234567890",
    },
  });

  const consumer2 = await prisma.consumer.upsert({
    where: { email: "member2@example.com" },
    update: {},
    create: {
      email: "member2@example.com",
      name: "John Smith",
    },
  });

  const consumer3 = await prisma.consumer.upsert({
    where: { email: "member3@example.com" },
    update: {},
    create: {
      email: "member3@example.com",
      name: "Alice Johnson",
    },
  });

  // Create members
  const member1 = await prisma.member.upsert({
    where: {
      businessId_consumerId: {
        businessId: business.id,
        consumerId: consumer1.id,
      },
    },
    update: {},
    create: {
      businessId: business.id,
      consumerId: consumer1.id,
      status: "ACTIVE",
    },
  });

  const member2 = await prisma.member.upsert({
    where: {
      businessId_consumerId: {
        businessId: business.id,
        consumerId: consumer2.id,
      },
    },
    update: {},
    create: {
      businessId: business.id,
      consumerId: consumer2.id,
      status: "ACTIVE",
    },
  });

  const member3 = await prisma.member.upsert({
    where: {
      businessId_consumerId: {
        businessId: business.id,
        consumerId: consumer3.id,
      },
    },
    update: {},
    create: {
      businessId: business.id,
      consumerId: consumer3.id,
      status: "PAST_DUE",
    },
  });

  console.log("✅ Seed complete!");
  console.log({
    ownerUser,
    staffUser,
    business,
    plans: [premiumPlan, classicPlan],
    members: [member1, member2, member3],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

