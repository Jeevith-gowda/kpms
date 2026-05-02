const DOORLOOP_API_URL = "https://app.doorloop.com/api";

// ---------- Shared helpers ----------

function getApiKey(): string {
  const apiKey = process.env.DOORLOOP_API_KEY;
  if (!apiKey) throw new Error("DOORLOOP_API_KEY not configured");
  return apiKey;
}

async function doorloopGet<T>(path: string): Promise<T> {
  const res = await fetch(`${DOORLOOP_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`DoorLoop API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Paginate through a DoorLoop list endpoint, collecting all items. */
async function doorloopGetAll<T>(basePath: string): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const sep = basePath.includes("?") ? "&" : "?";
    const resp = await doorloopGet<{ data: T[]; total?: number }>(
      `${basePath}${sep}limit=${limit}&offset=${offset}`
    );
    if (!resp.data?.length) break;
    items.push(...resp.data);
    offset += resp.data.length;
    if (resp.total != null && offset >= resp.total) break;
    if (resp.data.length < limit) break;
  }
  return items;
}

// ---------- Raw DoorLoop types ----------

interface DLLease {
  id: string;
  property: string;          // property ID
  units?: string[];          // unit IDs
  name?: string;             // tenant display name on the lease
  start: string;
  end?: string;
  status: string;
}

interface DLProperty {
  id: string;
  name: string;
  address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  owners?: { owner: string; ownershipPercentage?: number }[];
}

interface DLUnit {
  id: string;
  name?: string;
  unitNumber?: string;
  property: string;
}

interface DLTenant {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  fullName?: string;
  phones?: { type?: string; number?: string }[];
  emails?: { type?: string; address?: string }[];
  e164PhoneMobileNumber?: string;
}

interface DLOwner {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  fullName?: string;
  companyName?: string;
  phones?: { type?: string; number?: string }[];
  emails?: { type?: string; address?: string }[];
  primaryAddress?: {
    street1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

// ---------- Enriched output type ----------

export interface DoorLoopLease {
  id: string;
  status: string;
  startDate: string;
  endDate?: string;
  property?: {
    id: string;
    name: string;
    address?: {
      address1?: string;
      address2?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
  unit?: {
    id: string;
    name?: string;
    unitNumber?: string;
  };
  tenants: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
    email?: string;
  }[];
  owner?: {
    id: string;
    name?: string;
    companyName?: string;
    phone?: string;
    email?: string;
    address?: {
      address1?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
}

// ---------- Main fetch function ----------

export async function fetchDoorLoopLeases(): Promise<DoorLoopLease[]> {
  // 1. Fetch all active leases
  const leases = await doorloopGetAll<DLLease>(
    "/leases?filter_status=ACTIVE&period=all-time&period_startDate=all-time&period_endDate=all-time"
  );

  // 2. Collect unique IDs we need to resolve
  const propertyIds = [...new Set(leases.map((l) => l.property))];
  const unitIds = [...new Set(leases.flatMap((l) => l.units ?? []))];

  // 3. Fetch all properties and units in bulk
  const [allProperties, allUnits] = await Promise.all([
    doorloopGetAll<DLProperty>("/properties"),
    doorloopGetAll<DLUnit>("/units"),
  ]);

  const propMap = new Map(allProperties.map((p) => [p.id, p]));
  const unitMap = new Map(allUnits.map((u) => [u.id, u]));

  // 4. Fetch tenants per lease (using filter_lease) — returns ALL tenants per lease
  const ownerIdsToFetch = new Set<string>();
  const leaseTenantsMap = new Map<string, DLTenant[]>();

  // Batch tenant lookups (parallel, 10 at a time to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < leases.length; i += batchSize) {
    const batch = leases.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (lease) => {
        try {
          const resp = await doorloopGet<{ data: DLTenant[] }>(
            `/tenants?filter_lease=${lease.id}&limit=50`
          );
          return { leaseId: lease.id, tenants: resp.data ?? [] };
        } catch {
          return { leaseId: lease.id, tenants: [] };
        }
      })
    );
    for (const r of results) {
      leaseTenantsMap.set(r.leaseId, r.tenants);
    }
  }

  // Collect owner IDs from properties
  for (const pid of propertyIds) {
    const prop = propMap.get(pid);
    if (prop?.owners) {
      for (const o of prop.owners) {
        ownerIdsToFetch.add(o.owner);
      }
    }
  }

  // 5. Fetch owners in bulk
  const allOwners = await doorloopGetAll<DLOwner>("/owners");
  const ownerMap = new Map(allOwners.map((o) => [o.id, o]));

  // 6. Assemble enriched leases
  return leases.map((lease) => {
    const prop = propMap.get(lease.property);
    const unitId = lease.units?.[0];
    const unit = unitId ? unitMap.get(unitId) : undefined;
    const tenants = leaseTenantsMap.get(lease.id) ?? [];

    // Find first owner of the property
    const ownerRef = prop?.owners?.[0];
    const owner = ownerRef ? ownerMap.get(ownerRef.owner) : undefined;

    return {
      id: lease.id,
      status: lease.status,
      startDate: lease.start,
      endDate: lease.end,
      property: prop
        ? {
            id: prop.id,
            name: prop.name,
            address: {
              address1: prop.address?.street1,
              address2: prop.address?.street2,
              city: prop.address?.city,
              state: prop.address?.state,
              zip: prop.address?.zip,
            },
          }
        : undefined,
      unit: unit
        ? {
            id: unit.id,
            name: unit.name,
            unitNumber: unit.unitNumber || unit.name,
          }
        : undefined,
      tenants: tenants.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        name: t.fullName || t.name,
        phone:
          t.e164PhoneMobileNumber ||
          t.phones?.find((p) => p.number)?.number,
        email: t.emails?.find((e) => e.address)?.address,
      })),
      owner: owner
        ? {
            id: owner.id,
            name: owner.fullName || owner.name,
            companyName: undefined,
            phone: owner.phones?.find((p) => p.number)?.number,
            email: owner.emails?.find((e) => e.address)?.address,
            address: owner.primaryAddress
              ? {
                  address1: owner.primaryAddress.street1,
                  city: owner.primaryAddress.city,
                  state: owner.primaryAddress.state,
                  zip: owner.primaryAddress.zip,
                }
              : undefined,
          }
        : undefined,
    };
  });
}
