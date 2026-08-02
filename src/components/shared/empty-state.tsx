export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600">
      <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
        {title}
      </h3>
      {description ? (
        <p className="max-w-md text-sm text-neutral-500">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
