import { useCanvasStore } from "@/store";
import type { PendingUpdate } from "./types";

let pendingUpdate: PendingUpdate | null = null;
let rafScheduled = false;

function flushPendingUpdate() {
  if (!pendingUpdate) return;

  const update = pendingUpdate;
  pendingUpdate = null;
  rafScheduled = false;

  const { updateElements, updateElement, setSelectionBox, setSelectedIds, setSmartGuides } = useCanvasStore.getState();

  if (update.updates && update.updates.size > 0) {
    updateElements(update.updates);
  }
  if (update.singleUpdate) {
    updateElement(update.singleUpdate.id, update.singleUpdate.data);
  }
  if (update.selectionBox !== undefined) {
    setSelectionBox(update.selectionBox);
  }
  if (update.selectedIds !== undefined) {
    setSelectedIds(update.selectedIds);
  }
  if (update.smartGuides !== undefined) {
    setSmartGuides(update.smartGuides);
  }
}

export function scheduleUpdate(update: PendingUpdate) {
  pendingUpdate = update;
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushPendingUpdate);
  }
}
