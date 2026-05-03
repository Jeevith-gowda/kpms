import { prisma } from "./src/lib/prisma";

async function main() {
  const msgs = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("Last 5 messages:", JSON.stringify(msgs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
