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
      <p className="text-gray-600 dark:text-gray-800">{message}</p>
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-800 mt-1">{description}</p>
      )}
    </>
  );
}
