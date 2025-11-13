/**
 * Seed script for new Stripe-native subscription models
 * 
 * Creates example data for:
 * - Membership (Wine Club, Beer Club)
 * - Plans (Monthly, Quarterly, Annual)
 * - PlanSubscriptions (Sample subscriptions)
 * - PriceQueueItems (Dynamic pricing examples)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedSubscriptions() {
  console.log("🌱 Seeding new subscription models...\n");

  // Find first business for testing (or create one)
  let business = await prisma.business.findFirst();
  
  if (!business) {
    console.log("⚠️  No business found. Creating test business...");
    const user = await prisma.user.findFirst();
    
    if (!user) {
      console.log("❌ No user found. Please create a user first.");
      return;
    }

    business = await prisma.business.create({
      data: {
        name: "Test Wine Club",
        slug: "test-wine-club",
        status: "ONBOARDING_COMPLETE",
        users: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    console.log("✅ Created test business:", business.name);
  }

  console.log("📦 Using business:", business.name);
  console.log("");

  // 1. Create Memberships
  console.log("1️⃣  Creating Memberships...");
  
  const wineClubMembership = await prisma.membership.upsert({
    where: { slug: "premium-wine-club" },
    create: {
      businessId: business.id,
      name: "Premium Wine Club",
      slug: "premium-wine-club",
      description: "Curated wines delivered to your door",
      status: "ACTIVE",
      allowMultiplePlans: true,  // Members can subscribe to multiple plans
      maxMembers: 500,
      billingAnchor: "NEXT_INTERVAL",  // Cohort billing (1st of month)
      cohortBillingDay: 1,
      giftEnabled: true,
      waitlistEnabled: false,
      pauseEnabled: true,
      skipEnabled: true,
      benefits: [
        "10% off all retail purchases",
        "Exclusive member-only events",
        "Free shipping on orders over $100",
        "Early access to limited releases",
      ],
      displayOrder: 1,
    },
    update: {},
  });
  console.log("   ✅ Wine Club Membership:", wineClubMembership.name);

  const beerClubMembership = await prisma.membership.upsert({
    where: { slug: "craft-beer-club" },
    create: {
      businessId: business.id,
      name: "Craft Beer Club",
      slug: "craft-beer-club",
      description: "Fresh craft beers every month",
      status: "ACTIVE",
      allowMultiplePlans: false,  // Members can only subscribe to one plan
      billingAnchor: "IMMEDIATE",  // Rolling billing (anniversary date)
      giftEnabled: true,
      pauseEnabled: false,
      skipEnabled: false,
      benefits: [
        "12 craft beers per month",
        "Brewer notes and pairing suggestions",
        "Access to member-only releases",
      ],
      displayOrder: 2,
    },
    update: {},
  });
  console.log("   ✅ Beer Club Membership:", beerClubMembership.name);
  console.log("");

  // 2. Create Plans for Wine Club
  console.log("2️⃣  Creating Plans...");
  
  const monthlyWinePlan = await prisma.plan.upsert({
    where: { id: "wine-monthly-001" },
    create: {
      id: "wine-monthly-001",
      businessId: business.id,
      membershipId: wineClubMembership.id,
      name: "Monthly Wine Selection",
      description: "3 bottles of curated wines every month",
      pricingType: "FIXED",
      basePrice: 7999,  // $79.99
      currency: "usd",
      interval: "MONTH",
      intervalCount: 1,
      quantityPerShipment: 3,
      productType: "wine",
      setupFee: 0,
      shippingType: "INCLUDED",
      trialPeriodDays: 0,
      stockStatus: "AVAILABLE",
      status: "ACTIVE",
      displayOrder: 1,
    },
    update: {},
  });
  console.log("   ✅ Monthly Wine Plan:", monthlyWinePlan.name);

  const quarterlyWinePlan = await prisma.plan.upsert({
    where: { id: "wine-quarterly-001" },
    create: {
      id: "wine-quarterly-001",
      businessId: business.id,
      membershipId: wineClubMembership.id,
      name: "Quarterly Wine Selection",
      description: "6 bottles of premium wines every 3 months",
      pricingType: "FIXED",
      basePrice: 14999,  // $149.99
      currency: "usd",
      interval: "MONTH",
      intervalCount: 3,
      quantityPerShipment: 6,
      productType: "wine",
      setupFee: 0,
      shippingType: "INCLUDED",
      trialPeriodDays: 0,
      stockStatus: "AVAILABLE",
      status: "ACTIVE",
      displayOrder: 2,
    },
    update: {},
  });
  console.log("   ✅ Quarterly Wine Plan:", quarterlyWinePlan.name);

  const annualWinePlan = await prisma.plan.upsert({
    where: { id: "wine-annual-001" },
    create: {
      id: "wine-annual-001",
      businessId: business.id,
      membershipId: wineClubMembership.id,
      name: "Annual Wine Selection",
      description: "12 bottles of reserve wines every year (20% savings)",
      pricingType: "FIXED",
      basePrice: 79999,  // $799.99 (vs $959.88 monthly)
      currency: "usd",
      interval: "YEAR",
      intervalCount: 1,
      quantityPerShipment: 12,
      productType: "wine",
      setupFee: 0,
      shippingType: "INCLUDED",
      trialPeriodDays: 0,
      stockStatus: "AVAILABLE",
      status: "ACTIVE",
      displayOrder: 3,
    },
    update: {},
  });
  console.log("   ✅ Annual Wine Plan:", annualWinePlan.name);

  // 3. Create Dynamic Pricing Plan
  const dynamicWinePlan = await prisma.plan.upsert({
    where: { id: "wine-dynamic-001" },
    create: {
      id: "wine-dynamic-001",
      businessId: business.id,
      membershipId: wineClubMembership.id,
      name: "Vintage Selection (Dynamic Pricing)",
      description: "Rare and vintage wines - price varies based on selection",
      pricingType: "DYNAMIC",
      currency: "usd",
      interval: "MONTH",
      intervalCount: 1,
      quantityPerShipment: 2,
      productType: "wine",
      setupFee: 0,
      shippingType: "INCLUDED",
      stockStatus: "AVAILABLE",
      status: "ACTIVE",
      displayOrder: 4,
    },
    update: {},
  });
  console.log("   ✅ Dynamic Wine Plan:", dynamicWinePlan.name);

  // 4. Create Beer Plans
  const monthlyBeerPlan = await prisma.plan.upsert({
    where: { id: "beer-monthly-001" },
    create: {
      id: "beer-monthly-001",
      businessId: business.id,
      membershipId: beerClubMembership.id,
      name: "Monthly Beer Box",
      description: "12 craft beers every month",
      pricingType: "FIXED",
      basePrice: 4999,  // $49.99
      currency: "usd",
      interval: "MONTH",
      intervalCount: 1,
      quantityPerShipment: 12,
      productType: "beer",
      setupFee: 0,
      shippingType: "INCLUDED",
      trialPeriodDays: 14,  // 14-day trial
      stockStatus: "AVAILABLE",
      status: "ACTIVE",
      displayOrder: 1,
    },
    update: {},
  });
  console.log("   ✅ Monthly Beer Plan:", monthlyBeerPlan.name);
  console.log("");

  // 5. Create Price Queue Items (for dynamic pricing)
  console.log("3️⃣  Creating Price Queue Items...");
  
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const twoMonths = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  await prisma.priceQueueItem.createMany({
    data: [
      {
        planId: dynamicWinePlan.id,
        effectiveAt: nextMonth,
        price: 12999,  // $129.99 next month
        applied: false,
      },
      {
        planId: dynamicWinePlan.id,
        effectiveAt: twoMonths,
        price: 14999,  // $149.99 in two months
        applied: false,
      },
    ],
    skipDuplicates: true,
  });
  console.log("   ✅ Created 2 price queue items for dynamic plan");
  console.log("");

  // 6. Create sample Consumer (if needed)
  console.log("4️⃣  Creating sample Consumer...");
  
  const consumer = await prisma.consumer.upsert({
    where: { email: "member@example.com" },
    create: {
      email: "member@example.com",
      name: "Test Member",
      phone: "+1234567890",
    },
    update: {},
  });
  console.log("   ✅ Consumer:", consumer.email);
  console.log("");

  // 7. Create sample PlanSubscriptions
  console.log("5️⃣  Creating sample PlanSubscriptions...");
  
  const subscriptionStart = new Date();
  const subscriptionEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const activeSub = await prisma.planSubscription.upsert({
    where: { id: "sub-example-001" },
    create: {
      id: "sub-example-001",
      planId: monthlyWinePlan.id,
      consumerId: consumer.id,
      stripeSubscriptionId: "sub_test_active_001",
      stripeCustomerId: "cus_test_001",
      status: "active",
      currentPeriodStart: subscriptionStart,
      currentPeriodEnd: subscriptionEnd,
      cancelAtPeriodEnd: false,
      preferences: {
        winePreference: "red",
        allergies: [],
        deliveryNotes: "Leave at front door",
      },
    },
    update: {},
  });
  console.log("   ✅ Active Subscription:", activeSub.id);

  const trialingSub = await prisma.planSubscription.upsert({
    where: { id: "sub-example-002" },
    create: {
      id: "sub-example-002",
      planId: monthlyBeerPlan.id,
      consumerId: consumer.id,
      stripeSubscriptionId: "sub_test_trialing_001",
      stripeCustomerId: "cus_test_001",
      status: "trialing",
      currentPeriodStart: subscriptionStart,
      currentPeriodEnd: subscriptionEnd,
      cancelAtPeriodEnd: false,
      preferences: {
        beerPreference: "IPA",
      },
    },
    update: {},
  });
  console.log("   ✅ Trialing Subscription:", trialingSub.id);
  console.log("");

  console.log("✨ Seeding complete!\n");
  console.log("📊 Summary:");
  console.log("   • 2 Memberships (Wine Club, Beer Club)");
  console.log("   • 5 Plans (3 wine, 1 dynamic, 1 beer)");
  console.log("   • 2 Price Queue Items");
  console.log("   • 1 Consumer");
  console.log("   • 2 PlanSubscriptions");
  console.log("");
}

seedSubscriptions()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

