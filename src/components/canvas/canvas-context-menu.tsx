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
import { COLOR_PICKER_PRESETS, getRandomShapeColorCSS } from "@/lib/colors";
import { startJPGExportProcess, startPNGExportProcess, startSVGExportProcess } from "@/lib/svg-export";
import { convertTextToPath, type TextConversionResult } from "@/lib/text-to-path";
import { useCanvasStore } from "@/store";
import type { TextElement } from "@/types";

interface CanvasContextMenuProps {
  children: React.ReactNode;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function CanvasContextMenu({ children, onContextMenu }: CanvasContextMenuProps) {
  const contextMenuTarget = useCanvasStore((s) => s.contextMenuTarget);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);
  const transform = useCanvasStore((s) => s.transform);
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
  const setViewMode = useCanvasStore((s) => s.setViewMode);
  const isViewMode = useCanvasStore((s) => s.isViewMode);

  const handleColorChange = (color: string) => {
    if (contextMenuTarget) {
      updateElement(contextMenuTarget.id, { fill: color });
    }
  };

  const getPosition = (e?: React.MouseEvent) => {
    if (e) {
      return {
        x: (e.clientX - transform.x) / transform.scale,
        y: (e.clientY - transform.y) / transform.scale,
      };
    }
    return {
      x: (window.innerWidth / 2 - transform.x) / transform.scale,
      y: (window.innerHeight / 2 - transform.y) / transform.scale,
    };
  };

  const handleAddRect = (e?: React.MouseEvent) => {
    const pos = getPosition(e);
    addElement({
      id: crypto.randomUUID(),
      type: "rect",
      name: `Rectangle ${elements.filter((e) => e.type === "rect").length + 1}`,
      x: pos.x - 50,
      y: pos.y - 40,
      width: 100,
      height: 80,
      rotation: 0,
      fill: getRandomShapeColorCSS(),
      stroke: null,
      opacity: 1,
    });
  };

  const handleAddEllipse = (e?: React.MouseEvent) => {
    const pos = getPosition(e);
    addElement({
      id: crypto.randomUUID(),
      type: "ellipse",
      name: `Ellipse ${elements.filter((e) => e.type === "ellipse").length + 1}`,
      cx: pos.x,
      cy: pos.y,
      rx: 50,
      ry: 40,
      rotation: 0,
      fill: getRandomShapeColorCSS(),
      stroke: null,
      opacity: 1,
    });
  };

  const handleAddLine = (e?: React.MouseEvent) => {
    const pos = getPosition(e);
    addElement({
      id: crypto.randomUUID(),
      type: "line",
      name: `Line ${elements.filter((e) => e.type === "line").length + 1}`,
      x1: pos.x - 50,
      y1: pos.y,
      x2: pos.x + 50,
      y2: pos.y,
      rotation: 0,
      fill: null,
      stroke: { color: getRandomShapeColorCSS(), width: 2 },
      opacity: 1,
    });
  };

  const handleExportSVG = () => {
    const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
    if (selectedElements.length === 0) return;

    startSVGExportProcess(selectedElements);
  };

  const handleExportPNG = () => {
    const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
    if (selectedElements.length === 0) return;

    startPNGExportProcess(selectedElements);
  };

  const handleExportJPG = () => {
    const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
    if (selectedElements.length === 0) return;

    startJPGExportProcess(selectedElements);
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

            {}
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

            {}
            {!isGroup && (
              <>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>Change Color</ContextMenuSubTrigger>
                  <ContextMenuSubContent className="grid w-50 grid-cols-8 gap-1 p-2">
                    {COLOR_PICKER_PRESETS.map((color) => (
                      <ContextMenuItem
                        key={color}
                        onClick={() => handleColorChange(color)}
                        className="flex size-5 min-h-0 items-center justify-center rounded-sm border border-border/50 p-0"
                      >
                        <div className="size-full rounded-sm" style={{ backgroundColor: color }} />
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

            {}
            <ContextMenuSub>
              <ContextMenuSubTrigger>Export</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={handleExportSVG}>Export as SVG</ContextMenuItem>
                <ContextMenuItem onClick={handleExportPNG}>Export as PNG</ContextMenuItem>
                <ContextMenuItem onClick={handleExportJPG}>Export as JPG</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />

            {}
            {contextMenuTarget.type === "text" && (
              <>
                <ContextMenuItem
                  onClick={async () => {
                    const result: TextConversionResult = await convertTextToPath(contextMenuTarget as TextElement);
                    if (result?.group && result.paths) {
                      const textIdToDelete = contextMenuTarget.id;
                      const pathIds: string[] = [];

                      for (const path of result.paths) {
                        addElement(path);
                        pathIds.push(path.id);
                      }

                      useCanvasStore.getState().setSelectedIds(pathIds);
                      useCanvasStore.getState().groupSelected();

                      setTimeout(() => {
                        useCanvasStore.getState().deleteElement(textIdToDelete);
                      }, 50);
                    }
                  }}
                >
                  Convert to Outlines
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            <ContextMenuItem onClick={deleteSelected} className="text-red-600">
              Delete <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : isViewMode ? (
          <>
            <ContextMenuItem onClick={resetView}>Fit to Screen</ContextMenuItem>
            <ContextMenuItem onClick={() => zoomTo(1)}>Zoom to 100%</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => setViewMode(false)}>Switch to Edit Mode</ContextMenuItem>
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
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => setViewMode(true)}>Switch to View Mode</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
