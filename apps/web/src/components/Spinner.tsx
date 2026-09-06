import { cn } from "@mdword/ui";

export function Spinner({
  size = 20,
  className
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("md-spinner", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
