import {
  Cursor01Icon,
  FigmaIcon,
  FourFinger02Icon,
  MinusSignIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { getRandomShapeColorCSS } from "@/lib/colors";
import { useCanvasStore } from "@/store";

const ZOOM_PRESETS = [
  { label: "50%", value: 0.5 },
  { label: "100%", value: 1 },
  { label: "200%", value: 2 },
];

export function CanvasToolbar() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const transform = useCanvasStore((s) => s.transform);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
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

  const tools = [
    { id: "select" as const, icon: Cursor01Icon, label: "Select (V)", action: () => setActiveTool("select") },
    { id: "pan" as const, icon: FourFinger02Icon, label: "Pan (H)", action: () => setActiveTool("pan") },
  ];

  const shapes = [
    { id: "rect", label: "Rect", action: handleAddRect },
    { id: "ellipse", label: "Circle", action: handleAddEllipse },
    { id: "line", label: "Line", action: handleAddLine },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-background/80 p-1.5 shadow-2xl backdrop-blur-md">
      {/* Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-md outline-none hover:bg-accent ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
          <HugeiconsIcon icon={FigmaIcon} className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-56">
          {/* File Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>File</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem disabled>New Project</DropdownMenuItem>
              <DropdownMenuItem disabled>Open...</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Export</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Edit Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Edit</DropdownMenuSubTrigger>
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
            <DropdownMenuSubTrigger>View</DropdownMenuSubTrigger>
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
              <DropdownMenuItem onClick={resetView}>Fit to Screen</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Object Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Object</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={groupSelected} disabled={selectedIds.length < 2}>
                Group <DropdownMenuShortcut>⌘G</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={ungroupSelected} disabled={!hasGroupSelected}>
                Ungroup <DropdownMenuShortcut>⇧⌘G</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Preferences Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Preferences</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuCheckboxItem checked={snapToObjects} onCheckedChange={setSnapToObjects}>
                Snap to objects
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={useCanvasStore((s) => s.snapToGeometry)}
                onCheckedChange={(c) => useCanvasStore.getState().setSnapToGeometry(c)}
              >
                Snap to geometry
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={snapToGrid} onCheckedChange={setSnapToGrid}>
                Snap to pixel grid <DropdownMenuShortcut>⇧⌘'</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Tools */}
      <div className="flex items-center gap-0.5">
        {tools.map((tool) => (
          <Button
            key={tool.id}
            variant={activeTool === tool.id ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={tool.action}
            title={tool.label}
          >
            <HugeiconsIcon icon={tool.icon} className="size-5" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Shapes */}
      <div className="flex items-center gap-0.5">
        {shapes.map((shape) => (
          <Button
            key={shape.id}
            variant="ghost"
            size="sm"
            className="h-8 px-2 rounded-lg text-xs"
            onClick={shape.action}
            title={shape.label}
          >
            {shape.label}
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Zoom */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={zoomOut} title="Zoom Out">
          <HugeiconsIcon icon={MinusSignIcon} size={16} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-8 min-w-12 items-center justify-center rounded-md px-2 text-xs hover:bg-accent ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
              {Math.round(transform.scale * 100)}%
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" sideOffset={10}>
             {ZOOM_PRESETS.map((preset) => (
                <DropdownMenuItem key={preset.value} onClick={() => zoomTo(preset.value)}>
                  {preset.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetView}>Fit to Screen</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={zoomIn} title="Zoom In">
          <HugeiconsIcon icon={PlusSignIcon} size={16} />
        </Button>
      </div>
    </div>
  );
}
