"use client";

import { memo } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@wine-club/ui";

interface AppHeaderProps {
  userEmail?: string;
}

export const AppHeader = memo(function AppHeader({ userEmail }: AppHeaderProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wine Club Dashboard</h1>
        <div className="flex items-center gap-4">
          {userEmail && (
            <div className="text-sm text-muted-foreground">
              {userEmail}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
});

