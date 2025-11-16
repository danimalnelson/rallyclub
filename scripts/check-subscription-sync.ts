import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

async function checkSubscriptionSync() {
  const email = "dannelson@icloud.com";
  const business = await prisma.business.findUnique({
    where: { slug: "the-ruby-tap" },
  });

  if (!business || !business.stripeAccountId) {
    console.error("Business not found or no Stripe account");
    return;
  }

  console.log(`\n🔍 Checking subscriptions for ${email}\n`);

  // Get from database
  const consumer = await prisma.consumer.findUnique({
    where: { email },
  });

  if (!consumer) {
    console.error("Consumer not found");
    return;
  }

  const dbSubscriptions = await prisma.planSubscription.findMany({
    where: {
      consumerId: consumer.id,
      plan: { businessId: business.id },
    },
    include: { plan: true },
  });

  console.log(`📊 Database: ${dbSubscriptions.length} PlanSubscriptions`);
  dbSubscriptions.forEach((sub) => {
    console.log(
      `  - ${sub.stripeSubscriptionId}: ${sub.status} (${sub.plan.name})`
    );
  });

  // Get from Stripe
  const stripe = getStripeClient(business.stripeAccountId);
  const stripeCustomers = await stripe.customers.list({
    email: email,
    limit: 100,
  });

  console.log(`\n💳 Stripe: ${stripeCustomers.data.length} Customers`);

  let totalStripeSubs = 0;
  for (const customer of stripeCustomers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 100,
    });

    if (subs.data.length > 0) {
      console.log(`  Customer ${customer.id}:`);
      subs.data.forEach((sub) => {
        totalStripeSubs++;
        const inDb = dbSubscriptions.find(
          (dbSub) => dbSub.stripeSubscriptionId === sub.id
        );
        console.log(
          `    - ${sub.id}: ${sub.status} ${inDb ? "✅ IN DB" : "❌ MISSING FROM DB"}`
        );
      });
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`  Stripe Total: ${totalStripeSubs} subscriptions`);
  console.log(`  Database Total: ${dbSubscriptions.length} subscriptions`);
  console.log(`  Missing: ${totalStripeSubs - dbSubscriptions.length}`);
}

checkSubscriptionSync()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

