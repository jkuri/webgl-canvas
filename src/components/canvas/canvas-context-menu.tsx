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
import {
  getRandomShapeColor,
  type RGBAColor,
  rgbaToCSS,
  SHAPE_COLOR_NAMES,
  SHAPE_COLORS,
  type ShapeColorName,
} from "@/lib/colors";
import { useCanvasStore } from "@/store";

interface CanvasContextMenuProps {
  children: React.ReactNode;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function CanvasContextMenu({ children, onContextMenu }: CanvasContextMenuProps) {
  const contextMenuTarget = useCanvasStore((s) => s.contextMenuTarget);
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
  const updateShape = useCanvasStore((s) => s.updateShape);
  const addShape = useCanvasStore((s) => s.addShape);
  const resetView = useCanvasStore((s) => s.resetView);
  const zoomTo = useCanvasStore((s) => s.zoomTo);

  const handleColorChange = (color: RGBAColor) => {
    if (contextMenuTarget) {
      updateShape(contextMenuTarget.id, { color });
    }
  };

  const handleAddRect = () => {
    addShape({
      id: crypto.randomUUID(),
      type: "rect",
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 100 + Math.random() * 100,
      height: 80 + Math.random() * 80,
      rotation: 0,
      color: getRandomShapeColor(),
    });
  };

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
            <ContextMenuSub>
              <ContextMenuSubTrigger>Change Color</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {SHAPE_COLOR_NAMES.map((name: ShapeColorName) => (
                  <ContextMenuItem key={name} onClick={() => handleColorChange(SHAPE_COLORS[name])}>
                    <span className="size-3 rounded-full" style={{ backgroundColor: rgbaToCSS(SHAPE_COLORS[name]) }} />
                    {name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={toggleLock}>
              {contextMenuTarget.locked ? "Unlock" : "Lock"} <ContextMenuShortcut>⇧⌘L</ContextMenuShortcut>
            </ContextMenuItem>
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
            <ContextMenuSeparator />
            <ContextMenuItem onClick={resetView}>Fit to Screen</ContextMenuItem>
            <ContextMenuItem onClick={() => zoomTo(1)}>Zoom to 100%</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
