import { Button } from "@wine-club/ui";
import Link from "next/link";

interface BusinessHeaderProps {
  businessName: string;
  businessSlug: string;
}

export function BusinessHeader({
  businessName,
  businessSlug,
}: BusinessHeaderProps) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-4">
        <h1 className="text-base md:text-lg font-semibold tracking-tight truncate">
          {businessName}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="hover:bg-accent/50 transition-colors shrink-0 h-9 px-4"
        >
          <Link href={`/${businessSlug}/portal`}>Member Portal</Link>
        </Button>
      </div>
    </header>
  );
}

