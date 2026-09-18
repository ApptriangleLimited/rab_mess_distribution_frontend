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
          {labels.map((label, i) => (
            <td
              key={`${i}-${label}`}
              className="consume-sign-cell border-0 bg-transparent px-1.5 pt-8 text-center align-top"
              style={{ width: colPct }}
            >
              <div className="consume-sign-line mx-auto mb-1.5 h-px w-[72%] max-w-[7.5rem] bg-black" />
              <div className="consume-sign-label leading-tight">
                {label.split("\n").map((line) => (
                  <p key={line} className="m-0">
                    {line}
                  </p>
                ))}
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
