import { PageHeaderSkeleton } from "@/components/ui/page-header-skeleton";
import { ListSkeleton, ListFooterSkeleton } from "@/components/ui/data-table";

export default function MembershipsLoading() {
  return (
    <>
      <PageHeaderSkeleton pillCount={1} actionWidth="w-32" />

      <ListSkeleton
        rowCount={4}
        columnWidths={["w-32", "w-48", "w-12", "w-16"]}
      />

      <ListFooterSkeleton />
    </>
  );
}
