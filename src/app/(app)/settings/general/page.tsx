"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Settings {
  reminderFrequency: string;
  sendViaSms: boolean;
  sendViaEmail: boolean;
  sendMessagesAutomatically: boolean;
  sendEveryMessageToDefaultNumber: boolean;
  defaultTestPhoneNumber?: string;
}

const DEFAULTS: Settings = {
  reminderFrequency: "EVERY_DAY",
  sendViaSms: true,
  sendViaEmail: true,
  sendMessagesAutomatically: true,
  sendEveryMessageToDefaultNumber: false,
  defaultTestPhoneNumber: "",
};

export default function SettingsGeneralPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(DEFAULTS);

  const { data } = useQuery<{ settings: Settings | null }>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  useEffect(() => {
    if (data?.settings) setForm({ ...DEFAULTS, ...data.settings });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: Settings) =>
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) toast.error("Failed to save settings. Please try again.");
      else { toast.success("Settings saved successfully."); qc.invalidateQueries({ queryKey: ["settings"] }); }
    },
    onError: () => toast.error("Failed to save settings. Please try again."),
  });

  function handleSave() {
    if (!form.sendViaSms && !form.sendViaEmail) {
      toast.error("At least one reminder channel must be enabled.");
      return;
    }
    saveMutation.mutate(form);
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-gray-500">Configure reminder delivery, automation, and testing options.</p>
      </div>

      <div className="space-y-8">
        {/* Reminder Frequency */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Reminder Frequency</h2>
          <div className="space-y-2">
            <Label htmlFor="frequency">Send Reminder Frequency</Label>
            <Select
              value={form.reminderFrequency}
              onValueChange={(v) => setForm((f) => ({ ...f, reminderFrequency: v }))}
            >
              <SelectTrigger id="frequency" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EVERY_DAY">Every Day</SelectItem>
                <SelectItem value="EVERY_2_DAYS">Every 2 Days</SelectItem>
                <SelectItem value="EVERY_3_DAYS">Every 3 Days</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Reminder Channels */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Reminder Channels</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="sms-toggle">Send via SMS</Label>
              <Switch
                id="sms-toggle"
                checked={form.sendViaSms}
                onCheckedChange={(v) => setForm((f) => ({ ...f, sendViaSms: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-toggle">Send via Email</Label>
              <Switch
                id="email-toggle"
                checked={form.sendViaEmail}
                onCheckedChange={(v) => setForm((f) => ({ ...f, sendViaEmail: v }))}
              />
            </div>
          </div>
        </section>

        {/* Automatic Sending */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Automatic Sending</h2>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-toggle">Send Messages Automatically</Label>
            <Switch
              id="auto-toggle"
              checked={form.sendMessagesAutomatically}
              onCheckedChange={(v) => setForm((f) => ({ ...f, sendMessagesAutomatically: v }))}
            />
          </div>
        </section>

        {/* Test Routing */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Test Routing</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="test-routing-toggle">Send Every Message to Default Number</Label>
              <Switch
                id="test-routing-toggle"
                checked={form.sendEveryMessageToDefaultNumber}
                onCheckedChange={(v) => setForm((f) => ({ ...f, sendEveryMessageToDefaultNumber: v }))}
              />
            </div>
            {form.sendEveryMessageToDefaultNumber && (
              <div className="space-y-2">
                <Label htmlFor="test-phone">Default Test Phone Number</Label>
                <Input
                  id="test-phone"
                  placeholder="Enter default phone number"
                  value={form.defaultTestPhoneNumber ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, defaultTestPhoneNumber: e.target.value }))}
                  className="max-w-xs"
                />
              </div>
            )}
          </div>
        </section>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
          <Button variant="outline" onClick={() => setForm(DEFAULTS)}>
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}
