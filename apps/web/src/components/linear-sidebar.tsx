"use client";

import { memo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn, MenuContainer, Menu, MenuSection, MenuDivider, MenuItem, useMenuContext } from "@wine-club/ui";
import { Dashboard } from "@/components/icons/Dashboard";
import { Lifebuoy } from "@/components/icons/Lifebuoy";
import { Users } from "@/components/icons/Users";
import {
  ArrowLeftRight,
  ChartPie,
  SettingsGear,
  Logout,
  Plus,
  Layers,
} from "geist-icons";
import { ChevronUpDown } from "@/components/icons/ChevronUpDown";
import { ChevronRight } from "@/components/icons/ChevronRight";
import { ChevronLeft } from "@/components/icons/ChevronLeft";

interface Business {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface LinearSidebarProps {
  businessId: string;
  business: Business;
  allBusinesses: Business[];
  userEmail?: string;
  userName?: string;
}

const mainNavItems = [
  { href: "", label: "Dashboard", icon: Dashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/transactions", label: "Activity", icon: ArrowLeftRight },
  { href: "/plans", label: "Plans", icon: Layers },
  { href: "/reports", label: "Reports", icon: ChartPie },
];

const settingsNavItems = [
  { href: "/settings", label: "General" },
  { href: "/settings/branding", label: "Branding" },
  { href: "/settings/notifications", label: "Notifications" },
];

// ---------------------------------------------------------------------------
// Workspace dropdown helpers (need useMenuContext for close/toggle)
// ---------------------------------------------------------------------------

function WorkspaceTrigger({ business }: { business: Business }) {
  const { toggle, triggerRef } = useMenuContext();
  return (
    <button
      ref={triggerRef}
      onClick={toggle}
      className="group w-full flex items-center gap-1.5 px-2 h-9 rounded-md hover:bg-gray-100 transition-colors"
    >
      {business.logoUrl ? (
        <img src={business.logoUrl} alt={business.name} className="h-5 w-5 rounded object-cover" />
      ) : (
        <div className="h-5 w-5 rounded bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
          <span className="text-white font-semibold text-[10px]">{business.name.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <span className="text-sm font-semibold text-gray-950 truncate flex-1 text-left">{business.name}</span>
      <ChevronUpDown size={14} className="text-gray-800 group-hover:text-gray-950 shrink-0" />
    </button>
  );
}

function WorkspaceUserSection({
  basePath,
  userEmail,
}: {
  basePath: string;
  userEmail?: string;
}) {
  return (
    <MenuItem
      href={`${basePath}/account`}
      suffix={<ChevronRight size={16} className="text-gray-800 group-hover:text-gray-950" />}
    >
      <span className="truncate">{userEmail}</span>
    </MenuItem>
  );
}

function BusinessLogo({ business, className }: { business: Business; className?: string }) {
  return business.logoUrl ? (
    <img src={business.logoUrl} alt={business.name} className={cn("rounded object-cover", className)} />
  ) : (
    <div className={cn("rounded bg-gray-400 flex items-center justify-center", className)}>
      <span className="text-gray-900 font-semibold text-[10px]">{business.name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const LinearSidebar = memo(function LinearSidebar({ 
  businessId, 
  business, 
  allBusinesses, 
  userEmail,
  userName,
}: LinearSidebarProps) {
  const pathname = usePathname();
  const basePath = `/app/${business.slug}`;

  // Determine if we're on a settings page
  const isOnSettingsPage = pathname.startsWith(`${basePath}/settings`);
  const [showSettingsNav, setShowSettingsNav] = useState(isOnSettingsPage);

  // Sync with route changes
  useEffect(() => {
    setShowSettingsNav(isOnSettingsPage);
  }, [isOnSettingsPage]);

  const isActive = (href: string) => {
    if (href === "") {
      return pathname === basePath;
    }
    const fullPath = `${basePath}${href}`;
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  const isSettingsActive = (href: string) => {
    const fullPath = `${basePath}${href}`;
    // Exact match for /settings (General), startsWith for sub-pages
    if (href === "/settings") {
      return pathname === fullPath;
    }
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const otherBusinesses = allBusinesses.filter(b => b.id !== businessId);

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-[241px] flex flex-col bg-ds-background-200 border-r border-gray-300 overflow-hidden">
      {/* Workspace Header — stays fixed at top */}
      <div className="px-3 py-3 shrink-0">
        <MenuContainer>
          <WorkspaceTrigger business={business} />
          <Menu width={215} align="start">
            {/* User Info */}
            {userEmail && (
              <>
                <WorkspaceUserSection basePath={basePath} userEmail={userEmail} />
                <MenuDivider />
              </>
            )}

            {/* Businesses */}
            <MenuItem
              disabled
              className="bg-gray-200 opacity-100"
              prefix={
                business.logoUrl ? (
                  <img src={business.logoUrl} alt={business.name} className="h-5 w-5 rounded object-cover" />
                ) : (
                  <div className="h-5 w-5 rounded bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-semibold text-[10px]">{business.name.charAt(0).toUpperCase()}</span>
                  </div>
                )
              }
            >
              {business.name}
            </MenuItem>

            {/* Other Businesses */}
            {otherBusinesses.map((b) => (
              <MenuItem
                key={b.id}
                href={`/app/${b.slug}`}
                prefix={<BusinessLogo business={b} className="h-5 w-5" />}
              >
                {b.name}
              </MenuItem>
            ))}

            <MenuDivider />

            {/* Add Business & Sign Out */}
            <MenuItem href="/onboarding" prefix={<Plus className="h-4 w-4" />}>
              Add business
            </MenuItem>
            <MenuItem onClick={handleSignOut} prefix={<Logout className="h-4 w-4" />}>
              Sign out
            </MenuItem>
          </Menu>
        </MenuContainer>
      </div>

      {/* Nav panels — crossfade with subtle 24px shift */}
      <div className="relative flex-1 overflow-hidden">
        {/* ============ Panel 1: Main Nav ============ */}
        <div
          className="absolute inset-0 flex flex-col transition-all duration-200 ease-in-out"
          style={{
            opacity: showSettingsNav ? 0 : 1,
            transform: showSettingsNav ? "translateX(-24px)" : "translateX(0)",
            pointerEvents: showSettingsNav ? "none" : "auto",
          }}
        >
          <nav className="px-3 py-1 flex flex-col gap-0.5">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={`${basePath}${item.href}`}
                  className={cn(
                    "flex items-center gap-2.5 px-2 h-9 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-gray-200 text-gray-950"
                      : "text-gray-900 hover:text-gray-950 hover:bg-gray-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="border-t border-gray-300 mt-[4px] mb-[4px]" />

            <button
              onClick={() => setShowSettingsNav(true)}
              className={cn(
                "group flex items-center gap-2.5 px-2 h-9 rounded-md text-sm font-medium transition-colors w-full",
                isOnSettingsPage
                  ? "bg-gray-200 text-gray-950"
                  : "text-gray-900 hover:text-gray-950 hover:bg-gray-100"
              )}
            >
              <SettingsGear className="h-4 w-4" />
              <span className="flex-1 text-left">Settings</span>
              <ChevronRight size={16} className="text-gray-800 group-hover:text-gray-950" />
            </button>
            <a
              href="mailto:support@example.com"
              className="flex items-center gap-2.5 px-2 h-9 rounded-md text-sm font-medium text-gray-900 hover:text-gray-950 hover:bg-gray-100 transition-colors"
            >
              <Lifebuoy className="h-4 w-4" />
              <span>Help & Support</span>
            </a>
          </nav>

          <div className="flex-1" />
        </div>

        {/* ============ Panel 2: Settings Nav ============ */}
        <div
          className="absolute inset-0 flex flex-col transition-all duration-200 ease-in-out"
          style={{
            opacity: showSettingsNav ? 1 : 0,
            transform: showSettingsNav ? "translateX(0)" : "translateX(24px)",
            pointerEvents: showSettingsNav ? "auto" : "none",
          }}
        >
          {/* Settings Header — full-width back button */}
          <div className="px-2 pt-1 pb-1">
            <button
              onClick={() => setShowSettingsNav(false)}
              className="group w-full flex items-center px-2 h-9 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium text-gray-950 relative"
            >
              <ChevronLeft size={16} className="text-gray-800 group-hover:text-gray-950 absolute left-2" />
              <span className="flex-1 text-center">Settings</span>
            </button>
          </div>

          {/* Settings Nav Items */}
          <nav className="px-3 py-1 flex flex-col gap-0.5">
            {settingsNavItems.map((item) => {
              const active = isSettingsActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={`${basePath}${item.href}`}
                  className={cn(
                    "flex items-center px-2 h-9 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-gray-200 text-gray-950"
                      : "text-gray-900 hover:text-gray-950 hover:bg-gray-100"
                  )}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />
        </div>
      </div>
    </aside>
  );
});
