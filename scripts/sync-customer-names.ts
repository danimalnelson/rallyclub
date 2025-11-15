import { prisma } from "@wine-club/db";
import Stripe from "stripe";

/**
 * Sync customer names from Stripe to database
 * 
 * This script fetches customer names from Stripe and updates
 * Consumer records that are missing names.
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

async function syncCustomerNames() {
  console.log("🔄 Starting customer name sync...\n");

  // Get all consumers with subscriptions but no name
  const consumersWithoutNames = await prisma.consumer.findMany({
    where: {
      name: null,
      planSubscriptions: {
        some: {},
      },
    },
    include: {
      planSubscriptions: {
        include: {
          plan: {
            include: {
              business: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  console.log(`Found ${consumersWithoutNames.length} consumers without names\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const consumer of consumersWithoutNames) {
    try {
      const subscription = consumer.planSubscriptions[0];
      if (!subscription) {
        console.log(`⚠️  ${consumer.email} - No subscriptions found`);
        skipped++;
        continue;
      }

      const stripeAccountId = subscription.plan.business.stripeAccountId;
      if (!stripeAccountId) {
        console.log(`⚠️  ${consumer.email} - No Stripe account ID`);
        skipped++;
        continue;
      }

      // Retrieve customer from Stripe (on connected account)
      const stripeCustomer = await stripe.customers.retrieve(
        subscription.stripeCustomerId,
        {
          stripeAccount: stripeAccountId,
        }
      );

      if (stripeCustomer.deleted) {
        console.log(`⚠️  ${consumer.email} - Customer deleted in Stripe`);
        skipped++;
        continue;
      }

      const customerName = stripeCustomer.name;
      const customerPhone = stripeCustomer.phone;

      if (!customerName && !customerPhone) {
        console.log(`⚠️  ${consumer.email} - No name or phone in Stripe`);
        skipped++;
        continue;
      }

      // Update consumer
      await prisma.consumer.update({
        where: { id: consumer.id },
        data: {
          ...(customerName && { name: customerName }),
          ...(customerPhone && { phone: customerPhone }),
        },
      });

      console.log(`✅ ${consumer.email} - Updated: ${customerName || "name missing"}`);
      updated++;
    } catch (error: any) {
      console.error(`❌ ${consumer.email} - Error:`, error.message);
      errors++;
    }
  }

  console.log("\n📊 Summary:");
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${consumersWithoutNames.length}`);
}

// Run the sync
syncCustomerNames()
  .then(() => {
    console.log("\n✅ Sync complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Sync failed:", error);
    process.exit(1);
  });

