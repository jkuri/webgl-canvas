import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { getRandomShapeColorCSS, SHAPE_COLOR_NAMES, SHAPE_COLORS_CSS, type ShapeColorName } from "@/lib/colors";
import { downloadSVG, exportToSVG } from "@/lib/svg-export";
import { useCanvasStore } from "@/store";

interface CanvasContextMenuProps {
  children: React.ReactNode;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function CanvasContextMenu({ children, onContextMenu }: CanvasContextMenuProps) {
  const contextMenuTarget = useCanvasStore((s) => s.contextMenuTarget);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);
  const clipboard = useCanvasStore((s) => s.clipboard);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const duplicateSelected = useCanvasStore((s) => s.duplicateSelected);
  const copySelected = useCanvasStore((s) => s.copySelected);
  const paste = useCanvasStore((s) => s.paste);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const flipHorizontal = useCanvasStore((s) => s.flipHorizontal);
  const flipVertical = useCanvasStore((s) => s.flipVertical);
  const toggleLock = useCanvasStore((s) => s.toggleLock);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const addElement = useCanvasStore((s) => s.addElement);
  const resetView = useCanvasStore((s) => s.resetView);
  const zoomTo = useCanvasStore((s) => s.zoomTo);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);

  const handleColorChange = (color: string) => {
    if (contextMenuTarget) {
      updateElement(contextMenuTarget.id, { fill: color });
    }
  };

  const handleAddRect = () => {
    addElement({
      id: crypto.randomUUID(),
      type: "rect",
      name: `Rectangle ${elements.filter((e) => e.type === "rect").length + 1}`,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 100 + Math.random() * 100,
      height: 80 + Math.random() * 80,
      rotation: 0,
      fill: getRandomShapeColorCSS(),
      stroke: null,
      opacity: 1,
    });
  };

  const handleAddEllipse = () => {
    addElement({
      id: crypto.randomUUID(),
      type: "ellipse",
      name: `Ellipse ${elements.filter((e) => e.type === "ellipse").length + 1}`,
      cx: 200 + Math.random() * 200,
      cy: 200 + Math.random() * 200,
      rx: 50 + Math.random() * 50,
      ry: 40 + Math.random() * 40,
      rotation: 0,
      fill: getRandomShapeColorCSS(),
      stroke: null,
      opacity: 1,
    });
  };

  const handleAddLine = () => {
    const x1 = 100 + Math.random() * 200;
    const y1 = 100 + Math.random() * 200;
    addElement({
      id: crypto.randomUUID(),
      type: "line",
      name: `Line ${elements.filter((e) => e.type === "line").length + 1}`,
      x1,
      y1,
      x2: x1 + 100 + Math.random() * 100,
      y2: y1 + Math.random() * 100 - 50,
      rotation: 0,
      fill: null,
      stroke: { color: getRandomShapeColorCSS(), width: 2 },
      opacity: 1,
    });
  };

  const handleExportSVG = () => {
    const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
    if (selectedElements.length === 0) return;

    const svgContent = exportToSVG(selectedElements, elements);
    downloadSVG(svgContent, "export.svg");
  };

  const isGroup = contextMenuTarget?.type === "group";

  return (
    <ContextMenu>
      <ContextMenuTrigger className="absolute inset-0" onContextMenu={onContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent onContextMenu={(e) => e.preventDefault()}>
        {contextMenuTarget ? (
          <>
            <ContextMenuItem onClick={copySelected}>
              Copy <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={duplicateSelected}>
              Duplicate <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => bringToFront(contextMenuTarget.id)}>Bring to Front</ContextMenuItem>
            <ContextMenuItem onClick={() => sendToBack(contextMenuTarget.id)}>Send to Back</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={flipHorizontal}>
              Flip Horizontal <ContextMenuShortcut>⇧H</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={flipVertical}>
              Flip Vertical <ContextMenuShortcut>⇧V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />

            {/* Grouping options */}
            {selectedIds.length > 1 && (
              <ContextMenuItem onClick={groupSelected}>
                Group Selection <ContextMenuShortcut>⌘G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {isGroup && (
              <ContextMenuItem onClick={ungroupSelected}>
                Ungroup <ContextMenuShortcut>⇧⌘G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {(selectedIds.length > 1 || isGroup) && <ContextMenuSeparator />}

            {/* Color change - only for non-group elements */}
            {!isGroup && (
              <>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>Change Color</ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    {SHAPE_COLOR_NAMES.map((name: ShapeColorName) => (
                      <ContextMenuItem key={name} onClick={() => handleColorChange(SHAPE_COLORS_CSS[name])}>
                        <span className="size-3 rounded-full" style={{ backgroundColor: SHAPE_COLORS_CSS[name] }} />
                        {name}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
              </>
            )}

            <ContextMenuItem onClick={toggleLock}>
              {contextMenuTarget.locked ? "Unlock" : "Lock"} <ContextMenuShortcut>⇧⌘L</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />

            {/* Export as SVG */}
            <ContextMenuItem onClick={handleExportSVG}>Export as SVG</ContextMenuItem>
            <ContextMenuSeparator />

            <ContextMenuItem onClick={deleteSelected} className="text-red-600">
              Delete <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : (
          <>
            {clipboard.length > 0 && (
              <>
                <ContextMenuItem onClick={paste}>
                  Paste <ContextMenuShortcut>⌘V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem onClick={handleAddRect}>Add Rectangle</ContextMenuItem>
            <ContextMenuItem onClick={handleAddEllipse}>Add Ellipse</ContextMenuItem>
            <ContextMenuItem onClick={handleAddLine}>Add Line</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={resetView}>Fit to Screen</ContextMenuItem>
            <ContextMenuItem onClick={() => zoomTo(1)}>Zoom to 100%</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
