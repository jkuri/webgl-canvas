import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useCanvasStore } from "@/store";

export function CanvasMenubar() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const duplicateSelected = useCanvasStore((s) => s.duplicateSelected);
  const selectAll = useCanvasStore((s) => s.selectAll);
  const addShape = useCanvasStore((s) => s.addShape);
  const zoomIn = useCanvasStore((s) => s.zoomIn);
  const zoomOut = useCanvasStore((s) => s.zoomOut);
  const zoomTo = useCanvasStore((s) => s.zoomTo);
  const resetView = useCanvasStore((s) => s.resetView);

  const handleAddRect = () => {
    const colors: [number, number, number, number][] = [
      [0.4, 0.6, 1, 1],
      [1, 0.5, 0.3, 1],
      [0.5, 0.9, 0.5, 1],
      [0.9, 0.4, 0.8, 1],
      [0.3, 0.8, 0.8, 1],
    ];
    addShape({
      id: crypto.randomUUID(),
      type: "rect",
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 100 + Math.random() * 100,
      height: 80 + Math.random() * 80,
      rotation: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
      <Menubar className="pointer-events-auto shadow-md">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem disabled>New Project</MenubarItem>
            <MenubarItem disabled>Open...</MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled>Export</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem disabled>
              Undo <MenubarShortcut>⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled>
              Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={duplicateSelected} disabled={selectedIds.length === 0}>
              Duplicate <MenubarShortcut>⌘D</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={deleteSelected} disabled={selectedIds.length === 0}>
              Delete <MenubarShortcut>⌫</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={selectAll}>
              Select All <MenubarShortcut>⌘A</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>Insert</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={handleAddRect}>Rectangle</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent className="w-42">
            <MenubarItem onClick={zoomIn}>
              Zoom In <MenubarShortcut>⌘+</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={zoomOut}>
              Zoom Out <MenubarShortcut>⌘-</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => zoomTo(1)}>
              Zoom to 100% <MenubarShortcut>⌘0</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={resetView}>Fit to Screen</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}
