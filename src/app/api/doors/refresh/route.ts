import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { fetchDoorLoopLeases } from "@/lib/doorloop";
import { calculateFilterDates } from "@/lib/airfilter-dates";

export async function POST(req: NextRequest) {
  const { error } = await requirePermission(req, "refresh_doors_data");
  if (error) return error;

  try {
    const leases = await fetchDoorLoopLeases();
    const now = new Date();

    for (const lease of leases) {
      if (!lease.property || !lease.tenants?.length) continue;

      // Upsert property
      const property = await prisma.property.upsert({
        where: { externalId: lease.property.id },
        update: {
          name: lease.property.name,
          address1: lease.property.address?.address1 ?? "",
          address2: lease.property.address?.address2,
          city: lease.property.address?.city ?? "",
          state: lease.property.address?.state ?? "",
          zip: lease.property.address?.zip ?? "",
        },
        create: {
          externalId: lease.property.id,
          name: lease.property.name,
          address1: lease.property.address?.address1 ?? "",
          address2: lease.property.address?.address2,
          city: lease.property.address?.city ?? "",
          state: lease.property.address?.state ?? "",
          zip: lease.property.address?.zip ?? "",
          occupancyStatus: "VACANT",
        },
      });

      // Upsert unit if present
      let unitId: string | null = null;
      if (lease.unit) {
        const unit = await prisma.unit.upsert({
          where: { externalId: lease.unit.id },
          update: { unitNumber: lease.unit.unitNumber ?? lease.unit.name ?? "" },
          create: {
            externalId: lease.unit.id,
            propertyId: property.id,
            unitNumber: lease.unit.unitNumber ?? lease.unit.name ?? "",
            occupancyStatus: "VACANT",
          },
        });
        unitId = unit.id;
      }

      // Upsert all tenants for this lease
      const upsertedTenantIds: string[] = [];
      for (const t of lease.tenants) {
        const tenant = await prisma.tenant.upsert({
          where: { externalId: t.id },
          update: {
            firstName: t.firstName ?? "",
            lastName: t.lastName ?? "",
            fullName: t.name ?? `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
            primaryPhone: t.phone,
            email: t.email,
          },
          create: {
            externalId: t.id,
            firstName: t.firstName ?? "",
            lastName: t.lastName ?? "",
            fullName: t.name ?? `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
            primaryPhone: t.phone,
            email: t.email,
          },
        });
        upsertedTenantIds.push(tenant.id);
      }

      // Primary tenant is the first one
      const primaryTenantId = upsertedTenantIds[0];

      // Upsert landlord if present
      let landlordId: string | null = null;
      if (lease.owner) {
        const landlord = await prisma.landlord.upsert({
          where: { externalId: lease.owner.id },
          update: {
            fullName: lease.owner.name ?? "",
            companyName: lease.owner.companyName,
            phone: lease.owner.phone,
            email: lease.owner.email,
          },
          create: {
            externalId: lease.owner.id,
            fullName: lease.owner.name ?? "",
            companyName: lease.owner.companyName,
            phone: lease.owner.phone,
            email: lease.owner.email,
            address1: lease.owner.address?.address1,
            city: lease.owner.address?.city,
            state: lease.owner.address?.state,
            zip: lease.owner.address?.zip,
          },
        });
        landlordId = landlord.id;
      }

      const isActive = lease.status === "ACTIVE";

      // Upsert lease
      const dbLease = await prisma.lease.upsert({
        where: { externalId: lease.id },
        update: {
          status: lease.status,
          startDate: new Date(lease.startDate),
          endDate: lease.endDate ? new Date(lease.endDate) : null,
          isActive,
          lastSyncedAt: now,
          tenantId: primaryTenantId,
          tenantIds: upsertedTenantIds,
          propertyId: property.id,
          unitId,
          landlordId,
        },
        create: {
          externalId: lease.id,
          propertyId: property.id,
          unitId,
          tenantId: primaryTenantId,
          tenantIds: upsertedTenantIds,
          landlordId,
          status: lease.status,
          startDate: new Date(lease.startDate),
          endDate: lease.endDate ? new Date(lease.endDate) : null,
          isActive,
          lastSyncedAt: now,
        },
      });

      // Update property occupancy
      if (isActive) {
        await prisma.property.update({
          where: { id: property.id },
          data: { occupancyStatus: "LEASED" },
        });
        if (unitId) {
          await prisma.unit.update({ where: { id: unitId }, data: { occupancyStatus: "LEASED" } });
        }
      }

      // Upsert airfilter reminder for current quarter
      if (isActive) {
        const filterDates = calculateFilterDates(new Date(lease.startDate));
        await prisma.airfilterReminder.upsert({
          where: { propertyId_quarterKey: { propertyId: property.id, quarterKey: filterDates.quarterKey } },
          update: {
            leaseId: dbLease.id,
            tenantId: primaryTenantId,
            landlordId,
            unitId,
            dueMonthKey: filterDates.dueMonthKey,
            previousFilterChangeDate: filterDates.previousFilterChangeDate,
            nextFilterChangeDate: filterDates.nextFilterChangeDate,
            dueDate: filterDates.nextFilterChangeDate,
          },
          create: {
            propertyId: property.id,
            unitId,
            leaseId: dbLease.id,
            tenantId: primaryTenantId,
            landlordId,
            quarterKey: filterDates.quarterKey,
            dueMonthKey: filterDates.dueMonthKey,
            previousFilterChangeDate: filterDates.previousFilterChangeDate,
            nextFilterChangeDate: filterDates.nextFilterChangeDate,
            dueDate: filterDates.nextFilterChangeDate,
            status: "PENDING",
          },
        });
      }
    }

    return NextResponse.json({ ok: true, count: leases.length });
  } catch (err) {
    console.error("DoorLoop sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
