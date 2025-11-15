import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");
  console.log("📝 This seed only creates user accounts for authentication.");
  console.log("📝 Businesses, memberships, and plans should be created through the UI.");
  console.log("");

  // Create owner user for testing
  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      email: "owner@example.com",
      name: "Test Owner",
    },
  });

  console.log("✅ Seed complete!");
  console.log("");
  console.log("👤 Test User Created:");
  console.log("   Email: owner@example.com");
  console.log("");
  console.log("📋 Next Steps:");
  console.log("   1. Sign in at /auth/signin with owner@example.com");
  console.log("   2. Complete onboarding at /onboarding");
  console.log("   3. Connect your Stripe account");
  console.log("   4. Create memberships at /app/[businessId]/memberships/create");
  console.log("   5. Create plans at /app/[businessId]/plans/create");
  console.log("   6. Test consumer flow at /[slug]");
  console.log("");
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

