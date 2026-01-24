import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LineMarkerSelectProps {
  value: "none" | "arrow" | "triangle" | "reversed_triangle" | "circle" | "diamond" | "round" | "square";
  onChange: (value: "none" | "arrow" | "triangle" | "reversed_triangle" | "circle" | "diamond" | "round" | "square") => void;
}

const MarkerIcon = ({ type }: { type: string }) => {
  const commonProps = {
    className: "w-full h-full",
    fill: "currentColor",
    viewBox: "0 0 24 24",
  };

  switch (type) {
    case "none":
      return (
        <svg {...commonProps} fill="none">
          <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...commonProps} fill="none">
          <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 8L20 12L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "triangle":
      return (
        <svg {...commonProps} fill="none">
          <path d="M4 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 8L20 12L16 16V8Z" fill="currentColor" />
        </svg>
      );
    case "reversed_triangle":
      return (
        <svg {...commonProps} fill="none">
          <path d="M4 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 8V16L12 12L16 8Z" fill="currentColor" />
        </svg>
      );
    case "circle":
    case "round":
      return (
        <svg {...commonProps} fill="none">
          <path d="M4 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...commonProps} fill="none">
          <path d="M4 12H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 12L17 9L20 12L17 15L14 12Z" fill="currentColor" />
        </svg>
      );
    case "square":
      return (
        <svg {...commonProps} fill="none">
          <path d="M4 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="16" y="9" width="6" height="6" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
};

export function LineMarkerSelect({ value, onChange }: LineMarkerSelectProps) {
  const options = ["none", "arrow", "triangle", "reversed_triangle", "circle", "diamond", "square"] as const;

  return (
    <Select value={value} onValueChange={(val) => onChange(val as LineMarkerSelectProps["value"])}>
      <SelectTrigger className="h-7 w-full px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center text-muted-foreground">
                <MarkerIcon type={opt} />
              </span>
              <span className="capitalize">{opt.replace("_", " ")}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
