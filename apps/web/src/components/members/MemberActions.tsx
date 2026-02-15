"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MenuContainer, Menu, MenuItem, MenuIconTrigger } from "@wine-club/ui";
import { MoreVertical } from "geist-icons";

interface MemberActionsProps {
  memberId: string;
  memberName: string;
  businessSlug: string;
}

export function MemberActions({
  memberId,
  memberName,
  businessSlug,
}: MemberActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete member "${memberName}"? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to delete member");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Delete member error:", error);
      alert("Failed to delete member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-stretch gap-0 overflow-hidden rounded-lg border border-transparent bg-transparent transition-[border-color,background-color,box-shadow] group-hover:border-gray-300 group-hover:bg-white group-hover:shadow-sm dark:group-hover:border-gray-600 dark:group-hover:bg-gray-100">
      <MenuContainer>
        <MenuIconTrigger><MoreVertical className="h-4 w-4" /></MenuIconTrigger>
        <Menu width={192} align="end">
          <MenuItem href={`/app/${businessSlug}/members/${memberId}`}>
            View member details
          </MenuItem>
          <MenuItem onClick={handleDelete} disabled={loading} type="error">
            Delete member
          </MenuItem>
        </Menu>
      </MenuContainer>
    </div>
  );
}
