"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, DoorOpen, Wrench, MessageSquare, Settings,
  Filter, ChevronDown, ChevronRight, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers";
import { toast } from "sonner";
import { useState } from "react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  permission?: string;
  children?: { label: string; href: string; permission?: string; icon?: React.ReactNode }[];
}

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function Sidebar({ mobileOpen = false, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const [maintenanceOpen, setMaintenanceOpen] = useState(pathname.startsWith("/maintenance"));
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/settings"));

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, permission: "view_dashboard" },
    { label: "Doors", href: "/doors", icon: <DoorOpen className="h-4 w-4" />, permission: "view_doors" },
    {
      label: "Maintenance",
      icon: <Wrench className="h-4 w-4" />,
      children: [
        { label: "Airfilters", href: "/maintenance/airfilters", icon: <Filter className="h-3 w-3" />, permission: "view_airfilters" },
      ],
    },
    { label: "Messages", href: "/messages", icon: <MessageSquare className="h-4 w-4" />, permission: "view_messages" },
    {
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
      children: [
        { label: "General", href: "/settings/general", permission: "view_settings_general" },
        { label: "Access", href: "/settings/access", permission: "view_settings_access" },
      ],
    },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    toast.success("Signed out successfully.");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function handleLinkClick() {
    if (setMobileOpen) setMobileOpen(false);
  }

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-gray-100 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
      mobileOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="px-4 py-5 border-b border-gray-700 flex items-center justify-between">
        <h1 className="text-sm font-bold text-white leading-tight">Property Management Portal</h1>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          if (item.permission && !hasPermission(item.permission)) return null;

          if (item.children) {
            const visibleChildren = item.children.filter(
              (c) => !c.permission || hasPermission(c.permission)
            );
            if (visibleChildren.length === 0) return null;

            const isExpanded =
              item.label === "Maintenance" ? maintenanceOpen : settingsOpen;
            const toggle = item.label === "Maintenance"
              ? () => setMaintenanceOpen((v) => !v)
              : () => setSettingsOpen((v) => !v);

            return (
              <div key={item.label}>
                <button
                  onClick={toggle}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {item.icon}
                    {item.label}
                  </span>
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {visibleChildren.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={handleLinkClick}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                          isActive(child.href)
                            ? "bg-blue-600 text-white"
                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                        )}
                      >
                        {child.icon}
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                isActive(item.href!)
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-4 border-t border-gray-700 pt-4 space-y-2">
        <div className="px-3 py-2 text-xs text-gray-400">
          <div className="font-medium text-gray-200">{user?.name}</div>
          <div>{user?.email}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-blue-400">{user?.role}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
