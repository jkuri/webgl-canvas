import {
  CenterFocusIcon,
  Cursor01Icon,
  FourFinger02Icon,
  MinusSignIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { FoilLogo } from "@/components/ui/foil-logo";
import { Separator } from "@/components/ui/separator";
import { canvasHistory } from "@/lib/canvas-history";
import { getRandomShapeColorCSS } from "@/lib/colors";
import { importSVGFromFile, translatePath } from "@/lib/svg-import";
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
  const panToCenter = useCanvasStore((s) => s.panToCenter);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const snapToObjects = useCanvasStore((s) => s.snapToObjects);
  const setSnapToGrid = useCanvasStore((s) => s.setSnapToGrid);
  const setSnapToObjects = useCanvasStore((s) => s.setSnapToObjects);
  const importElements = useCanvasStore((s) => s.importElements);

  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleImportSVG = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedElements = await importSVGFromFile(file);
      if (importedElements.length > 0) {
        // Calculate bounding box of all imported elements
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const el of importedElements) {
          if (el.type === "rect" || el.type === "image") {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + el.width);
            maxY = Math.max(maxY, el.y + el.height);
          } else if (el.type === "ellipse") {
            minX = Math.min(minX, el.cx - el.rx);
            minY = Math.min(minY, el.cy - el.ry);
            maxX = Math.max(maxX, el.cx + el.rx);
            maxY = Math.max(maxY, el.cy + el.ry);
          } else if (el.type === "line") {
            minX = Math.min(minX, el.x1, el.x2);
            minY = Math.min(minY, el.y1, el.y2);
            maxX = Math.max(maxX, el.x1, el.x2);
            maxY = Math.max(maxY, el.y1, el.y2);
          } else if (el.type === "path") {
            minX = Math.min(minX, el.bounds.x);
            minY = Math.min(minY, el.bounds.y);
            maxX = Math.max(maxX, el.bounds.x + el.bounds.width);
            maxY = Math.max(maxY, el.bounds.y + el.bounds.height);
          } else if (el.type === "polygon" || el.type === "polyline") {
            for (const pt of el.points) {
              minX = Math.min(minX, pt.x);
              minY = Math.min(minY, pt.y);
              maxX = Math.max(maxX, pt.x);
              maxY = Math.max(maxY, pt.y);
            }
          } else if (el.type === "text") {
            // Approximate text bounds
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y - el.fontSize);
            maxX = Math.max(maxX, el.x + el.text.length * el.fontSize * 0.6);
            maxY = Math.max(maxY, el.y);
          }
        }

        // Calculate offset to center
        const importedCenterX = (minX + maxX) / 2;
        const importedCenterY = (minY + maxY) / 2;
        const viewCenterX = (window.innerWidth / 2 - transform.x) / transform.scale;
        const viewCenterY = (window.innerHeight / 2 - transform.y) / transform.scale;
        const offsetX = viewCenterX - importedCenterX;
        const offsetY = viewCenterY - importedCenterY;

        // Apply offset to all elements
        const centeredElements = importedElements.map((el) => {
          if (el.type === "rect" || el.type === "image") {
            return { ...el, x: el.x + offsetX, y: el.y + offsetY };
          }
          if (el.type === "ellipse") {
            return { ...el, cx: el.cx + offsetX, cy: el.cy + offsetY };
          }
          if (el.type === "line") {
            return {
              ...el,
              x1: el.x1 + offsetX,
              y1: el.y1 + offsetY,
              x2: el.x2 + offsetX,
              y2: el.y2 + offsetY,
            };
          }
          if (el.type === "path") {
            const newD = translatePath(el.d, offsetX, offsetY);
            // For paths, we need to offset the bounds AND transform the d attribute
            return {
              ...el,
              d: newD,
              bounds: {
                ...el.bounds,
                x: el.bounds.x + offsetX,
                y: el.bounds.y + offsetY,
              },
            };
          }
          if (el.type === "polygon" || el.type === "polyline") {
            return {
              ...el,
              points: el.points.map((pt) => ({ x: pt.x + offsetX, y: pt.y + offsetY })),
            };
          }
          if (el.type === "text") {
            return { ...el, x: el.x + offsetX, y: el.y + offsetY };
          }
          return el;
        });

        importElements(centeredElements);
      }
    } catch (error) {
      console.error("Failed to import SVG:", error);
    }

    // Reset input so same file can be imported again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

  const handleAddText = () => {
    const center = getCenter();
    const newTextId = crypto.randomUUID();
    const fontSize = 16;
    const text = "Text";

    // Calculate initial bounds
    const textWidth = text.length * fontSize * 0.6;
    const textHeight = fontSize * 1.2;

    addElement({
      id: newTextId,
      type: "text",
      name: `Text ${elements.filter((e) => e.type === "text").length + 1}`,
      x: center.x,
      y: center.y,
      text,
      fontSize,
      fontFamily: "Inter, sans-serif",
      fontWeight: "normal",
      textAnchor: "start",
      rotation: 0,
      fill: "#000000",
      stroke: null,
      opacity: 1,
      bounds: {
        x: center.x,
        y: center.y - textHeight,
        width: textWidth,
        height: textHeight,
      },
    });
    // Automatically enter edit mode for new text
    setTimeout(() => {
      useCanvasStore.getState().setIsEditingText(true, newTextId);
    }, 10);
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
    { id: "text", label: "Text", action: handleAddText },
  ];

  return (
    <>
      {/* Hidden file input for SVG import */}
      <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleImportSVG} />
      {/* Hidden file input for JSON project import */}
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.elements && Array.isArray(data.elements)) {
              canvasHistory.clear();
              useCanvasStore.setState({
                elements: data.elements,
                selectedIds: [],
                canvasBackground: data.canvasBackground || "#F5F5F5",
                canvasBackgroundVisible: data.canvasBackgroundVisible ?? true,
                transform: data.transform || { x: 0, y: 0, scale: 1 },
              });
              useCanvasStore.getState().panToCenter();
            } else {
              console.error("Invalid project file format");
            }
          } catch (error) {
            console.error("Failed to open project:", error);
          }
          // Reset input so same file can be opened again
          e.target.value = "";
        }}
      />
      <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-background/80 p-1.5 shadow-2xl backdrop-blur-md">
        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-md outline-none ring-offset-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
            <FoilLogo className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-56">
            {/* File Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>File</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setIsNewProjectDialogOpen(true)}>New Project</DropdownMenuItem>
                <DropdownMenuItem onClick={() => jsonInputRef.current?.click()}>Open...</DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>Import SVG...</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => useCanvasStore.getState().exportProject()}>Export</DropdownMenuItem>
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
                <DropdownMenuItem onClick={panToCenter}>Center All Elements</DropdownMenuItem>
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
              className="h-8 rounded-lg px-2 text-xs"
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
            <DropdownMenuTrigger className="flex h-8 min-w-12 items-center justify-center rounded-md px-2 text-xs ring-offset-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={panToCenter}
            title="Center All Elements"
          >
            <HugeiconsIcon icon={CenterFocusIcon} size={16} />
          </Button>
        </div>
      </div>

      <AlertDialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Project?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            This action cannot be undone. Your current project and all its history will be deleted permanently. Make
            sure you export the current project just in case.
          </AlertDialogDescription>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                useCanvasStore.getState().newProject();
                setIsNewProjectDialogOpen(false);
              }}
            >
              Create New Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
