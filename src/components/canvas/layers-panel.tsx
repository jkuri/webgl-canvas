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
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Layers01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { List, type RowComponentProps } from "react-window";
import { useCanvasStore } from "@/store";
import type { GroupElement } from "@/types";
import { LayerItem } from "./layer-item";

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
      <SortableLayerItem elementId={item.id} depth={item.depth} onSelect={handleSelect} onToggleExpand={toggleGroupExpanded} />
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-10 items-center justify-between border-b bg-muted/30 px-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Layers01Icon} className="size-4" />
          <h3 className="font-medium text-sm">Layers</h3>
        </div>
        <span className="text-muted-foreground text-xs">{elements.length}</span>
      </div>

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
