import { get, set } from "idb-keyval";
import type { CanvasElement } from "@/types";

const DB_KEY = "canvas-history";
const MAX_HISTORY_SIZE = 50;

export interface CanvasSnapshot {
  elements: CanvasElement[];
  canvasBackground: string;
  canvasBackgroundVisible: boolean;
  timestamp: number;
}

interface HistoryData {
  undoStack: CanvasSnapshot[];
  redoStack: CanvasSnapshot[];
  current: CanvasSnapshot | null;
}

class CanvasHistoryManager {
  private undoStack: CanvasSnapshot[] = [];
  private redoStack: CanvasSnapshot[] = [];
  private current: CanvasSnapshot | null = null;

  push(snapshot: Omit<CanvasSnapshot, "timestamp">): void {
    const fullSnapshot: CanvasSnapshot = {
      ...snapshot,
      timestamp: Date.now(),
    };

    if (this.current) {
      this.undoStack.push(this.current);

      if (this.undoStack.length > MAX_HISTORY_SIZE) {
        this.undoStack.shift();
      }
    }

    this.current = fullSnapshot;
    this.redoStack = [];
    this.scheduleSave();
  }

  undo(): CanvasSnapshot | null {
    if (this.undoStack.length === 0) {
      return null;
    }

    if (this.current) {
      this.redoStack.push(this.current);
    }

    this.current = this.undoStack.pop() || null;
    this.scheduleSave();
    return this.current;
  }

  redo(): CanvasSnapshot | null {
    if (this.redoStack.length === 0) {
      return null;
    }

    if (this.current) {
      this.undoStack.push(this.current);
    }

    this.current = this.redoStack.pop() || null;
    this.scheduleSave();
    return this.current;
  }

  getCurrent(): CanvasSnapshot | null {
    return this.current;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private scheduleSave(): void {
    this.saveToIndexedDB();
  }

  async saveToIndexedDB(): Promise<void> {
    try {
      const data: HistoryData = {
        undoStack: this.undoStack,
        redoStack: this.redoStack,
        current: this.current,
      };
      await set(DB_KEY, data);
    } catch (error) {
      console.error("Failed to save history to IndexedDB:", error);
    }
  }

  async loadFromIndexedDB(): Promise<CanvasSnapshot | null> {
    try {
      const data = await get<HistoryData>(DB_KEY);
      if (data) {
        this.undoStack = data.undoStack || [];
        this.redoStack = data.redoStack || [];
        this.current = data.current || null;
        return this.current;
      }
    } catch (error) {
      console.error("Failed to load history from IndexedDB:", error);
    }
    return null;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.current = null;
    this.scheduleSave();
  }
}

export const canvasHistory = new CanvasHistoryManager();
