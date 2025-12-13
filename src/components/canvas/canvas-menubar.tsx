import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { getRandomShapeColorCSS } from "@/lib/colors";
import { useCanvasStore } from "@/store";
import { FigmaIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function CanvasMenubar() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);
  const transform = useCanvasStore((s) => s.transform);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const duplicateSelected = useCanvasStore((s) => s.duplicateSelected);
  const selectAll = useCanvasStore((s) => s.selectAll);
  const addElement = useCanvasStore((s) => s.addElement);
  const zoomIn = useCanvasStore((s) => s.zoomIn);
  const zoomOut = useCanvasStore((s) => s.zoomOut);
  const zoomTo = useCanvasStore((s) => s.zoomTo);
  const resetView = useCanvasStore((s) => s.resetView);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const snapToObjects = useCanvasStore((s) => s.snapToObjects);
  const setSnapToGrid = useCanvasStore((s) => s.setSnapToGrid);
  const setSnapToObjects = useCanvasStore((s) => s.setSnapToObjects);

  const getCenter = () => {
    const centerX = (window.innerWidth / 2 - transform.x) / transform.scale;
    const centerY = (window.innerHeight / 2 - transform.y) / transform.scale;
    return { x: centerX, y: centerY };
  };

  const handleAddRect = () => {
    const center = getCenter();
    addElement({
      id: crypto.randomUUID(),
      type: "rect",
      name: `Rectangle ${elements.filter((e) => e.type === "rect").length + 1}`,
      x: center.x - 50,
      y: center.y - 40,
      width: 100,
      height: 80,
      rotation: 0,
      fill: getRandomShapeColorCSS(),
      stroke: null,
      opacity: 1,
    });
  };

  const handleAddEllipse = () => {
    const center = getCenter();
    addElement({
      id: crypto.randomUUID(),
      type: "ellipse",
      name: `Ellipse ${elements.filter((e) => e.type === "ellipse").length + 1}`,
      cx: center.x,
      cy: center.y,
      rx: 50,
      ry: 40,
      rotation: 0,
      fill: getRandomShapeColorCSS(),
      stroke: null,
      opacity: 1,
    });
  };

  const handleAddLine = () => {
    const center = getCenter();
    addElement({
      id: crypto.randomUUID(),
      type: "line",
      name: `Line ${elements.filter((e) => e.type === "line").length + 1}`,
      x1: center.x - 50,
      y1: center.y,
      x2: center.x + 50,
      y2: center.y,
      rotation: 0,
      fill: null,
      stroke: { color: getRandomShapeColorCSS(), width: 2 },
      opacity: 1,
    });
  };

  // Check if any selected element is a group
  const hasGroupSelected = selectedIds.some((id) => {
    const el = elements.find((e) => e.id === id);
    return el?.type === "group";
  });

  return (
    <div className="flex h-12 w-full items-center border-b px-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-md outline-none hover:bg-accent">
          <HugeiconsIcon icon={FigmaIcon} className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={5} className="w-56">
          {/* File Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                File
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                <DropdownMenuItem disabled>New Project</DropdownMenuItem>
                <DropdownMenuItem disabled>Open...</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Export</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Edit Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                Edit
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                <DropdownMenuItem disabled>
                    Undo <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                    Redo <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={duplicateSelected} disabled={selectedIds.length === 0}>
                    Duplicate <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={deleteSelected} disabled={selectedIds.length === 0}>
                    Delete <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={selectAll}>
                    Select All <DropdownMenuShortcut>⌘A</DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

           {/* View Submenu */}
           <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                View
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
                <DropdownMenuItem onClick={zoomIn}>
                    Zoom In <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={zoomOut}>
                    Zoom Out <DropdownMenuShortcut>⌘-</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => zoomTo(1)}>
                    Zoom to 100% <DropdownMenuShortcut>⌘0</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={resetView}>
                    Fit to Screen
                </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Object Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                Object
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                 <DropdownMenuItem onClick={groupSelected} disabled={selectedIds.length < 2}>
                    Group <DropdownMenuShortcut>⌘G</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={ungroupSelected} disabled={!hasGroupSelected}>
                    Ungroup <DropdownMenuShortcut>⇧⌘G</DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

           {/* Insert Submenu */}
           <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                Insert
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                <DropdownMenuItem onClick={handleAddRect}>Rectangle</DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddEllipse}>Ellipse</DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddLine}>Line</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Preferences Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              Preferences
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuCheckboxItem
                checked={snapToObjects}
                onCheckedChange={setSnapToObjects}
              >
                Snap to objects
              </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={useCanvasStore((s) => s.snapToGeometry)}
              onCheckedChange={(c) => useCanvasStore.getState().setSnapToGeometry(c)}
            >
              Snap to geometry
            </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={snapToGrid}
                onCheckedChange={setSnapToGrid}
              >
                Snap to pixel grid <DropdownMenuShortcut>⇧⌘'</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
