import { NumberInput } from "@/components/shared/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getAvailableWeights, getFont, getFontAscender } from "@/lib/text-renderer";
import { calculateTextBounds } from "@/lib/text-to-path";
import { useCanvasStore } from "@/store";
import type { TextElement } from "@/types";
import { FillSection } from "./fill-section";
import { SectionHeader } from "./shared";

interface TextPropertiesProps {
  element: TextElement;
}

export function TextProperties({ element }: TextPropertiesProps) {
  const updateElement = useCanvasStore((s) => s.updateElement);

  return (
    <div className="flex h-full flex-col gap-0 text-foreground text-xs">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
        <span className="truncate">{element.name}</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
        {/* Typography */}
        <div className="flex flex-col gap-2 p-3">
          <SectionHeader title="Typography" />

          {/* Font Family */}
          <Select
            value={element.fontFamily || "Inter, sans-serif"}
            onValueChange={async (newFontFamily) => {
              const { fontSize, fontFamily: oldFontFamily, fontWeight, y } = element;
              const oldWeight = String(fontWeight || "400");

              const availableWeights = getAvailableWeights(newFontFamily || "Inter, sans-serif");
              let newWeight = oldWeight;
              if (!availableWeights.includes(newWeight)) {
                newWeight = availableWeights.includes("400") ? "400" : availableWeights[0] || "400";
              }

              const oldFonts = await getFont(oldFontFamily, oldWeight);
              const newFonts = await getFont(newFontFamily || "Inter, sans-serif", newWeight);
              const oldFont = oldFonts?.[0];
              const newFont = newFonts?.[0];

              if (oldFont && newFont) {
                const oldAscender = getFontAscender(oldFont, fontSize);
                const newAscender = getFontAscender(newFont, fontSize);
                const newY = Number(y) + (oldAscender - newAscender);

                const newBounds = await calculateTextBounds({
                  ...element,
                  x: 0,
                  y: 0,
                  fontFamily: newFontFamily || "Inter, sans-serif",
                  fontWeight: newWeight as "normal" | "bold" | number,
                  fontSize,
                });

                updateElement(element.id, {
                  fontFamily: newFontFamily || "Inter, sans-serif",
                  fontWeight: newWeight as "normal" | "bold" | number,
                  y: newY,
                  bounds: newBounds,
                });
              } else {
                const newBounds = await calculateTextBounds({
                  ...element,
                  x: 0,
                  y: 0,
                  fontFamily: newFontFamily || "Inter, sans-serif",
                  fontWeight: newWeight as "normal" | "bold" | number,
                  fontSize,
                });

                updateElement(element.id, {
                  fontFamily: newFontFamily || "Inter, sans-serif",
                  fontWeight: newWeight,
                  bounds: newBounds,
                });
              }
            }}
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Inter, sans-serif">Inter</SelectItem>
              <SelectItem value="Roboto, sans-serif">Roboto</SelectItem>
              <SelectItem value="Lato, sans-serif">Lato</SelectItem>
              <SelectItem value="Geist Sans, sans-serif">Geist</SelectItem>
              <SelectItem value="Noto Sans, sans-serif">Noto Sans</SelectItem>
              <SelectItem value="Oswald, sans-serif">Oswald</SelectItem>
              <SelectItem value="Raleway, sans-serif">Raleway</SelectItem>
              <SelectItem value="Nunito, sans-serif">Nunito</SelectItem>
              <SelectItem value="Nunito Sans, sans-serif">Nunito Sans</SelectItem>
              <SelectItem value="Rubik, sans-serif">Rubik</SelectItem>
            </SelectContent>
          </Select>

          {/* Font Size and Weight */}
          <div className="grid grid-cols-2 gap-1">
            <NumberInput
              value={element.fontSize || 16}
              onChange={async (v) => {
                const bounds = await calculateTextBounds({
                  ...element,
                  x: 0,
                  y: 0,
                  fontSize: v,
                });
                updateElement(element.id, { fontSize: v, bounds });
              }}
              step={1}
              className="h-7"
            />
            <Select
              value={String(element.fontWeight || "400")}
              onValueChange={async (val) => {
                const oldWeight = String(element.fontWeight || "400");
                if (val === oldWeight) return;

                const currentFonts = await getFont(element.fontFamily, oldWeight);
                const newFonts = await getFont(element.fontFamily || "Inter, sans-serif", val || "400");
                const currentFont = currentFonts?.[0];
                const newFont = newFonts?.[0];

                if (currentFont && newFont) {
                  const fontSize = Number(element.fontSize);
                  const oldAscender = getFontAscender(currentFont, fontSize);
                  const newAscender = getFontAscender(newFont, fontSize);
                  const diff = oldAscender - newAscender;

                  const newBounds = await calculateTextBounds({
                    ...element,
                    x: 0,
                    y: 0,
                    fontWeight: val as "normal" | "bold" | number,
                    fontSize,
                  });

                  updateElement(element.id, {
                    fontWeight: val,
                    y: Number(element.y) + diff,
                    bounds: newBounds,
                  });
                } else {
                  const newBounds = await calculateTextBounds({
                    ...element,
                    x: 0,
                    y: 0,
                    fontWeight: val as "normal" | "bold" | number,
                  });
                  updateElement(element.id, { fontWeight: val, bounds: newBounds });
                }
              }}
            >
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableWeights(element.fontFamily || "Inter, sans-serif").map((w: string) => {
                  const labels: Record<string, string> = {
                    "100": "Thin",
                    "200": "Extra Light",
                    "300": "Light",
                    "400": "Regular",
                    "500": "Medium",
                    "600": "Semi Bold",
                    "700": "Bold",
                    "800": "Extra Bold",
                    "900": "Black",
                  };
                  return (
                    <SelectItem key={w} value={w}>
                      {labels[w] || w}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Text Alignment */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => updateElement(element.id, { textAnchor: "start" })}
              className={`flex h-7 flex-1 items-center justify-center rounded border text-xs ${
                (element.textAnchor || "start") === "start"
                  ? "border-blue-500 bg-blue-50"
                  : "border-border hover:bg-muted"
              }`}
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => updateElement(element.id, { textAnchor: "middle" })}
              className={`flex h-7 flex-1 items-center justify-center rounded border text-xs ${
                (element.textAnchor || "start") === "middle"
                  ? "border-blue-500 bg-blue-50"
                  : "border-border hover:bg-muted"
              }`}
            >
              Center
            </button>
            <button
              type="button"
              onClick={() => updateElement(element.id, { textAnchor: "end" })}
              className={`flex h-7 flex-1 items-center justify-center rounded border text-xs ${
                (element.textAnchor || "start") === "end"
                  ? "border-blue-500 bg-blue-50"
                  : "border-border hover:bg-muted"
              }`}
            >
              Right
            </button>
          </div>
        </div>

        <Separator />

        {/* Appearance */}
        <div className="flex flex-col gap-3 p-3">
          <SectionHeader title="Appearance" />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-[10px] text-muted-foreground uppercase">Opacity</span>
            <NumberInput
              value={(element.opacity ?? 1) * 100}
              onChange={(v) => updateElement(element.id, { opacity: v / 100 })}
              step={1}
            />
          </div>
        </div>

        <Separator />

        <FillSection element={element} />
      </div>
    </div>
  );
}
