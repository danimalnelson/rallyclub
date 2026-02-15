"use client";

import { ReactNode } from "react";
import { LinearSidebar } from "./linear-sidebar";
import { LinearMobileSidebar } from "./linear-mobile-sidebar";

interface Business {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface LinearLayoutProps {
  children: ReactNode;
  businessId: string;
  business: Business;
  allBusinesses: Business[];
  userEmail?: string;
  userName?: string;
}

export function LinearLayout({
  children,
  businessId,
  business,
  allBusinesses,
  userEmail,
  userName,
}: LinearLayoutProps) {
  return (
    <div className="min-h-screen bg-ds-background-200">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <LinearSidebar
          businessId={businessId}
          business={business}
          allBusinesses={allBusinesses}
          userEmail={userEmail}
          userName={userName}
        />
      </div>

      {/* Mobile Sidebar */}
      <div className="lg:hidden">
        <LinearMobileSidebar
          businessId={businessId}
          business={business}
          allBusinesses={allBusinesses}
          userEmail={userEmail}
          userName={userName}
        />
      </div>

      {/* Main Content Area */}
      <main className="lg:pl-[241px] min-h-screen">
        <div className="px-3">
          {children}
        </div>
      </main>
    </div>
  );
}
