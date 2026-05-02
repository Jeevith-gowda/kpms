import { prisma } from "./prisma";
import { ALL_PERMISSION_KEYS, PERMISSION_LABELS } from "./permissions";

export async function seedPermissions() {
  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { permissionKey: key },
      update: { permissionLabel: PERMISSION_LABELS[key] },
      create: { permissionKey: key, permissionLabel: PERMISSION_LABELS[key] },
    });

    await prisma.rolePermission.upsert({
      where: { role_permissionKey: { role: "ADMIN", permissionKey: key } },
      update: { isEnabled: true },
      create: { role: "ADMIN", permissionKey: key, isEnabled: true },
    });

    const employeeDefault = [
      "view_dashboard", "view_doors", "view_airfilters",
      "view_messages", "view_settings_general",
    ].includes(key);

    await prisma.rolePermission.upsert({
      where: { role_permissionKey: { role: "EMPLOYEE", permissionKey: key } },
      update: {},
      create: { role: "EMPLOYEE", permissionKey: key, isEnabled: employeeDefault },
    });
  }
}

export async function bootstrapAdmin() {
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME ?? "karma";
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) return;

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" } });
  if (existingAdmin) return;

  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash(adminPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      passwordHash: hash,
      role: "ADMIN",
      status: "ACTIVE",
      mustChangePassword: true,
    },
  });

  console.log(`[bootstrap] Admin user created: ${user.email} (id: ${user.id})`);
}
