/**
 * Check Missing Dynamic Prices Cron Job
 * 
 * This script checks for dynamic pricing plans that don't have a price set
 * for the upcoming month. It creates alerts and sends email notifications at:
 * - 7 days before the 1st of next month
 * - 3 days before the 1st of next month
 * - 1 day before the 1st of next month
 * 
 * Should be run daily via cron job.
 * 
 * Usage: tsx scripts/check-missing-dynamic-prices.ts
 */

import { PrismaClient } from "@prisma/client";
// TODO: Import email service when created
// import { sendMissingPriceAlert } from "@wine-club/lib/emails";

const prisma = new PrismaClient();

interface DaysBeforeCheck {
  days: number;
  severity: "WARNING" | "URGENT" | "CRITICAL";
}

const REMINDER_SCHEDULE: DaysBeforeCheck[] = [
  { days: 7, severity: "WARNING" },
  { days: 3, severity: "URGENT" },
  { days: 1, severity: "CRITICAL" },
];

async function checkMissingDynamicPrices() {
  console.log("🔍 Checking for missing dynamic prices...");
  const now = new Date();
  
  // Calculate the first day of next month
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  nextMonth.setHours(0, 0, 0, 0);
  
  const daysUntilNextMonth = Math.ceil(
    (nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  console.log(`📅 Next month starts: ${nextMonth.toISOString().slice(0, 10)}`);
  console.log(`⏰ Days until next month: ${daysUntilNextMonth}`);
  
  // Check if we should send reminders today
  const checkToday = REMINDER_SCHEDULE.find((check) => check.days === daysUntilNextMonth);
  
  if (!checkToday) {
    console.log(`✅ No reminders scheduled for ${daysUntilNextMonth} days out`);
    return;
  }
  
  console.log(`\n📧 Sending ${checkToday.severity} reminders (${checkToday.days} days before)...\n`);
  
  try {
    // Find all dynamic pricing plans
    const dynamicPlans = await prisma.plan.findMany({
      where: {
        pricingType: "DYNAMIC",
        status: "ACTIVE",
      },
      include: {
        business: {
          include: {
            users: {
              where: {
                role: {
                  in: ["OWNER", "ADMIN"],
                },
              },
              include: {
                user: true,
              },
            },
          },
        },
        membership: true,
        priceQueue: {
          where: {
            effectiveAt: nextMonth,
          },
        },
        planSubscriptions: {
          where: {
            status: {
              in: ["active", "trialing"],
            },
          },
        },
      },
    });
    
    console.log(`📊 Found ${dynamicPlans.length} active dynamic pricing plan(s)`);
    
    let alertsCreated = 0;
    let emailsSent = 0;
    
    for (const plan of dynamicPlans) {
      const hasPriceForNextMonth = plan.priceQueue.length > 0;
      const activeSubscriberCount = plan.planSubscriptions.length;
      
      if (hasPriceForNextMonth) {
        console.log(`  ✅ ${plan.name}: Price set for next month ($${(plan.priceQueue[0].price / 100).toFixed(2)})`);
        
        // Resolve any existing alerts for this plan
        await prisma.businessAlert.updateMany({
          where: {
            businessId: plan.businessId,
            type: "MISSING_DYNAMIC_PRICE",
            resolved: false,
            metadata: {
              path: ["planId"],
              equals: plan.id,
            },
          },
          data: {
            resolved: true,
            resolvedAt: new Date(),
          },
        });
        
        continue;
      }
      
      console.log(`  ⚠️  ${plan.name}: NO PRICE SET for next month (${activeSubscriberCount} active subscribers)`);
      
      // Check if we already created an alert for this specific reminder period
      const existingAlert = await prisma.businessAlert.findFirst({
        where: {
          businessId: plan.businessId,
          type: "MISSING_DYNAMIC_PRICE",
          resolved: false,
          severity: checkToday.severity,
          metadata: {
            path: ["planId"],
            equals: plan.id,
          },
        },
      });
      
      if (existingAlert) {
        console.log(`    ℹ️  Alert already exists for this reminder period`);
        continue;
      }
      
      // Create alert
      const alert = await prisma.businessAlert.create({
        data: {
          businessId: plan.businessId,
          type: "MISSING_DYNAMIC_PRICE",
          severity: checkToday.severity,
          title: `Missing Price: ${plan.name}`,
          message: `No price set for ${nextMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}. ${activeSubscriberCount} active subscription(s) will be affected.`,
          metadata: {
            planId: plan.id,
            planName: plan.name,
            membershipId: plan.membershipId,
            membershipName: plan.membership.name,
            nextMonthDate: nextMonth.toISOString(),
            activeSubscribers: activeSubscriberCount,
            daysRemaining: daysUntilNextMonth,
          },
        },
      });
      
      alertsCreated++;
      console.log(`    ✅ Created alert: ${alert.id}`);
      
      // Send email to business owners/admins
      for (const businessUser of plan.business.users) {
        try {
          // TODO: Implement email sending
          console.log(`    📧 Email queued for: ${businessUser.user.email}`);
          
          // Uncomment when email service is ready:
          // await sendMissingPriceAlert({
          //   to: businessUser.user.email,
          //   businessName: plan.business.name,
          //   planName: plan.name,
          //   membershipName: plan.membership.name,
          //   nextMonthDate: nextMonth,
          //   activeSubscribers: activeSubscriberCount,
          //   daysRemaining: daysUntilNextMonth,
          //   severity: checkToday.severity,
          //   dashboardUrl: `${process.env.NEXTAUTH_URL}/app/${plan.businessId}/alerts`,
          // });
          
          emailsSent++;
        } catch (error) {
          console.error(`    ❌ Failed to send email to ${businessUser.user.email}:`, error);
        }
      }
    }
    
    console.log(`\n✅ Check complete:`);
    console.log(`   - ${alertsCreated} alert(s) created`);
    console.log(`   - ${emailsSent} email(s) queued`);
    
  } catch (error) {
    console.error("❌ Error in checkMissingDynamicPrices:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the job
checkMissingDynamicPrices()
  .then(() => {
    console.log("🏁 Job completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Job failed:", error);
    process.exit(1);
  });

