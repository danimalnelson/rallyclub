"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@wine-club/ui";
import { formatDate } from "@wine-club/ui";
import { Plus, Trash } from "geist-icons";
import { SectionCard } from "@/components/ui/section-card";

interface Note {
  id: string;
  content: string;
  createdAt: Date;
  createdBy?: {
    name: string | null;
    email: string;
  } | null;
}

interface MemberNotesProps {
  consumerId: string;
  notes: Note[];
}

export function MemberNotes({ consumerId, notes: initialNotes }: MemberNotesProps) {
  const router = useRouter();
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/members/${consumerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });

      if (!response.ok) {
        throw new Error("Failed to add note");
      }

      setNewNote("");
      setShowAddNote(false);
      router.refresh();
    } catch (error) {
      alert("Failed to add note. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;

    try {
      const response = await fetch(`/api/members/${consumerId}/notes/${noteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete note");
      }

      router.refresh();
    } catch (error) {
      alert("Failed to delete note. Please try again.");
    }
  };

  return (
    <SectionCard
      title="Internal Notes"
      actions={
        !showAddNote && (
          <Button
            type="secondary"
            size="small"
            onClick={() => setShowAddNote(true)}
            prefix={<Plus className="h-4 w-4" />}
          >
            Add Note
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {showAddNote && (
          <form onSubmit={handleAddNote} className="space-y-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this member..."
              rows={3}
              className="w-full px-3 py-2 border rounded-md"
              disabled={loading}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="secondary"
                size="small"
                onClick={() => {
                  setShowAddNote(false);
                  setNewNote("");
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button htmlType="submit" size="small" disabled={loading || !newNote.trim()}>
                {loading ? "Adding..." : "Add Note"}
              </Button>
            </div>
          </form>
        )}

        {initialNotes.length === 0 && !showAddNote && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No notes yet. Add a note to track important information about this member.
          </p>
        )}

        {initialNotes.map((note) => (
          <div
            key={note.id}
            className="p-4 bg-muted/50 rounded-lg border relative group"
          >
            <p className="text-sm whitespace-pre-wrap pr-8">{note.content}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {note.createdBy?.name || note.createdBy?.email || "Unknown"} •{" "}
                {formatDate(note.createdAt)}
              </span>
              <button
                onClick={() => handleDeleteNote(note.id)}
                className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 transition-opacity"
                title="Delete note"
              >
                <Trash className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

