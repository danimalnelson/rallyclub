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
          type="tertiary"
          size="small"
          shape="rounded"
          asChild
          className="bg-neutral-100 hover:bg-neutral-200 shrink-0 px-4"
        >
          <Link href={`/${businessSlug}/portal`}>Manage membership</Link>
        </Button>
      </div>
    </header>
  );
}

