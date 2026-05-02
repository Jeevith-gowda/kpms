"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers";
import { formatDate, formatDateTime } from "@/lib/utils";

interface TenantInfo {
  id: string;
  fullName: string;
  primaryPhone?: string;
  email?: string;
}

interface LeaseRow {
  id: string;
  property: { id: string; name: string; address1: string; address2?: string; city: string; state: string; zip: string; occupancyStatus: string; updatedAt: string };
  unit?: { unitNumber: string };
  tenant: TenantInfo;
  tenants?: TenantInfo[];
  landlord?: { fullName: string; phone?: string; email?: string };
  startDate: string;
  endDate?: string;
  lastSyncedAt?: string;
  isActive: boolean;
}

export default function DoorsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ leases: LeaseRow[] }>({
    queryKey: ["doors"],
    queryFn: () => fetch("/api/doors").then((r) => r.json()),
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetch("/api/doors/refresh", { method: "POST" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) {
        toast.error("DoorLoop sync failed. Please try again.");
      } else {
        toast.success("DoorLoop sync completed successfully.");
        qc.invalidateQueries({ queryKey: ["doors"] });
      }
    },
    onError: () => toast.error("DoorLoop sync failed. Please try again."),
  });

  const lastSynced = data?.leases?.[0]?.lastSyncedAt;

  const [search, setSearch] = useState("");

  const filteredLeases = useMemo(() => {
    if (!data?.leases) return [];
    if (!search.trim()) return data.leases;
    const q = search.toLowerCase();
    return data.leases.filter((lease) => {
      const allTenants = lease.tenants?.length ? lease.tenants : (lease.tenant ? [lease.tenant] : []);
      return (
        lease.property.address1?.toLowerCase().includes(q) ||
        lease.property.city?.toLowerCase().includes(q) ||
        lease.property.state?.toLowerCase().includes(q) ||
        lease.property.zip?.toLowerCase().includes(q) ||
        lease.property.name?.toLowerCase().includes(q) ||
        allTenants.some((t) =>
          t.fullName?.toLowerCase().includes(q) ||
          t.primaryPhone?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q)
        ) ||
        lease.landlord?.fullName?.toLowerCase().includes(q) ||
        lease.landlord?.phone?.toLowerCase().includes(q) ||
        lease.landlord?.email?.toLowerCase().includes(q)
      );
    });
  }, [data?.leases, search]);

  const totalCount = data?.leases?.length ?? 0;
  const filteredCount = filteredLeases.length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doors</h1>
          <p className="mt-1 text-gray-500">View and manage properties, tenants, landlords, and occupancy status.</p>
          <div className="flex items-center gap-4 mt-1">
            {totalCount > 0 && (
              <span className="text-sm font-medium text-gray-700">
                Total: <span className="text-indigo-600 font-semibold">{totalCount}</span> {totalCount === 1 ? "lease" : "leases"}
                {search.trim() && filteredCount !== totalCount && (
                  <span className="text-gray-400 ml-1">(showing {filteredCount})</span>
                )}
              </span>
            )}
            {lastSynced && (
              <span className="text-xs text-gray-400">Last refreshed: {formatDateTime(lastSynced)}</span>
            )}
          </div>
        </div>
        {hasPermission("refresh_doors_data") && (
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            {refreshMutation.isPending ? "Syncing..." : "Refresh from DoorLoop"}
          </Button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by address, tenant, landlord, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Property Address","Tenant Name","Tenant Phone","Tenant Email","Landlord Name","Occupancy Status","Lease Start Date","Lease End Date","Last Synced","Actions"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading...</td>
                </tr>
              ) : !filteredLeases.length ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    {search.trim() ? "No results match your search." : "No properties found. Refresh from DoorLoop to sync data."}
                  </td>
                </tr>
              ) : (
                filteredLeases.map((lease) => {
                  // Use tenants array if available, otherwise fall back to single tenant
                  const allTenants = lease.tenants?.length ? lease.tenants : (lease.tenant ? [lease.tenant] : []);

                  return (
                    <tr key={lease.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{lease.property.address1}, {lease.property.city}, {lease.property.state} {lease.property.zip}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {allTenants.map((t, idx) => (
                            <div key={t.id || idx} className={idx > 0 ? "border-t border-gray-100 pt-1" : ""}>
                              <div className="text-gray-900 font-medium">{t.fullName}</div>
                            </div>
                          ))}
                          {!allTenants.length && <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {allTenants.map((t, idx) => (
                            <div key={t.id || idx} className={`text-gray-600 ${idx > 0 ? "border-t border-gray-100 pt-1" : ""}`}>
                              {t.primaryPhone ?? "—"}
                            </div>
                          ))}
                          {!allTenants.length && <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {allTenants.map((t, idx) => (
                            <div key={t.id || idx} className={`text-gray-600 ${idx > 0 ? "border-t border-gray-100 pt-1" : ""}`}>
                              {t.email ?? "—"}
                            </div>
                          ))}
                          {!allTenants.length && <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900 font-medium">{lease.landlord?.fullName ?? "—"}</div>
                        {lease.landlord?.phone && (
                          <div className="text-xs text-gray-500 mt-0.5">{lease.landlord.phone}</div>
                        )}
                        {lease.landlord?.email && (
                          <div className="text-xs text-gray-500 mt-0.5">{lease.landlord.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={lease.property.occupancyStatus === "LEASED" ? "success" : "secondary"}>
                          {lease.property.occupancyStatus === "LEASED" ? "Leased" : "Vacant"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(lease.startDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(lease.endDate)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{formatDateTime(lease.lastSyncedAt)}</td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Property Details</DropdownMenuItem>
                            <DropdownMenuItem>View Tenant Details</DropdownMenuItem>
                            <DropdownMenuItem>View Landlord Details</DropdownMenuItem>
                            <DropdownMenuItem>Open Conversation</DropdownMenuItem>
                            <DropdownMenuItem>View Airfilter History</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
