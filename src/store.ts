import { create } from 'zustand';

export interface Capture {
  x: number;
  y: number;
  width: number;
  height: number;
  image_base64: string;
}

export interface Annotation {
  id: string;
  type: 'rect' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  color: string;
  text?: string;
  fontSize?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isSelecting: boolean;
}

interface AppState {
  // Canvas State
  images: HTMLImageElement[];
  captures: Capture[];
  isReady: boolean;
  
  // Annotation State
  annotations: Annotation[];
  currentAnnotation: Annotation | null;
  editingId: string | null;
  selectedId: string | null;
  
  // Tool State
  tool: 'select' | 'rect' | 'arrow' | 'text';
  color: string;
  fontSize: number;
  pendingText: string | null;
  
  // Selection State
  selection: Selection;
  
  // UI State
  showToolbar: boolean;
  toolbarPos: { x: number, y: number } | null;
  isDraggingToolbar: boolean;
  dragOffset: { x: number, y: number };
  textInput: { x: number, y: number, value: string } | null;
  cursorPos: { x: number, y: number } | null;
  showMagnifier: boolean;
  magnifierSize: number;
  magnifierZoom: number;
  
  // Actions
  setImages: (images: HTMLImageElement[]) => void;
  setCaptures: (captures: Capture[]) => void;
  setIsReady: (isReady: boolean) => void;
  setAnnotations: (annotations: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void;
  setCurrentAnnotation: (annotation: Annotation | null) => void;
  setEditingId: (id: string | null) => void;
  setSelectedId: (id: string | null) => void;
  setTool: (tool: 'select' | 'rect' | 'arrow' | 'text') => void;
  setColor: (color: string) => void;
  setFontSize: (fontSize: number) => void;
  setPendingText: (text: string | null) => void;
  setSelection: (selection: Selection | ((prev: Selection) => Selection)) => void;
  setShowToolbar: (show: boolean) => void;
  setToolbarPos: (pos: { x: number, y: number } | null) => void;
  setIsDraggingToolbar: (isDragging: boolean) => void;
  setDragOffset: (offset: { x: number, y: number }) => void;
  setTextInput: (input: { x: number, y: number, value: string } | null) => void;
  setCursorPos: (pos: { x: number, y: number } | null) => void;
  setShowMagnifier: (show: boolean) => void;
  setMagnifierSize: (size: number) => void;
  setMagnifierZoom: (zoom: number) => void;
  
  // Helpers
  resetState: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial State
  images: [],
  captures: [],
  isReady: false,
  annotations: [],
  currentAnnotation: null,
  editingId: null,
  selectedId: null,
  tool: 'select',
  color: '#FF0000',
  fontSize: 16,
  pendingText: null,
  selection: { startX: 0, startY: 0, endX: 0, endY: 0, isSelecting: false },
  showToolbar: false,
  toolbarPos: null,
  isDraggingToolbar: false,
  dragOffset: { x: 0, y: 0 },
  textInput: null,
  cursorPos: null,
  showMagnifier: false,
  magnifierSize: 60,
  magnifierZoom: 4,

  // Setters
  setImages: (images) => set({ images }),
  setCaptures: (captures) => set({ captures }),
  setIsReady: (isReady) => set({ isReady }),
  setAnnotations: (annotations) => set((state) => ({
    annotations: typeof annotations === 'function' ? annotations(state.annotations) : annotations
  })),
  setCurrentAnnotation: (currentAnnotation) => set({ currentAnnotation }),
  setEditingId: (editingId) => set({ editingId }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setFontSize: (fontSize) => set({ fontSize }),
  setPendingText: (pendingText) => set({ pendingText }),
  setSelection: (selection) => set((state) => ({
    selection: typeof selection === 'function' ? selection(state.selection) : selection
  })),
  setShowToolbar: (showToolbar) => set({ showToolbar }),
  setToolbarPos: (toolbarPos) => set({ toolbarPos }),
  setIsDraggingToolbar: (isDraggingToolbar) => set({ isDraggingToolbar }),
  setDragOffset: (dragOffset) => set({ dragOffset }),
  setTextInput: (textInput) => set({ textInput }),
  setCursorPos: (cursorPos) => set({ cursorPos }),
  setShowMagnifier: (showMagnifier) => set({ showMagnifier }),
  setMagnifierSize: (magnifierSize) => set({ magnifierSize }),
  setMagnifierZoom: (magnifierZoom) => set({ magnifierZoom }),
  
  resetState: () => set({
    annotations: [],
    currentAnnotation: null,
    selection: { startX: 0, startY: 0, endX: 0, endY: 0, isSelecting: false },
    tool: 'select',
    textInput: null,
    pendingText: null,
    showToolbar: false,
    editingId: null,
    selectedId: null,
    showMagnifier: false,
    magnifierSize: 60,
    magnifierZoom: 4
  })
}));
