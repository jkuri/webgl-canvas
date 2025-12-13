import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex h-full w-60 flex-col border-l bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60",
        className,
      )}
      onMouseDown={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}
