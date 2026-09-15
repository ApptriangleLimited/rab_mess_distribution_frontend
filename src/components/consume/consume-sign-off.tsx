import { cn } from "@/lib/utils";

type Props = {
  labels: readonly string[];
  className?: string;
};

export function ConsumeSignOff({ labels, className }: Props) {
  const secondLast = labels.length - 2;
  const last = labels.length - 1;
  return (
    <footer
      className={cn(
        "mt-10 grid items-start gap-x-2 text-black [grid-template-columns:1fr_1fr_1fr_1.1fr_1.7fr_1.25fr]",
        className,
      )}
    >
      {labels.map((label, i) => {
        const isSecondLast = i === secondLast;
        const isLast = i === last;
        return (
          <div
            key={`${i}-${label}`}
            className={cn(
              "flex min-w-0 flex-col pt-8",
              isSecondLast
                ? "items-start text-left"
                : isLast
                  ? "items-start text-left"
                  : "items-center text-center",
            )}
          >
            <div
              className={cn(
                "mb-1.5 h-px bg-black",
                isSecondLast
                  ? "ml-0 w-full max-w-[9.5rem]"
                  : isLast
                    ? "ml-0 w-full max-w-[7.5rem]"
                    : "mx-auto w-full max-w-[7.5rem]",
              )}
            />
            <div
              className={cn(
                isSecondLast
                  ? "space-y-0.5 text-left leading-4"
                  : "leading-tight",
              )}
            >
              {label.split("\n").map((line) => (
                <p key={line} className="m-0">
                  {line}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </footer>
  );
}
