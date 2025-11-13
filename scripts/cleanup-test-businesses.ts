import { prisma } from '@wine-club/db';

async function cleanup() {
  const email = 'dannelson@icloud.com';
  
  console.log('\n🔍 Finding user and businesses...\n');
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      businesses: {
        include: {
          business: {
            include: {
              _count: {
                select: {
                  members: true,
                  membershipPlans: true,
                  transactions: true,
                  auditLogs: true,
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    console.log('❌ No user found with email:', email);
    return;
  }

  console.log('✅ Found user:', user.email);
  console.log('   User ID:', user.id);
  console.log('   Businesses:', user.businesses.length);
  console.log('');

  if (user.businesses.length === 0) {
    console.log('✅ No businesses to clean up');
    return;
  }

  console.log('📋 Businesses to delete:\n');
  user.businesses.forEach((bu, i) => {
    const b = bu.business;
    console.log(`${i + 1}. ${b.name || 'Unnamed'}`);
    console.log(`   ID: ${b.id}`);
    console.log(`   Status: ${b.status}`);
    console.log(`   Stripe Account: ${b.stripeAccountId || 'None'}`);
    console.log(`   Members: ${b._count.members}`);
    console.log(`   Plans: ${b._count.membershipPlans}`);
    console.log(`   Transactions: ${b._count.transactions}`);
    console.log('');
  });

  console.log('🗑️  Starting cleanup...\n');

  for (const bu of user.businesses) {
    const businessId = bu.business.id;
    const businessName = bu.business.name || 'Unnamed';
    
    console.log(`   Deleting: ${businessName} (${businessId})`);

    // Delete in order to respect foreign key constraints
    await prisma.auditLog.deleteMany({ where: { businessId } });
    await prisma.transaction.deleteMany({ where: { businessId } });
    await prisma.membershipPlan.deleteMany({ where: { businessId } });
    await prisma.member.deleteMany({ where: { businessId } });
    await prisma.businessUser.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    
    console.log(`   ✅ Deleted: ${businessName}`);
  }

  console.log('\n✅ Cleanup complete!\n');
  console.log('📊 Final state:');
  console.log(`   User: ${user.email} - KEPT ✅`);
  console.log(`   Businesses: ${user.businesses.length} deleted ✅`);
  console.log('\n🎉 Ready for fresh testing!\n');
}

cleanup()
  .catch((error) => {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

