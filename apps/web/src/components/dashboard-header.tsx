"use client";

import { memo } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@wine-club/ui";

interface DashboardHeaderProps {
  business: {
    id: string;
    name: string;
    slug: string | null;
    logoUrl?: string | null;
  };
  userEmail?: string;
}

export const DashboardHeader = memo(function DashboardHeader({ business, userEmail }: DashboardHeaderProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {business.logoUrl && (
              <img src={business.logoUrl} alt={business.name} className="h-12 w-12 rounded" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{business.name}</h1>
              {business.slug && (
                <p className="text-sm text-muted-foreground">@{business.slug}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userEmail && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {userEmail}
              </span>
            )}
            <Link href="/app">
              <Button variant="ghost" size="sm">
                ← Back to Businesses
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
        
        <nav className="flex gap-6">
          <Link href={`/app/${business.id}`} className="text-sm font-medium border-b-2 border-primary pb-2">
            Overview
          </Link>
          <Link href={`/app/${business.id}/plans`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
            Plans
          </Link>
          <Link href={`/app/${business.id}/members`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
            Members
          </Link>
          <Link href={`/app/${business.id}/transactions`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
            Transactions
          </Link>
          <Link href={`/app/${business.id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
});

