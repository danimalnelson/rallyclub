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
        <h1 className="text-base md:text-lg font-semibold truncate">
          {businessName}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="bg-[#F5F5F5] hover:bg-[#E5E5E5] transition-colors shrink-0 h-9 px-4 rounded-full"
        >
          <Link href={`/${businessSlug}/portal`}>Manage membership</Link>
        </Button>
      </div>
    </header>
  );
}

