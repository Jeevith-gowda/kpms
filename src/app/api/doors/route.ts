import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, "view_doors");
  if (error) return error;

  const leases = await prisma.lease.findMany({ orderBy: { createdAt: "desc" } });

  const propertyIds = [...new Set(leases.map((l) => l.propertyId))];
  const unitIds = [...new Set(leases.filter((l) => l.unitId).map((l) => l.unitId!))];
  const tenantIds = [...new Set(leases.map((l) => l.tenantId))];
  const landlordIds = [...new Set(leases.filter((l) => l.landlordId).map((l) => l.landlordId!))];

  const [properties, units, tenants, landlords] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } } }),
    prisma.unit.findMany({ where: { id: { in: unitIds } } }),
    prisma.tenant.findMany({ where: { id: { in: tenantIds } } }),
    prisma.landlord.findMany({ where: { id: { in: landlordIds } } }),
  ]);

  const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));
  const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));
  const landlordMap = Object.fromEntries(landlords.map((l) => [l.id, l]));

  const enriched = leases.map((l) => ({
    ...l,
    property: propMap[l.propertyId],
    unit: l.unitId ? unitMap[l.unitId] : null,
    tenant: tenantMap[l.tenantId],
    landlord: l.landlordId ? landlordMap[l.landlordId] : null,
  }));

  return NextResponse.json({ leases: enriched });
}
