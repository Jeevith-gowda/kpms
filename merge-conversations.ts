import { prisma } from "./src/lib/prisma";

async function main() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "asc" },
  });

  const merged = new Set();

  for (const conv of conversations) {
    if (merged.has(conv.id)) continue;
    
    const cleanPhone = conv.phoneNumber.replace(/\D/g, "").slice(-10);
    
    // Find duplicates for this cleanPhone
    const duplicates = await prisma.conversation.findMany({
      where: {
        id: { not: conv.id },
        phoneNumber: { contains: cleanPhone },
      },
    });

    for (const dup of duplicates) {
      console.log(`Merging ${dup.id} (${dup.phoneNumber}) into ${conv.id} (${conv.phoneNumber})`);
      
      // move messages
      await prisma.message.updateMany({
        where: { conversationId: dup.id },
        data: { conversationId: conv.id },
      });

      // update tenantId if missing
      if (!conv.tenantId && dup.tenantId) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { tenantId: dup.tenantId },
        });
      }

      // delete duplicate
      await prisma.conversation.delete({
        where: { id: dup.id },
      });

      merged.add(dup.id);
    }
  }

  console.log("Cleanup complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
