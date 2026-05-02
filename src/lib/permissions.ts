export const PERMISSIONS = {
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_DOORS: "view_doors",
  REFRESH_DOORS_DATA: "refresh_doors_data",
  VIEW_AIRFILTERS: "view_airfilters",
  SEND_REMINDER_MANUALLY: "send_reminder_manually",
  SEND_BULK_REMINDERS: "send_bulk_reminders",
  UPDATE_FILTER_CHANGED_STATUS: "update_filter_changed_status",
  PAUSE_OR_RESUME_REMINDERS: "pause_or_resume_reminders",
  VIEW_REMINDER_HISTORY: "view_reminder_history",
  VIEW_MESSAGES: "view_messages",
  SEND_MESSAGES: "send_messages",
  VIEW_SETTINGS_GENERAL: "view_settings_general",
  VIEW_SETTINGS_ACCESS: "view_settings_access",
  MANAGE_ACCESS_SETTINGS: "manage_access_settings",
  MANAGE_USERS: "manage_users",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_dashboard: "View Dashboard",
  view_doors: "View Doors",
  refresh_doors_data: "Refresh Doors Data",
  view_airfilters: "View Airfilters",
  send_reminder_manually: "Send Reminder Manually",
  send_bulk_reminders: "Send Bulk Reminders",
  update_filter_changed_status: "Update Filter Changed Status",
  pause_or_resume_reminders: "Pause or Resume Reminders",
  view_reminder_history: "View Reminder History",
  view_messages: "View Messages",
  send_messages: "Send Messages",
  view_settings_general: "View Settings - General",
  view_settings_access: "View Settings - Access",
  manage_access_settings: "Manage Access Settings",
  manage_users: "Manage Users",
};

export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);
