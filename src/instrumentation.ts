export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapAdmin, seedPermissions } = await import("./lib/seed-permissions");
    const { startScheduler } = await import("./lib/scheduler");
    await seedPermissions().catch(console.error);
    await bootstrapAdmin().catch(console.error);
    startScheduler();
  }
}
