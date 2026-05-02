const DOORLOOP_API_URL = "https://app.doorloop.com/api";

interface DoorLoopLease {
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
  tenant?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
    email?: string;
  };
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

interface DoorLoopResponse {
  data: DoorLoopLease[];
  total?: number;
}

export async function fetchDoorLoopLeases(): Promise<DoorLoopLease[]> {
  const apiKey = process.env.DOORLOOP_API_KEY;
  if (!apiKey) throw new Error("DOORLOOP_API_KEY not configured");

  const url = `${DOORLOOP_API_URL}/leases?filter_status=ACTIVE&period=all-time&period_startDate=all-time&period_endDate=all-time`;

  const res = await fetch(url, {
    headers: { Authorization: apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`DoorLoop API error: ${res.status} ${res.statusText}`);
  }

  const json: DoorLoopResponse = await res.json();
  return json.data ?? [];
}

export type { DoorLoopLease };
