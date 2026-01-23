import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  CircleIcon,
  Folder01Icon,
  Folder02Icon,
  Image01Icon,
  Layers01Icon,
  LineIcon,
  PolygonIcon,
  Route01Icon,
  SquareIcon,
  SquareLock01Icon,
  SquareUnlock02Icon,
  TextIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { List, type RowComponentProps } from "react-window";
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
import { Input } from "@/components/ui/input";
import { startJPGExportProcess, startPNGExportProcess, startSVGExportProcess } from "@/lib/svg-export";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import type { CanvasElement, GroupElement } from "@/types";

interface LayerItemProps {
  element: CanvasElement;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onToggleExpand: (id: string) => void;
  style?: React.CSSProperties;
}

function getTypeIcon(type: string, isExpanded?: boolean) {
  switch (type) {
    case "rect":
      return <HugeiconsIcon icon={SquareIcon} className="size-3.5" />;
    case "ellipse":
      return <HugeiconsIcon icon={CircleIcon} className="size-3.5" />;
    case "line":
      return <HugeiconsIcon icon={LineIcon} className="size-3.5" />;
    case "path":
      return <HugeiconsIcon icon={Route01Icon} className="size-3.5" />;
    case "group":
      return <HugeiconsIcon icon={isExpanded ? Folder02Icon : Folder01Icon} className="size-3.5" />;
    case "text":
      return <HugeiconsIcon icon={TextIcon} className="size-3.5" />;
    case "image":
      return <HugeiconsIcon icon={Image01Icon} className="size-3.5" />;
    case "polygon":
    case "polyline":
      return <HugeiconsIcon icon={PolygonIcon} className="size-3.5" />;
    default:
      return <HugeiconsIcon icon={SquareIcon} className="size-3.5" />;
  }
}

const LayerItem = memo(
  ({ element, depth, isSelected, isExpanded, onSelect, onToggleExpand, style }: LayerItemProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(element.name);

    const setElementVisibility = useCanvasStore((s) => s.setElementVisibility);
    const renameElement = useCanvasStore((s) => s.renameElement);
    const updateElement = useCanvasStore((s) => s.updateElement);
    const deleteElement = useCanvasStore((s) => s.deleteElement);
    const duplicateSelected = useCanvasStore((s) => s.duplicateSelected);
    const copySelected = useCanvasStore((s) => s.copySelected);
    const paste = useCanvasStore((s) => s.paste);
    const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
    const groupSelected = useCanvasStore((s) => s.groupSelected);
    const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);
    const bringToFront = useCanvasStore((s) => s.bringToFront);
    const sendToBack = useCanvasStore((s) => s.sendToBack);
    const bringForward = useCanvasStore((s) => s.bringForward);
    const sendBackward = useCanvasStore((s) => s.sendBackward);

    const isGroup = element.type === "group";
    const isVisible = element.visible !== false;
    const isLocked = element.locked === true;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id, e.shiftKey || e.metaKey);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      setEditName(element.name);
    };

    const handleRename = () => {
      if (editName.trim() && editName !== element.name) {
        renameElement(element.id, editName.trim());
      }
      setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleRename();
      } else if (e.key === "Escape") {
        setEditName(element.name);
        setIsEditing(false);
      }
    };

    const handleToggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand(element.id);
    };

    const handleToggleVisibility = (e: React.MouseEvent) => {
      e.stopPropagation();
      setElementVisibility(element.id, !isVisible);
    };

    const handleToggleLock = (e: React.MouseEvent) => {
      e.stopPropagation();
      updateElement(element.id, { locked: !isLocked });
    };

    const handleContextRename = () => {
      setIsEditing(true);
      setEditName(element.name);
    };

    const handleContextExportSVG = () => {
      startSVGExportProcess([element]);
    };

    const handleContextExportPNG = () => {
      startPNGExportProcess([element]);
    };

    const handleContextExportJPG = () => {
      startJPGExportProcess([element]);
    };

    const handleContextDuplicate = () => {
      setSelectedIds([element.id]);
      duplicateSelected();
    };

    const handleContextDelete = () => {
      deleteElement(element.id);
    };

    const handleContextCopy = () => {
      setSelectedIds([element.id]);
      copySelected();
    };

    const handleContextPaste = () => {
      paste();
    };

    const handleContextLock = () => {
      updateElement(element.id, { locked: !isLocked });
    };

    const handleContextVisibility = () => {
      setElementVisibility(element.id, !isVisible);
    };

    const handleContextGroup = () => {
      if (!isSelected) {
        setSelectedIds([element.id]);
      }
      groupSelected();
    };

    const handleContextUngroup = () => {
      if (isGroup) {
        setSelectedIds([element.id]);
        ungroupSelected();
      }
    };

    const handleContextBringToFront = () => {
      bringToFront(element.id);
    };

    const handleContextSendToBack = () => {
      sendToBack(element.id);
    };

    const handleContextBringForward = () => {
      bringForward(element.id);
    };

    const handleContextSendBackward = () => {
      sendBackward(element.id);
    };

    const layerContent = (
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "group flex h-7 cursor-pointer items-center pr-2 text-sm transition-colors",
          isSelected
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        style={{ paddingLeft: depth * 12 + 8, ...style }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(element.id, e.shiftKey || e.metaKey);
          }
        }}
      >
        {}
        <div className="flex w-4 shrink-0 items-center justify-center">
          {isGroup && (
            <button
              type="button"
              className="flex size-4 items-center justify-center rounded-sm hover:opacity-70 focus:outline-none focus-visible:ring-0"
              onClick={handleToggleExpand}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isExpanded ? (
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
              ) : (
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              )}
            </button>
          )}
        </div>

        {}
        <span className={cn("mr-2 shrink-0 opacity-70", isSelected && "opacity-100")}>
          {getTypeIcon(element.type, isExpanded)}
        </span>

        {}
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="h-6 flex-1 px-1 text-xs"
            autoFocus
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate font-medium text-xs">{element.name}</span>
        )}

        {}
        <div
          className={cn("flex shrink-0 items-center gap-1 transition-opacity", !isSelected && "text-muted-foreground")}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={cn(
              "flex size-5 items-center justify-center rounded-sm hover:opacity-100 focus:outline-none focus-visible:ring-0",
              !isVisible && "text-muted-foreground",
            )}
            onClick={handleToggleVisibility}
            title={isVisible ? "Hide" : "Show"}
          >
            {isVisible ? (
              <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
            ) : (
              <HugeiconsIcon icon={ViewOffSlashIcon} className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            className={cn(
              "flex size-5 items-center justify-center rounded-sm hover:opacity-100 focus:outline-none focus-visible:ring-0",
              isLocked && "text-muted-foreground",
            )}
            onClick={handleToggleLock}
            title={isLocked ? "Unlock" : "Lock"}
          >
            {isLocked ? (
              <HugeiconsIcon icon={SquareLock01Icon} className="size-3.5" />
            ) : (
              <HugeiconsIcon icon={SquareUnlock02Icon} className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    );

    return (
      <ContextMenu>
        <ContextMenuTrigger>{layerContent}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {}
          <ContextMenuItem onClick={handleContextRename}>
            Rename
            <ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {}
          <ContextMenuItem onClick={handleContextCopy}>
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleContextPaste}>
            Paste
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleContextDuplicate}>
            Duplicate
            <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {}
          <ContextMenuItem onClick={handleContextBringToFront}>
            Bring to Front
            <ContextMenuShortcut>⌘]</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleContextBringForward}>
            Bring Forward
            <ContextMenuShortcut>]</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleContextSendBackward}>
            Send Backward
            <ContextMenuShortcut>[</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleContextSendToBack}>
            Send to Back
            <ContextMenuShortcut>⌘[</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {}
          {isGroup ? (
            <ContextMenuItem onClick={handleContextUngroup}>
              Ungroup
              <ContextMenuShortcut>⌘⇧G</ContextMenuShortcut>
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={handleContextGroup}>
              Group Selection
              <ContextMenuShortcut>⌘G</ContextMenuShortcut>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {}
          <ContextMenuItem onClick={handleContextLock}>
            {isLocked ? "Unlock" : "Lock"}
            <ContextMenuShortcut>⌘⇧L</ContextMenuShortcut>
          </ContextMenuItem>

          {}
          <ContextMenuItem onClick={handleContextVisibility}>
            {isVisible ? "Hide" : "Show"}
            <ContextMenuShortcut>⌘⇧H</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>Export</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={handleContextExportSVG}>Export as SVG</ContextMenuItem>
              <ContextMenuItem onClick={handleContextExportPNG}>Export as PNG</ContextMenuItem>
              <ContextMenuItem onClick={handleContextExportJPG}>Export as JPG</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {}
          <ContextMenuItem onClick={handleContextDelete} className="text-destructive focus:text-destructive">
            Delete
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
  (prev, next) => {
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isExpanded !== next.isExpanded) return false;
    if (prev.depth !== next.depth) return false;

    const p = prev.element;
    const n = next.element;

    if (p.id !== n.id) return false;
    if (p.name !== n.name) return false;
    if (p.visible !== n.visible) return false;
    if (p.locked !== n.locked) return false;
    if (p.type !== n.type) return false;

    if (p.type === "group" && n.type === "group") {
      const pg = p as GroupElement;
      const ng = n as GroupElement;
      if (pg.childIds.length !== ng.childIds.length) return false;
      for (let i = 0; i < pg.childIds.length; i++) {
        if (pg.childIds[i] !== ng.childIds[i]) return false;
      }
    }

    return true;
  },
);

interface SortableLayerItemProps {
  elementId: string;
  depth: number;
  onSelect: (id: string, multiSelect: boolean) => void;
  onToggleExpand: (id: string) => void;
}

const SortableLayerItem = ({ elementId, depth, onSelect, onToggleExpand }: SortableLayerItemProps) => {
  const element = useCanvasStore((s) => s.elements.find((e) => e.id === elementId));
  const isSelected = useCanvasStore((s) => s.selectedIds.includes(elementId));
  const isExpanded = useCanvasStore((s) => s.expandedGroupIds.includes(elementId));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: elementId,
    data: {
      type: "layer",
      element,
      depth,
      isGroup: element?.type === "group",
      isExpanded,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  if (!element) return null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LayerItem
        element={element}
        depth={depth}
        isSelected={isSelected}
        isExpanded={isExpanded}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
};

interface FlatItem {
  id: string;
  depth: number;
}

interface VirtualizedRowProps {
  flatItems: FlatItem[];
  handleSelect: (id: string, multiSelect: boolean) => void;
  toggleGroupExpanded: (id: string) => void;
}

function VirtualizedRow(props: RowComponentProps<VirtualizedRowProps>) {
  const { index, style, flatItems, handleSelect, toggleGroupExpanded } = props;
  const item = flatItems[index];
  if (!item) return <div style={style} />;

  return (
    <div style={style}>
      <SortableLayerItem
        elementId={item.id}
        depth={item.depth}
        onSelect={handleSelect}
        onToggleExpand={toggleGroupExpanded}
      />
    </div>
  );
}

export function LayersPanel() {
  const elements = useCanvasStore((s) => s.elements);
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
  const toggleSelection = useCanvasStore((s) => s.toggleSelection);
  const toggleGroupExpanded = useCanvasStore((s) => s.toggleGroupExpanded);
  const expandedGroupIds = useCanvasStore((s) => s.expandedGroupIds);
  const moveElement = useCanvasStore((s) => s.moveElement);

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [containerHeight, setContainerHeight] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateContainerHeight = useCallback(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    updateContainerHeight();
    window.addEventListener("resize", updateContainerHeight);
    return () => window.removeEventListener("resize", updateContainerHeight);
  }, [updateContainerHeight]);

  const flatItems = useMemo(() => {
    const items: FlatItem[] = [];

    const traverse = (elementId: string, depth: number) => {
      items.push({ id: elementId, depth });

      const element = elements.find((e) => e.id === elementId);
      if (element?.type === "group" && expandedGroupIds.includes(elementId)) {
        const group = element as GroupElement;
        const reversedChildren = [...group.childIds].reverse();
        for (const childId of reversedChildren) {
          traverse(childId, depth + 1);
        }
      }
    };

    const topLevel = elements.filter((e) => !e.parentId);

    const reversedTopLevel = [...topLevel].reverse();
    for (const e of reversedTopLevel) {
      traverse(e.id, 0);
    }

    return items;
  }, [elements, expandedGroupIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const oldIndex = flatItems.findIndex((x) => x.id === activeId);
    const newIndex = flatItems.findIndex((x) => x.id === overId);

    const targetItem = flatItems[newIndex];
    const targetElement = elements.find((e) => e.id === targetItem.id);

    let position: "before" | "after" | "inside" = "after";

    if (newIndex > oldIndex) {
      position = "before";

      if (targetElement?.type === "group" && expandedGroupIds.includes(targetItem.id)) {
        position = "inside";
      }
    } else {
      position = "after";
    }

    moveElement(activeId, overId, position);
  };

  const handleSelect = (id: string, multiSelect: boolean) => {
    if (multiSelect) {
      toggleSelection(id);
    } else {
      setSelectedIds([id]);
    }
  };

  const activeElement = activeId ? elements.find((e) => e.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {}
      <div className="flex h-10 items-center justify-between border-b bg-muted/30 px-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Layers01Icon} className="size-4" />
          <h3 className="font-medium text-sm">Layers</h3>
        </div>
        <span className="text-muted-foreground text-xs">{elements.length}</span>
      </div>

      {}
      <div className="flex flex-1 flex-col overflow-hidden" ref={containerRef}>
        {flatItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs">
            <p>No layers</p>
            <p className="mt-1 opacity-50">Add a shape to start</p>
          </div>
        ) : (
          <SortableContext items={flatItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <List
              rowCount={flatItems.length}
              rowHeight={28}
              defaultHeight={containerHeight}
              rowComponent={VirtualizedRow}
              rowProps={{ flatItems, handleSelect, toggleGroupExpanded }}
              className="custom-scrollbar"
            />
          </SortableContext>
        )}
      </div>

      {createPortal(
        <DragOverlay>
          {activeElement ? (
            <LayerItem
              element={activeElement}
              depth={0}
              isSelected={true}
              isExpanded={false}
              onSelect={() => {}}
              onToggleExpand={() => {}}
              style={{ opacity: 0.8 }}
            />
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
