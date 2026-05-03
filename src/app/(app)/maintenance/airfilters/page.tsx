"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers";
import { formatDate } from "@/lib/utils";

interface Reminder {
  id: string;
  property: { name: string; address1: string; occupancyStatus: string };
  tenant?: { fullName: string; primaryPhone?: string; email?: string };
  previousFilterChangeDate?: string;
  nextFilterChangeDate: string;
  status: string;
  lastReminderSentAt?: string;
  filterChanged: boolean;
  pauseReminders: boolean;
}

interface Summary { dueThisMonth: number; pendingReminders: number; sentToday: number; confirmedChanged: number }

function statusVariant(status: string) {
  switch (status) {
    case "CONFIRMED_CHANGED": return "success";
    case "FAILED": return "destructive";
    case "SENT": return "info";
    case "AWAITING_TENANT_CONFIRMATION": return "warning";
    default: return "secondary";
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: "Pending", SENT: "Sent",
    AWAITING_TENANT_CONFIRMATION: "Awaiting Tenant Confirmation",
    CONFIRMED_CHANGED: "Confirmed Changed", FAILED: "Failed",
    SKIPPED: "Skipped", MANUALLY_UPDATED: "Manually Updated",
  };
  return map[status] ?? status;
}

function AirfilterTable({ view }: { view: "current-month" | "all-time" }) {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [reminderStatus, setReminderStatus] = useState("all");
  const [filterChanged, setFilterChanged] = useState("all");
  const [occupancyStatus, setOccupancyStatus] = useState("all");
  const [confirmReminder, setConfirmReminder] = useState<Reminder | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const params = new URLSearchParams({ view });
  if (search) params.set("search", search);
  if (reminderStatus !== "all") params.set("reminderStatus", reminderStatus);
  if (filterChanged !== "all") params.set("filterChanged", filterChanged);
  if (occupancyStatus !== "all") params.set("occupancyStatus", occupancyStatus);

  const { data, isLoading } = useQuery<{ reminders: Reminder[]; summary: Summary }>({
    queryKey: ["airfilters", view, search, reminderStatus, filterChanged, occupancyStatus],
    queryFn: () => fetch(`/api/maintenance/airfilters?${params}`).then((r) => r.json()),
  });

  const { data: bulkPreviewData, isFetching: isFetchingBulkPreview } = useQuery<{ targets: { name: string; phone?: string; email?: string; address?: string }[] }>({
    queryKey: ["airfilters-bulk-preview"],
    queryFn: () => fetch(`/api/maintenance/airfilters/send-bulk?dryRun=true`).then((r) => r.json()),
    enabled: showBulkConfirm,
  });

  const sendMutation = useMutation({
    mutationFn: (reminderId: string) =>
      fetch(`/api/maintenance/airfilters/send/${reminderId}`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) toast.error("Reminder failed to send. Please try again.");
      else { 
        toast.success("Reminder sent successfully."); 
        qc.invalidateQueries({ queryKey: ["airfilters"] }); 
        setConfirmReminder(null);
      }
    },
    onError: () => toast.error("Reminder failed to send. Please try again."),
  });

  const filterChangedMutation = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      fetch(`/api/maintenance/airfilters/${id}/filter-changed`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filterChanged: val }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) toast.error("Status update failed. Please try again.");
      else { toast.success("Filter changed status updated successfully."); qc.invalidateQueries({ queryKey: ["airfilters"] }); }
    },
  });

  const pauseMutation = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      fetch(`/api/maintenance/airfilters/${id}/pause-reminders`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pauseReminders: val }),
      }).then((r) => r.json()),
    onSuccess: () => { toast.success("Reminder sent successfully."); qc.invalidateQueries({ queryKey: ["airfilters"] }); },
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      fetch("/api/maintenance/airfilters/send-bulk", { method: "POST" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) toast.error("Reminders failed to send. Please try again.");
      else { toast.success("Bulk reminders sent successfully."); qc.invalidateQueries({ queryKey: ["airfilters"] }); }
    },
  });

  const summary = data?.summary;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Due This Month", value: summary.dueThisMonth },
            { label: "Sent Today", value: summary.sentToday },
            { label: "Confirmed Changed", value: summary.confirmedChanged },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by property, tenant, phone, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={reminderStatus} onValueChange={setReminderStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Reminder Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Reminder Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="AWAITING_TENANT_CONFIRMATION">Awaiting Confirmation</SelectItem>
            <SelectItem value="CONFIRMED_CHANGED">Confirmed Changed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="SKIPPED">Skipped</SelectItem>
            <SelectItem value="MANUALLY_UPDATED">Manually Updated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterChanged} onValueChange={setFilterChanged}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Filter Changed" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Filter Changed</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
        <Select value={occupancyStatus} onValueChange={setOccupancyStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Occupancy Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Occupancy Status</SelectItem>
            <SelectItem value="LEASED">Leased</SelectItem>
            <SelectItem value="VACANT">Vacant</SelectItem>
          </SelectContent>
        </Select>
        {hasPermission("send_bulk_reminders") && (
          <Button
            variant="default"
            onClick={() => setShowBulkConfirm(true)}
          >
            Send All Due Reminders
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Property Name","Occupancy Status","Previous Filter Change Date","Next Filter Change Date","Reminder Status","Reminder Sent Date","Filter Changed","Actions"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : !data?.reminders?.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    {view === "current-month" ? (
                      <div>
                        <p className="text-gray-600 font-medium">No properties are due for air filter change this month.</p>
                        <p className="text-gray-400 text-sm mt-1">Switch to &ldquo;All Time&rdquo; to view all properties and filter schedules.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-600 font-medium">No airfilter records found.</p>
                        <p className="text-gray-400 text-sm mt-1">Refresh property data or verify your sync configuration.</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                data.reminders.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.property.address1}</div>
                      {r.tenant && (
                        <>
                          <div className="text-xs text-gray-500 mt-0.5">{r.tenant.fullName}</div>
                          <div className="text-xs text-gray-400">
                            {[r.tenant.primaryPhone, r.tenant.email].filter(Boolean).join(" • ")}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={r.property.occupancyStatus === "LEASED" ? "success" : "secondary"}>
                        {r.property.occupancyStatus === "LEASED" ? "Leased" : "Vacant"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.previousFilterChangeDate)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.nextFilterChangeDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.lastReminderSentAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.filterChanged ? "success" : "secondary"}>
                        {r.filterChanged ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Preview Reminder</DropdownMenuItem>
                            {hasPermission("send_reminder_manually") && (
                              <DropdownMenuItem onClick={() => setConfirmReminder(r)}>
                                Send Reminder Now
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {hasPermission("update_filter_changed_status") && (
                              <>
                                <DropdownMenuItem onClick={() => filterChangedMutation.mutate({ id: r.id, val: true })}>
                                  Mark Filter Changed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => filterChangedMutation.mutate({ id: r.id, val: false })}>
                                  Mark as Not Changed
                                </DropdownMenuItem>
                              </>
                            )}
                            {hasPermission("pause_or_resume_reminders") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => pauseMutation.mutate({ id: r.id, val: true })}>
                                  Pause Reminders
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => pauseMutation.mutate({ id: r.id, val: false })}>
                                  Resume Reminders
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            {hasPermission("view_reminder_history") && (
                              <DropdownMenuItem>View Reminder History</DropdownMenuItem>
                            )}
                            <DropdownMenuItem>Open Conversation</DropdownMenuItem>
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
      
      {/* Confirmation Dialog */}
      {confirmReminder && (
        <Dialog open={!!confirmReminder} onOpenChange={(open) => !open && setConfirmReminder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Reminder</DialogTitle>
              <DialogDescription>
                You are about to send a manual reminder for {confirmReminder.property.address1}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Tenant</h4>
                  <p className="text-sm text-gray-500">{confirmReminder.tenant?.fullName || "No tenant assigned"}</p>
                </div>
                {confirmReminder.tenant?.primaryPhone && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">SMS</h4>
                    <p className="text-sm text-gray-500">{confirmReminder.tenant.primaryPhone}</p>
                  </div>
                )}
                {confirmReminder.tenant?.email && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Email</h4>
                    <p className="text-sm text-gray-500">{confirmReminder.tenant.email}</p>
                  </div>
                )}
                {!confirmReminder.tenant?.primaryPhone && !confirmReminder.tenant?.email && (
                  <div className="rounded-md bg-yellow-50 p-4">
                    <p className="text-sm text-yellow-700">
                      Warning: This tenant has no phone or email on file. The reminder cannot be sent.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmReminder(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => sendMutation.mutate(confirmReminder.id)}
                disabled={sendMutation.isPending || (!confirmReminder.tenant?.primaryPhone && !confirmReminder.tenant?.email)}
              >
                {sendMutation.isPending ? "Sending..." : "Confirm & Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Send</DialogTitle>
            <DialogDescription>
              Are you sure you want to send all due reminders? This action will immediately send SMS and/or email reminders to the following tenants:
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50">
            {isFetchingBulkPreview ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading preview...</p>
            ) : !bulkPreviewData?.targets?.length ? (
              <p className="text-sm text-gray-500 text-center py-4">No due reminders found to send.</p>
            ) : (
              bulkPreviewData.targets.map((t, i) => (
                <div key={i} className="text-sm flex flex-col p-2 bg-white rounded border border-gray-200 shadow-sm">
                  <span className="font-medium text-gray-900">{t.name}</span>
                  <span className="text-xs text-gray-500">{t.address}</span>
                  <span className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    {[t.phone, t.email].filter(Boolean).join(" • ")}
                  </span>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                bulkMutation.mutate();
                setShowBulkConfirm(false);
              }}
              disabled={bulkMutation.isPending || isFetchingBulkPreview || !bulkPreviewData?.targets?.length}
            >
              {bulkMutation.isPending ? "Sending..." : "Confirm & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AirfiltersPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Airfilters</h1>
        <p className="mt-1 text-gray-500">Track quarterly air filter changes, send reminders, and monitor tenant confirmations.</p>
      </div>

      <Tabs defaultValue="current-month">
        <TabsList className="mb-4">
          <TabsTrigger value="current-month">Current Month</TabsTrigger>
          <TabsTrigger value="all-time">All Time</TabsTrigger>
        </TabsList>
        <TabsContent value="current-month">
          <AirfilterTable view="current-month" />
        </TabsContent>
        <TabsContent value="all-time">
          <AirfilterTable view="all-time" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
