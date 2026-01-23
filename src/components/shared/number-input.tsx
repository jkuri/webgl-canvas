import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  step?: number;
  disabled?: boolean;
}

export function NumberInput({ value, onChange, label, icon, suffix, className, step = 1, disabled }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(Number.isFinite(value) ? Number(value).toFixed(2).replace(/\.00$/, "") : "0");
  }, [value]);

  const updateValue = (newValue: number) => {
    onChange(newValue);
    setLocalValue(Number(newValue).toFixed(2).replace(/\.00$/, ""));
  };

  const increment = () => {
    if (disabled) return;
    updateValue(value + step);
    inputRef.current?.focus();
  };

  const decrement = () => {
    if (disabled) return;
    updateValue(value - step);
    inputRef.current?.focus();
  };

  const handleBlur = () => {
    const num = parseFloat(localValue);
    if (!Number.isNaN(num)) {
      onChange(num);
    } else {
      setLocalValue(Number(value).toFixed(2).replace(/\.00$/, ""));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      increment();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      decrement();
    }
  };

  return (
    <div className={cn("group relative flex items-center", className)}>
      {(icon || label) && (
        <div className="pointer-events-none absolute left-2 z-10 flex items-center text-muted-foreground [&>svg]:size-3.5">
          {icon}
          {label && <span className="font-medium text-[10px] uppercase">{label}</span>}
        </div>
      )}
      <Input
        ref={inputRef}
        className={cn(
          "h-8 border-input bg-input/20 text-xs shadow-none",
          icon || label ? "pl-8" : "px-2",
          suffix ? "pr-10" : "pr-6",

          "[appearance:textfield]",
          "[&::-webkit-outer-spin-button]:appearance-none",
          "[&::-webkit-inner-spin-button]:appearance-none",
        )}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        step={step}
        type="number"
        disabled={disabled}
      />
      {suffix && (
        <div className="pointer-events-none absolute right-6 z-10 flex items-center text-muted-foreground">
          <span className="text-[10px]">{suffix}</span>
        </div>
      )}
      <div className="absolute top-1/2 right-1 z-10 flex -translate-y-1/2 flex-col">
        <button
          type="button"
          onClick={increment}
          disabled={disabled}
          className="flex h-3 w-4 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
          tabIndex={-1}
        >
          <HugeiconsIcon icon={ArrowUp01Icon} size={10} />
        </button>
        <button
          type="button"
          onClick={decrement}
          disabled={disabled}
          className="flex h-3 w-4 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
          tabIndex={-1}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={10} />
        </button>
      </div>
    </div>
  );
}
