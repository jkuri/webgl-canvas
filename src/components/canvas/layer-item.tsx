import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  CircleIcon,
  Folder01Icon,
  Folder02Icon,
  Image01Icon,
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
import { memo, useState } from "react";
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

export interface LayerItemProps {
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

export const LayerItem = memo(
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
          isSelected ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
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

        <span className={cn("mr-2 shrink-0 opacity-70", isSelected && "opacity-100")}>{getTypeIcon(element.type, isExpanded)}</span>

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
          <ContextMenuItem onClick={handleContextRename}>
            Rename
            <ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

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

          <ContextMenuItem onClick={handleContextLock}>
            {isLocked ? "Unlock" : "Lock"}
            <ContextMenuShortcut>⌘⇧L</ContextMenuShortcut>
          </ContextMenuItem>

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
