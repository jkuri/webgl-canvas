import { memo, useMemo, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import type { CanvasElement, GroupElement } from "@/types";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipseIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  ImageIcon,
  LayersIcon,
  LineIcon,
  LockIcon,
  PathIcon,
  PolygonIcon,
  RectIcon,
  TextIcon,
  UnlockIcon,
} from "./icons";

// ============================================
// LAYER ITEM COMPONENT
// ============================================

interface LayerItemProps {
  element: CanvasElement;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onToggleExpand: (id: string) => void;
}

// Get icon for element type
function getTypeIcon(type: string) {
  switch (type) {
    case "rect":
      return <RectIcon />;
    case "ellipse":
      return <EllipseIcon />;
    case "line":
      return <LineIcon />;
    case "path":
      return <PathIcon />;
    case "group":
      return <FolderIcon />;
    case "text":
      return <TextIcon />;
    case "image":
      return <ImageIcon />;
    case "polygon":
    case "polyline":
      return <PolygonIcon />;
    default:
      return <RectIcon />;
  }
}

const LayerItem = memo(
  ({ element, depth, isSelected, isExpanded, onSelect, onToggleExpand }: LayerItemProps) => {
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

    // Handlers
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

    // Context menu actions
    const handleContextRename = () => {
      setIsEditing(true);
      setEditName(element.name);
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
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(element.id, e.shiftKey || e.metaKey);
          }
        }}
      >
        {/* Expand/collapse button for groups */}
        <div className="flex w-4 shrink-0 items-center justify-center">
          {isGroup && (
            <button
              type="button"
              className="flex size-4 items-center justify-center rounded-sm hover:bg-muted-foreground/20"
              onClick={handleToggleExpand}
            >
              {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </button>
          )}
        </div>

        {/* Type icon */}
        <span className={cn("mr-2 shrink-0 opacity-70", isSelected && "opacity-100")}>{getTypeIcon(element.type)}</span>

        {/* Name */}
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="h-6 flex-1 px-1 text-xs"
            autoFocus
          />
        ) : (
          <span className="flex-1 truncate font-medium text-xs">{element.name}</span>
        )}

        {/* Action buttons */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100",
            (!isVisible || isLocked) && "opacity-100",
          )}
        >
          <button
            type="button"
            className={cn(
              "flex size-5 items-center justify-center rounded-sm hover:bg-muted-foreground/20",
              !isVisible && "text-muted-foreground",
            )}
            onClick={handleToggleVisibility}
            title={isVisible ? "Hide" : "Show"}
          >
            {isVisible ? <EyeIcon /> : <EyeOffIcon />}
          </button>
          <button
            type="button"
            className={cn(
              "flex size-5 items-center justify-center rounded-sm hover:bg-muted-foreground/20",
              isLocked && "text-muted-foreground",
            )}
            onClick={handleToggleLock}
            title={isLocked ? "Unlock" : "Lock"}
          >
            {isLocked ? <LockIcon /> : <UnlockIcon />}
          </button>
        </div>
      </div>
    );

    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger>{layerContent}</ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            {/* Rename */}
            <ContextMenuItem onClick={handleContextRename}>
              Rename
              <ContextMenuShortcut>Enter</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Copy/Paste/Duplicate */}
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

            {/* Layer ordering */}
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

            {/* Group/Ungroup */}
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

            {/* Lock/Unlock */}
            <ContextMenuItem onClick={handleContextLock}>
              {isLocked ? "Unlock" : "Lock"}
              <ContextMenuShortcut>⌘⇧L</ContextMenuShortcut>
            </ContextMenuItem>

            {/* Show/Hide */}
            <ContextMenuItem onClick={handleContextVisibility}>
              {isVisible ? "Hide" : "Show"}
              <ContextMenuShortcut>⌘⇧H</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Delete */}
            <ContextMenuItem onClick={handleContextDelete} className="text-destructive focus:text-destructive">
              Delete
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Render children if group is expanded */}
        {isGroup && isExpanded && (
          <div>
            {(element as GroupElement).childIds.map((childId) => (
              <LayerItemWrapper
                key={childId}
                elementId={childId}
                depth={depth + 1}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </div>
        )}
      </>
    );
  },
  (prev, next) => {
    // Custom comparator to ignore non-visual updates (position, size)
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

    // For groups, check childIds
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

// ============================================
// LAYER ITEM WRAPPER (connects to store)
// ============================================

interface LayerItemWrapperProps {
  elementId: string;
  depth: number;
  onSelect: (id: string, multiSelect: boolean) => void;
  onToggleExpand: (id: string) => void;
}

const LayerItemWrapper = ({ elementId, depth, onSelect, onToggleExpand }: LayerItemWrapperProps) => {
  // Subscribe directly to the element from store - this ensures we get updated state
  const element = useCanvasStore((s) => s.elements.find((e) => e.id === elementId));
  const isSelected = useCanvasStore((s) => s.selectedIds.includes(elementId));
  const isExpanded = useCanvasStore((s) => s.expandedGroupIds.includes(elementId));

  if (!element) return null;

  return (
    <LayerItem
      element={element}
      depth={depth}
      isSelected={isSelected}
      isExpanded={isExpanded}
      onSelect={onSelect}
      onToggleExpand={onToggleExpand}
    />
  );
};

// ============================================
// LAYERS PANEL
// ============================================

export function LayersPanel() {
  const elements = useCanvasStore((s) => s.elements);
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
  const toggleSelection = useCanvasStore((s) => s.toggleSelection);
  const toggleGroupExpanded = useCanvasStore((s) => s.toggleGroupExpanded);

  // Filter to top-level elements (no parent)
  const topLevelElements = useMemo(() => elements.filter((e) => !e.parentId), [elements]);

  const handleSelect = (id: string, multiSelect: boolean) => {
    if (multiSelect) {
      toggleSelection(id);
    } else {
      setSelectedIds([id]);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b bg-muted/30 px-3">
        <div className="flex items-center gap-2">
          <LayersIcon />
          <h3 className="font-medium text-sm">Layers</h3>
        </div>
        <span className="text-muted-foreground text-xs">{elements.length}</span>
      </div>

      {/* Layer list */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden py-1">
          {topLevelElements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs">
              <p>No layers</p>
              <p className="mt-1 opacity-50">Add a shape to start</p>
            </div>
          ) : (
            [...topLevelElements]
              .reverse()
              .map((element) => (
                <LayerItemWrapper
                  key={element.id}
                  elementId={element.id}
                  depth={0}
                  onSelect={handleSelect}
                  onToggleExpand={toggleGroupExpanded}
                />
              ))
          )}
        </div>
      </div>
    </>
  );
}
