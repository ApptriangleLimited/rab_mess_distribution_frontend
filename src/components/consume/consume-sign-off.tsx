import { cn } from "@/lib/utils";

type Props = {
  labels: readonly string[];
  className?: string;
};

export function ConsumeSignOff({ labels, className }: Props) {
  const colPct = `${100 / Math.max(labels.length, 1)}%`;

  return (
    <table
      className={cn(
        "consume-sign-off mt-10 w-full table-fixed border-0",
        className,
      )}
    >
      <tbody>
        <tr>
          {labels.map((label, i) => {
            const left = i >= labels.length - 2;
            return (
            <td
              key={`${i}-${label}`}
              className={cn(
                "consume-sign-cell border-0 bg-transparent px-1.5 pt-8 align-top",
                left ? "consume-sign-left text-left" : "text-center",
              )}
              style={{ width: colPct }}
            >
              <div
                className={cn(
                  "consume-sign-line mb-1.5 w-[72%] max-w-[7.5rem] border-t border-black",
                  left ? "mr-auto" : "mx-auto",
                )}
              />
              <div
                className={cn(
                  "consume-sign-label leading-tight",
                  left ? "text-left" : "text-center",
                )}
              >
                {label.split("\n").map((line) => (
                  <p key={line} className="m-0">
                    {line}
                  </p>
                ))}
              </div>
            </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}
