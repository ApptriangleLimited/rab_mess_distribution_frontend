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
  /** Sits between title and actions (e.g. role tabs). */
  center?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const hasCenter = Boolean(center);
  const hasActions = Boolean(actions);

  // With wide actions, equal 1fr|auto|1fr lets right column overflow onto tabs.
  // auto|1fr|auto keeps title + actions at natural width; tabs use leftover.
  const layoutClass = hasCenter
    ? hasActions
      ? "grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-3"
      : "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center"
    : "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between";

  return (
    <div className={layoutClass}>
      <div className="flex min-w-0 items-start gap-3">
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-neutral-900 sm:whitespace-nowrap dark:text-neutral-50">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {hasCenter ? (
        <div className="flex min-w-0 justify-center overflow-x-auto">
          {center}
        </div>
      ) : null}
      {hasActions ? (
        <div className="flex min-w-0 flex-nowrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      ) : hasCenter ? (
        <div className="hidden lg:block" aria-hidden />
      ) : null}
    </div>
  );
}
