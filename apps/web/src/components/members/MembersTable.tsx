"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@wine-club/ui";
import { Download, Plus } from "geist-icons";
import {
  DataTable,
  useDataTable,
  type Column,
  type FilterConfig,
} from "@/components/ui/data-table";
import { Drawer } from "@wine-club/ui";
import { AddMemberForm } from "./AddMemberForm";
import { MemberActions } from "./MemberActions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Member {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  joinedAt: Date;
  activePlans: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatJoinedDate(date: Date, timeZone?: string) {
  const d = date instanceof Date ? date : new Date(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone }).format(d);
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(d);
  return `${month} ${day}, ${year}`;
}

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

function buildFilterConfigs(allPlanNames: string[]): FilterConfig[] {
  return [
    { type: "text", key: "name", label: "Name", placeholder: "Name contains..." },
    { type: "text", key: "email", label: "Email", placeholder: "Email contains..." },
    {
      type: "select",
      key: "status",
      label: "Status",
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
      ],
    },
    {
      type: "select",
      key: "plan",
      label: "Plan",
      options: allPlanNames.map((p) => ({ value: p, label: p })),
    },
  ];
}

function filterFn(m: Member, filters: Record<string, string>): boolean {
  if (filters.name && !m.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
  if (filters.email && !m.email.toLowerCase().includes(filters.email.toLowerCase())) return false;
  if (filters.status && !filters.status.split(",").includes(m.status)) return false;
  if (filters.plan && !m.activePlans.some((p) => filters.plan!.split(",").includes(p))) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MembersTable({
  members,
  allPlanNames,
  businessId,
  businessSlug,
  timeZone,
}: {
  members: Member[];
  allPlanNames: string[];
  businessId: string;
  businessSlug: string;
  timeZone?: string;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filterConfigs = buildFilterConfigs(allPlanNames);

  const table = useDataTable({
    data: members,
    filters: filterConfigs,
    filterFn,
  });

  const columns: Column<Member>[] = [
    {
      key: "name",
      label: "Name",
      cellClassName: "font-medium",
      render: (m) => m.name,
    },
    {
      key: "email",
      label: "Email",
      render: (m) => m.email,
    },
    {
      key: "joined",
      label: "Joined",
      render: (m) => formatJoinedDate(m.joinedAt, timeZone),
    },
    {
      key: "plans",
      label: "Plans",
      cellClassName: "max-w-[200px]",
      render: (m) =>
        m.activePlans.length > 0 ? (
          <span className="block truncate" title={m.activePlans.join(", ")}>
            {m.activePlans.join(", ")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const exportCsv = useCallback(() => {
    const headers = ["Name", "Email", "Status", "Joined", "Active Plans"];
    const rows = table.filtered.map((m) => [
      m.name.replace(/,/g, ""),
      m.email,
      m.status,
      m.joinedAt instanceof Date ? m.joinedAt.toISOString().split("T")[0] : String(m.joinedAt).split("T")[0],
      m.activePlans.join("; "),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [table.filtered]);

  return (
  <>
    <DataTable
      title="Members"
      columns={columns}
      data={members}
      keyExtractor={(m) => m.id}
      onRowClick={(m) => {
        window.location.href = `/app/${businessSlug}/members/${m.id}`;
      }}
      rowActions={(m) => (
        <MemberActions
          memberId={m.id}
          memberName={m.name}
          businessSlug={businessSlug}
        />
      )}
      table={table}
      emptyMessage="No members yet. Members will appear here when they subscribe to your plans."
      filteredEmptyMessage="No members match filters"
      actions={
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="small"
            onClick={exportCsv}
            prefix={<Download className="h-3.5 w-3.5" />}
          >
            Export
          </Button>
          <Button
            size="small"
            onClick={() => setDrawerOpen(true)}
            prefix={<Plus className="h-3.5 w-3.5" />}
          >
            Add customer
          </Button>
        </div>
      }
    />

    <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add customer">
      <AddMemberForm
        businessId={businessId}
        onSuccess={() => {
          setDrawerOpen(false);
          router.refresh();
        }}
        onCancel={() => setDrawerOpen(false)}
      />
    </Drawer>
  </>
  );
}
