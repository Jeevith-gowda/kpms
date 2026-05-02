"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { PERMISSION_LABELS, ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/components/providers";

interface User { id: string; name: string; email: string; role: string; status: string; lastLoginAt?: string }
interface RolePermission { role: string; permissionKey: string; isEnabled: boolean }

export default function AccessPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [employeePerms, setEmployeePerms] = useState<string[]>([]);

  const { data } = useQuery<{ users: User[]; rolePermissions: RolePermission[] }>({
    queryKey: ["access"],
    queryFn: () => fetch("/api/settings/access").then((r) => r.json()),
  });

  useEffect(() => {
    if (data?.rolePermissions) {
      const ep = data.rolePermissions
        .filter((rp) => rp.role === "EMPLOYEE" && rp.isEnabled)
        .map((rp) => rp.permissionKey);
      setEmployeePerms(ep);
    }
  }, [data]);

  const savePermsMutation = useMutation({
    mutationFn: (perms: string[]) =>
      fetch("/api/settings/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeePermissions: perms }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) toast.error("Failed to save access settings. Please try again.");
      else { toast.success("Access settings saved successfully."); qc.invalidateQueries({ queryKey: ["access"] }); }
    },
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).then((r) => r.json()),
    onSuccess: () => { toast.success("Role updated."); qc.invalidateQueries({ queryKey: ["access"] }); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) toast.error(res.error);
      else { toast.success("User status updated."); qc.invalidateQueries({ queryKey: ["access"] }); }
    },
  });

  if (me?.role !== "ADMIN") {
    return (
      <div className="p-8">
        <p className="text-gray-500">Access denied. Only administrators can view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Access</h1>
        <p className="mt-1 text-gray-500">Manage user roles and configure access to system features.</p>
      </div>

      {/* Users and Roles */}
      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Users and Roles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["User Name","Email Address","Role","Status","Last Login","Actions"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.users?.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"} className="capitalize">
                      {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.status === "ACTIVE" ? "success" : "secondary"}>
                      {u.status === "ACTIVE" ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    {u.id !== me?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit Access</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              roleChangeMutation.mutate({
                                userId: u.id,
                                role: u.role === "ADMIN" ? "EMPLOYEE" : "ADMIN",
                              })
                            }
                          >
                            Change Role
                          </DropdownMenuItem>
                          {u.status === "ACTIVE" ? (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => statusMutation.mutate({ userId: u.id, status: "INACTIVE" })}
                            >
                              Deactivate User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => statusMutation.mutate({ userId: u.id, status: "ACTIVE" })}
                            >
                              Activate User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Feature Access Matrix */}
      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Feature Access</h2>
          <p className="text-sm text-gray-500 mt-1">Configure which features are available to each role.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Permission</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Admin</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ALL_PERMISSION_KEYS.map((key) => (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{PERMISSION_LABELS[key as PermissionKey]}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-green-600 font-medium">✓</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={employeePerms.includes(key)}
                      onChange={(e) => {
                        setEmployeePerms((prev) =>
                          e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)
                        );
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <Button onClick={() => savePermsMutation.mutate(employeePerms)} disabled={savePermsMutation.isPending}>
            {savePermsMutation.isPending ? "Saving..." : "Save Access Settings"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setEmployeePerms(["view_dashboard","view_doors","view_airfilters","view_messages","view_settings_general"])
            }
          >
            Reset Access Defaults
          </Button>
        </div>
      </section>
    </div>
  );
}
