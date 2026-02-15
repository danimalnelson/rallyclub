"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@wine-club/ui";
import { Cross } from "@/components/icons/Cross";
import { Dashboard } from "@/components/icons/Dashboard";
import { Lifebuoy } from "@/components/icons/Lifebuoy";
import { Users } from "@/components/icons/Users";
import {
  ArrowLeftRight,
  Layers,
  ChartPie,
  SettingsGear,
  Logout,
  Check,
  Menu,
  Plus,
} from "geist-icons";

interface Business {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface LinearMobileSidebarProps {
  businessId: string;
  business: Business;
  allBusinesses: Business[];
  userEmail?: string;
  userName?: string;
}

const navItems = [
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

export const LinearMobileSidebar = memo(function LinearMobileSidebar({ 
  businessId, 
  business, 
  allBusinesses, 
  userEmail,
  userName,
}: LinearMobileSidebarProps) {
  const pathname = usePathname();
  const basePath = `/app/${business.slug}`;
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "") {
      return pathname === basePath;
    }
    const fullPath = `${basePath}${href}`;
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const otherBusinesses = allBusinesses.filter(b => b.id !== businessId);

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-ds-background-200 border-b border-gray-300 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-gray-900" />
          </button>
          
          <div className="flex items-center gap-2">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="h-6 w-6 rounded object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-semibold text-[10px]">
                  {business.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="font-semibold text-gray-950 text-sm truncate max-w-[150px]">
              {business.name}
            </span>
          </div>

          <div className="w-9" />
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-ds-background-200 border-r border-gray-300 transform transition-transform duration-300 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              {business.logoUrl ? (
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <div className="h-6 w-6 rounded bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-[10px]">
                    {business.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="font-semibold text-gray-950 text-sm">
                {business.name}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Close menu"
            >
              <Cross size={16} className="h-4 w-4 text-gray-900" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-2 overflow-y-auto">
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={`${basePath}${item.href}`}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors",
                      active
                        ? "bg-gray-200 text-gray-950"
                        : "text-gray-900 hover:text-gray-950 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="px-2 pb-4 border-t border-gray-300">
            <div className="space-y-0.5 py-2">
              {/* Settings sub-nav */}
              <p className="px-3 py-1.5 text-[11px] text-gray-800 uppercase flex items-center gap-1.5">
                <SettingsGear className="h-3.5 w-3.5" />
                Settings
              </p>
              {settingsNavItems.map((item) => {
                const fullPath = `${basePath}${item.href}`;
                const active = item.href === "/settings"
                  ? pathname === fullPath
                  : pathname === fullPath || pathname.startsWith(`${fullPath}/`);
                return (
                  <Link
                    key={item.href}
                    href={fullPath}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors ml-2",
                      active
                        ? "bg-gray-200 text-gray-950"
                        : "text-gray-900 hover:text-gray-950 hover:bg-gray-100"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              
              <a
                href="mailto:support@example.com"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium text-gray-900 hover:text-gray-950 hover:bg-gray-100 transition-colors"
              >
                <Lifebuoy className="h-[18px] w-[18px]" />
                Help & Support
              </a>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium text-gray-900 hover:text-gray-950 hover:bg-gray-100 transition-colors"
              >
                <Logout className="h-[18px] w-[18px]" />
                Sign Out
              </button>
            </div>

            {/* Current Business */}
            <div className="pt-2 border-t border-gray-300">
              <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-gray-50">
                {business.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt={business.name}
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-semibold text-xs">
                      {business.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-950 truncate">
                    {business.name}
                  </p>
                  {business.slug && (
                    <p className="text-[11px] text-gray-800 truncate">
                      {business.slug}
                    </p>
                  )}
                </div>
                <Check className="h-4 w-4 text-gray-950" />
              </div>
            </div>

            {/* Other Businesses */}
            {otherBusinesses.length > 0 && (
              <div className="pt-2">
                <p className="px-3 py-1 text-[11px] text-gray-800 uppercase">Switch</p>
                {otherBusinesses.map((b) => (
                  <Link
                    key={b.id}
                    href={`/app/${b.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.name} className="h-7 w-7 rounded object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded bg-gray-400 flex items-center justify-center">
                        <span className="text-gray-900 font-semibold text-[10px]">
                          {b.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-[13px] text-gray-900 truncate">{b.name}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Add Business */}
            <div className="pt-2 border-t border-gray-300">
              <Link
                href="/onboarding"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium text-gray-900 hover:text-gray-950 hover:bg-gray-100 transition-colors"
              >
                <Plus className="h-[18px] w-[18px]" />
                Add business
              </Link>
            </div>

            {/* User Info */}
            {(userName || userEmail) && (
              <div className="pt-2 border-t border-gray-300">
                <Link
                  href={`${basePath}/account`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    {userName && (
                      <p className="text-[14px] font-medium text-gray-950 truncate">{userName}</p>
                    )}
                    {userEmail && (
                      <p className="text-[14px] font-normal text-gray-900 truncate">{userEmail}</p>
                    )}
                  </div>
                  <SettingsGear className="h-4 w-4 text-gray-900 shrink-0" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
