"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
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
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-stretch gap-0 overflow-hidden rounded-lg border border-transparent bg-transparent transition-[border-color,background-color,box-shadow] group-hover:border-neutral-300 group-hover:bg-white group-hover:shadow-sm dark:group-hover:border-neutral-600 dark:group-hover:bg-neutral-100">
      <button
        ref={moreRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setShowMore((v) => !v); }}
        title="More actions"
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {showMore && typeof document !== "undefined" && moreRef.current && createPortal(
        <div
          className="fixed z-[100] w-48 rounded-lg border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-100"
          style={{
            top: moreRef.current.getBoundingClientRect().top - 8,
            left: Math.max(8, moreRef.current.getBoundingClientRect().right - 192),
            transform: "translateY(-100%)",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMore(false);
              window.location.href = `/app/${businessSlug}/members/${memberId}`;
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-200"
          >
            View member details
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMore(false); handleDelete(); }}
            disabled={loading}
            className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-200"
          >
            Delete member
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
