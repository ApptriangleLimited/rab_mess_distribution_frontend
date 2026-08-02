export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
