import { PageHeaderSkeleton } from "@/components/ui/page-header-skeleton";
import { ListSkeleton, ListFooterSkeleton } from "@/components/ui/data-table";

export default function MembersLoading() {
  return (
    <>
      <PageHeaderSkeleton pillCount={3} />

      <ListSkeleton
        rowCount={8}
        columnWidths={["w-28", "w-40", "w-16", "w-24", "w-20"]}
      />

      <ListFooterSkeleton />
    </>
  );
}
