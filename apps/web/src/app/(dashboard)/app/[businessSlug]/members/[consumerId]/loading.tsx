import Link from "next/link";
import { ChevronBreadcrumb } from "@/components/icons/ChevronBreadcrumb";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-300/70 ${className}`} />;
}

export default function MemberDetailLoading() {
  return (
    <>
      <PageHeader>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Link
            href=".."
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Members
          </Link>
          <ChevronBreadcrumb size={14} className="text-neutral-500 shrink-0" />
          <Skeleton className="h-4 w-32" />
        </div>
      </PageHeader>

      <div className="p-6">
        <div className="w-full">
          <SectionCard title={<Skeleton className="h-5 w-40" />} className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-16 mb-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={<Skeleton className="h-5 w-24" />} className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={<Skeleton className="h-5 w-32" />}>
            <Skeleton className="h-24 w-full" />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
