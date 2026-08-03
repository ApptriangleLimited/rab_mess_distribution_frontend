export function PageHeader({
  title,
  subtitle,
  leading,
  center,
  actions,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  /** Sits between title and actions (e.g. role tabs). Always centered on lg. */
  center?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={
        center
          ? "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center"
          : "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      }
    >
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
      {center ? (
        <div className="flex min-w-0 justify-start lg:justify-center">
          {center}
        </div>
      ) : null}
      {center || actions ? (
        <div
          className={
            center
              ? "flex flex-wrap items-center gap-2 lg:justify-end"
              : "flex flex-wrap items-center gap-2 lg:justify-end"
          }
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
