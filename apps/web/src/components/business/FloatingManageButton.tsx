import { Button } from "@wine-club/ui";
import Link from "next/link";

interface FloatingManageButtonProps {
  businessSlug: string;
}

export function FloatingManageButton({ businessSlug }: FloatingManageButtonProps) {
  return (
    <Button
      variant="tertiary"
      shape="rounded"
      asChild
      className="bg-gray-100 hover:bg-gray-200 text-foreground h-10 px-6 shrink-0"
    >
      <Link href={`/${businessSlug}/portal`}>Manage membership</Link>
    </Button>
  );
}

