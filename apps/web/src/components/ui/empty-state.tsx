interface EmptyStateProps {
  message: string;
  description?: React.ReactNode;
}

/**
 * Shared empty state content for list and table views.
 * Parent provides wrapper (centering, padding).
 */
export function EmptyState({ message, description }: EmptyStateProps) {
  return (
    <>
      <p className="text-muted-foreground">{message}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </>
  );
}
