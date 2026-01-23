import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NumberInput } from "@/components/shared/number-input";
import { Input } from "@/components/ui/input";
import { COLOR_PICKER_PRESETS } from "@/lib/colors";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
}

const hexToHsv = (hex: string) => {
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 4) {
    r = parseInt(`0x${hex[1]}${hex[1]}`, 16);
    g = parseInt(`0x${hex[2]}${hex[2]}`, 16);
    b = parseInt(`0x${hex[3]}${hex[3]}`, 16);
  } else if (hex.length === 7) {
    r = parseInt(`0x${hex[1]}${hex[2]}`, 16);
    g = parseInt(`0x${hex[3]}${hex[4]}`, 16);
    b = parseInt(`0x${hex[5]}${hex[6]}`, 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, v };
};

const hsvToHex = (h: number, s: number, v: number) => {
  let r = 0,
    g = 0,
    b = 0;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hsvToRgb = (h: number, s: number, v: number) => {
  let r = 0,
    g = 0,
    b = 0;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export function ColorPicker({ color, onChange, className, opacity = 1, onOpacityChange }: ColorPickerProps) {
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [isDraggingSat, setIsDraggingSat] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const [isDraggingAlpha, setIsDraggingAlpha] = useState(false);
  const satRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingSat && !isDraggingHue) {
      setHsv(hexToHsv(color));
    }
  }, [color, isDraggingSat, isDraggingHue]);

  const handleSaturationChange = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!satRef.current) return;
      const rect = satRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const newHsv = { ...hsv, s: x, v: 1 - y };
      setHsv(newHsv);
      onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
    },
    [hsv, onChange],
  );

  const handleHueChange = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newHue = x * 360;
      const newHsv = { ...hsv, h: newHue };
      setHsv(newHsv);
      onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
    },
    [hsv, onChange],
  );

  const handleAlphaChange = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!alphaRef.current || !onOpacityChange) return;
      const rect = alphaRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onOpacityChange(Math.round(x * 100) / 100);
    },
    [onOpacityChange],
  );

  useEffect(() => {
    const handleUp = () => {
      setIsDraggingSat(false);
      setIsDraggingHue(false);
      setIsDraggingAlpha(false);
    };
    const handleMove = (e: MouseEvent) => {
      if (isDraggingSat) handleSaturationChange(e);
      if (isDraggingHue) handleHueChange(e);
      if (isDraggingAlpha) handleAlphaChange(e);
    };

    if (isDraggingSat || isDraggingHue || isDraggingAlpha) {
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("mousemove", handleMove);
    }
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mousemove", handleMove);
    };
  }, [isDraggingSat, isDraggingHue, isDraggingAlpha, handleSaturationChange, handleHueChange, handleAlphaChange]);

  const rgb = hsvToRgb(hsv.h, 1, 1);
  const solidColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  return (
    <div className={cn("flex w-64 flex-col gap-3", className)}>
      {}
      <div className="relative h-40 w-full overflow-hidden rounded-md border shadow-sm">
        <div
          ref={satRef}
          className="h-full w-full cursor-crosshair"
          style={{ backgroundColor: solidColor }}
          onMouseDown={(e) => {
            setIsDraggingSat(true);
            handleSaturationChange(e);
          }}
        >
          <div className="absolute inset-0 bg-linear-to-r from-white to-transparent" />
          <div className="absolute inset-0 bg-linear-to-t from-black to-transparent" />
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-black/20"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex gap-3">
        {}
        {}

        <div className="flex flex-1 flex-col gap-3">
          {}
          <div
            ref={hueRef}
            className="relative h-3 w-full cursor-pointer overflow-hidden rounded-full shadow-sm"
            style={{
              background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
            onMouseDown={(e) => {
              setIsDraggingHue(true);
              handleHueChange(e);
            }}
          >
            <div
              className="pointer-events-none absolute top-0 h-full w-3 -translate-x-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-black/20"
              style={{ left: `${(hsv.h / 360) * 100}%` }}
            />
          </div>

          {}
          <div
            ref={alphaRef}
            className="relative h-3 w-full cursor-pointer overflow-hidden rounded-full shadow-sm"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
              backgroundSize: "8px 8px",
              backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
              backgroundColor: "white",
            }}
            onMouseDown={(e) => {
              if (onOpacityChange) {
                setIsDraggingAlpha(true);
                handleAlphaChange(e);
              }
            }}
          >
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to right, transparent, ${color})` }}
            />
            <div
              className="pointer-events-none absolute top-0 h-full w-3 -translate-x-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-black/20"
              style={{ left: `${opacity * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border bg-input/20 px-2 py-1">
          <span className="text-[10px] text-muted-foreground">Hex</span>
          <Input
            className="h-5 border-0 bg-transparent p-0 text-xs"
            value={color.toUpperCase()}
            onChange={(e) => onChange(e.target.value)}
            maxLength={7}
          />
        </div>

        <div className="flex w-20 items-center gap-1">
          <NumberInput
            className="h-7 w-full rounded-md bg-background"
            value={Math.round(opacity * 100)}
            onChange={(val) => {
              if (onOpacityChange) {
                onOpacityChange(Math.max(0, Math.min(100, val)) / 100);
              }
            }}
            suffix="%"
            step={1}
          />
        </div>
      </div>

      {}
      <div className="grid grid-cols-8 gap-1 border-t pt-2">
        {COLOR_PICKER_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            className="h-5 w-5 rounded-sm border shadow-sm ring-offset-background transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}
