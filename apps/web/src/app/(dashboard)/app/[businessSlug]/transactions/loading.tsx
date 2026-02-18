import { PageHeaderSkeleton } from "@/components/ui/page-header-skeleton";
import { ListSkeleton, ListFooterSkeleton } from "@/components/ui/data-table";

export default function TransactionsLoading() {
  return (
    <>
      <PageHeaderSkeleton pillCount={4} />

      <ListSkeleton
        rowCount={10}
        columnWidths={["w-28", "w-24", "w-36", "w-16", "w-16", "w-24", "w-14"]}
      />

      <ListFooterSkeleton />
    </>
  );
}
