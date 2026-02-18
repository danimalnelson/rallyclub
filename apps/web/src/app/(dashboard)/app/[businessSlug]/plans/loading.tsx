import { PageHeaderSkeleton } from "@/components/ui/page-header-skeleton";
import { ListSkeleton, ListFooterSkeleton } from "@/components/ui/data-table";

export default function PlansLoading() {
  return (
    <>
      <PageHeaderSkeleton pillCount={2} actionWidth="w-24" />

      <ListSkeleton
        rowCount={6}
        columnWidths={["w-32", "w-24", "w-16", "w-16", "w-16", "w-8"]}
      />

      <ListFooterSkeleton />
    </>
  );
}
