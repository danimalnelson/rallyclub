"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@wine-club/ui";
import {
  LayoutDashboard,
  Users,
  Receipt,
  BarChart3,
  PieChart,
  Settings,
  HelpCircle,
  Building2,
  LogOut,
  Check,
  Menu,
  X,
  Inbox,
} from "lucide-react";

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
}

const navItems = [
  { href: "", label: "Dashboard", icon: Inbox },
  { href: "/members", label: "Members", icon: Users },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/plans", label: "Plans", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: PieChart },
];

const bottomNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export const LinearMobileSidebar = memo(function LinearMobileSidebar({ 
  businessId, 
  business, 
  allBusinesses, 
  userEmail 
}: LinearMobileSidebarProps) {
  const pathname = usePathname();
  const basePath = `/app/${business.slug}`;
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "") {
      return pathname === basePath;
    }
    return pathname.startsWith(`${basePath}${href}`);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const otherBusinesses = allBusinesses.filter(b => b.id !== businessId);

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-[#fafafa] border-b border-[#eaeaea] lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-[#f5f5f5] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-[#666]" />
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
            <span className="font-medium text-[#171717] text-sm truncate max-w-[150px]">
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
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-[#fafafa] border-r border-[#eaeaea] transform transition-transform duration-300 ease-in-out lg:hidden",
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
              <span className="font-semibold text-[#171717] text-sm">
                {business.name}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md hover:bg-[#f5f5f5] transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4 text-[#666]" />
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
                        ? "bg-[#f0f0f0] text-[#171717]"
                        : "text-[#666] hover:text-[#171717] hover:bg-[#f5f5f5]"
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
          <div className="px-2 pb-4 border-t border-[#eaeaea]">
            <div className="space-y-0.5 py-2">
              {bottomNavItems.map((item) => {
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
                        ? "bg-[#f0f0f0] text-[#171717]"
                        : "text-[#666] hover:text-[#171717] hover:bg-[#f5f5f5]"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
              
              <a
                href="mailto:support@example.com"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium text-[#666] hover:text-[#171717] hover:bg-[#f5f5f5] transition-colors"
              >
                <HelpCircle className="h-[18px] w-[18px]" />
                Help & Support
              </a>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium text-[#666] hover:text-[#171717] hover:bg-[#f5f5f5] transition-colors"
              >
                <LogOut className="h-[18px] w-[18px]" />
                Sign Out
              </button>
            </div>

            {/* Current Business */}
            <div className="pt-2 border-t border-[#eaeaea]">
              <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-[#fafafa]">
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
                  <p className="text-[13px] font-medium text-[#171717] truncate">
                    {business.name}
                  </p>
                  {business.slug && (
                    <p className="text-[11px] text-[#999] truncate">
                      {business.slug}
                    </p>
                  )}
                </div>
                <Check className="h-4 w-4 text-[#171717]" />
              </div>
            </div>

            {/* Other Businesses */}
            {otherBusinesses.length > 0 && (
              <div className="pt-2">
                <p className="px-3 py-1 text-[11px] text-[#999] uppercase tracking-wide">Switch</p>
                {otherBusinesses.map((b) => (
                  <Link
                    key={b.id}
                    href={`/app/${b.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-[#f5f5f5] transition-colors"
                  >
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.name} className="h-7 w-7 rounded object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded bg-[#eaeaea] flex items-center justify-center">
                        <span className="text-[#666] font-semibold text-[10px]">
                          {b.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-[13px] text-[#666] truncate">{b.name}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* User Email */}
            {userEmail && (
              <div className="px-3 pt-3 text-[11px] text-[#999]">
                {userEmail}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
