"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers";
import { formatDate, formatDateTime } from "@/lib/utils";

interface LeaseRow {
  id: string;
  property: { id: string; name: string; address1: string; address2?: string; city: string; state: string; zip: string; occupancyStatus: string; updatedAt: string };
  unit?: { unitNumber: string };
  tenant: { id: string; fullName: string; primaryPhone?: string };
  landlord?: { fullName: string };
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doors</h1>
          <p className="mt-1 text-gray-500">View and manage properties, tenants, landlords, and occupancy status.</p>
          {lastSynced && (
            <p className="text-xs text-gray-400 mt-1">Last refreshed: {formatDateTime(lastSynced)}</p>
          )}
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

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Property Name","Property Address","Unit / Suite","Tenant Name","Tenant Phone","Landlord Name","Occupancy Status","Lease Start Date","Lease End Date","Last Synced","Actions"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">Loading...</td>
                </tr>
              ) : !data?.leases?.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">No properties found. Refresh from DoorLoop to sync data.</td>
                </tr>
              ) : (
                data.leases.map((lease) => (
                  <tr key={lease.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{lease.property.name}</td>
                    <td className="px-4 py-3 text-gray-600">{lease.property.address1}, {lease.property.city}, {lease.property.state} {lease.property.zip}</td>
                    <td className="px-4 py-3 text-gray-600">{lease.unit?.unitNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-900">{lease.tenant?.fullName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{lease.tenant?.primaryPhone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{lease.landlord?.fullName ?? "—"}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
