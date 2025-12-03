import React, { useRef, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import { useAppStore } from '../store';
import { BackgroundLayer } from './BackgroundLayer';
import { AnnotationLayer } from './AnnotationLayer';
import { Magnifier } from './Magnifier';
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const Canvas = ({ children }: { children?: React.ReactNode }) => {
  const stageRef = useRef<any>(null);

  const isReady = useAppStore(state => state.isReady);
  const tool = useAppStore(state => state.tool);
  const color = useAppStore(state => state.color);
  const fontSize = useAppStore(state => state.fontSize);
  const pendingText = useAppStore(state => state.pendingText);
  const annotations = useAppStore(state => state.annotations);
  const setAnnotations = useAppStore(state => state.setAnnotations);
  const currentAnnotation = useAppStore(state => state.currentAnnotation);
  const setCurrentAnnotation = useAppStore(state => state.setCurrentAnnotation);
  const selection = useAppStore(state => state.selection);
  const setSelection = useAppStore(state => state.setSelection);
  const setShowToolbar = useAppStore(state => state.setShowToolbar);
  const setToolbarPos = useAppStore(state => state.setToolbarPos);
  const textInput = useAppStore(state => state.textInput);
  const setTextInput = useAppStore(state => state.setTextInput);
  const setCursorPos = useAppStore(state => state.setCursorPos);
  const editingId = useAppStore(state => state.editingId);
  const setEditingId = useAppStore(state => state.setEditingId);
  const setPendingText = useAppStore(state => state.setPendingText);

  const handleTextSubmit = () => {
    if (textInput && textInput.value.trim()) {
      if (editingId) {
        const idx = annotations.findIndex(a => a.id === editingId);
        if (idx >= 0) {
          const newAnns = [...annotations];
          newAnns[idx] = {
            ...newAnns[idx],
            text: textInput.value,
          };
          setAnnotations(newAnns);
        }
        setEditingId(null);
      } else {
        setAnnotations([...annotations, {
          id: crypto.randomUUID(),
          type: 'text',
          x: textInput.x,
          y: textInput.y,
          text: textInput.value,
          color: color,
          fontSize: fontSize,
          width: 200
        }]);
      }
    } else if (editingId) {
      setEditingId(null);
    }
    setTextInput(null);
  };

  const [interactionMode, setInteractionMode] = React.useState<'none' | 'creating' | 'moving' | 'resizing'>('none');
  const [resizeHandle, setResizeHandle] = React.useState<string | null>(null);
  const [dragStart, setDragStart] = React.useState<{ x: number, y: number } | null>(null);
  const [initialSelection, setInitialSelection] = React.useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);

  const handleMouseDown = (e: any) => {
    if (!isReady) return;
    if (e.target.getParent()?.hasName('toolbar') || e.target.hasName('toolbar')) return;

    if (textInput) {
      handleTextSubmit();
      return;
    }

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    if (tool === 'select') {
      const { x, y, width, height } = getSelectionRect();
      
      // Check for resize handles first
      const handleSize = 10;
      const handles = [
        { name: 'nw', x: x, y: y },
        { name: 'n', x: x + width / 2, y: y },
        { name: 'ne', x: x + width, y: y },
        { name: 'e', x: x + width, y: y + height / 2 },
        { name: 'se', x: x + width, y: y + height },
        { name: 's', x: x + width / 2, y: y + height },
        { name: 'sw', x: x, y: y + height },
        { name: 'w', x: x, y: y + height / 2 },
      ];

      const clickedHandle = handles.find(h => 
        pos.x >= h.x - handleSize && pos.x <= h.x + handleSize &&
        pos.y >= h.y - handleSize && pos.y <= h.y + handleSize
      );

      if (clickedHandle && width > 0 && height > 0) {
        setInteractionMode('resizing');
        setResizeHandle(clickedHandle.name);
        setDragStart(pos);
        setInitialSelection(selection);
        return;
      }

      // Check if inside selection
      if (width > 0 && height > 0 && 
          pos.x >= x && pos.x <= x + width && 
          pos.y >= y && pos.y <= y + height) {
        setInteractionMode('moving');
        setDragStart(pos);
        setInitialSelection(selection);
        return;
      }

      // Otherwise start new selection
      setInteractionMode('creating');
      setSelection({
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
        isSelecting: true,
      });
      setShowToolbar(false);
    } else if (tool === 'text') {
      if (pendingText) {
        setAnnotations([...annotations, {
          id: crypto.randomUUID(),
          type: 'text',
          x: pos.x,
          y: pos.y,
          text: pendingText,
          color: color,
          fontSize: fontSize,
          width: fontSize * pendingText.length
        }]);
        setPendingText(null); // Clear pending text after placement
      } else {
        setTextInput({
          x: pos.x,
          y: pos.y,
          value: ''
        });
      }
    } else {
      if (tool === 'rect') {
        setCurrentAnnotation({
          id: crypto.randomUUID(),
          type: 'rect',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color: color
        });
      } else if (tool === 'arrow') {
        setCurrentAnnotation({
          id: crypto.randomUUID(),
          type: 'arrow',
          x: 0, y: 0,
          points: [pos.x, pos.y, pos.x, pos.y],
          color: color
        });
      }
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setCursorPos(pos);

    if (tool === 'select') {
      if (interactionMode === 'creating') {
        setSelection((prev) => ({
          ...prev,
          endX: pos.x,
          endY: pos.y,
        }));
      } else if (interactionMode === 'moving' && dragStart && initialSelection) {
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        setSelection({
          ...initialSelection,
          startX: initialSelection.startX + dx,
          startY: initialSelection.startY + dy,
          endX: initialSelection.endX + dx,
          endY: initialSelection.endY + dy,
          isSelecting: false
        });
      } else if (interactionMode === 'resizing' && initialSelection) {
        let { startX, startY, endX, endY } = initialSelection;
        // Normalize rect for easier resizing logic
        let x = Math.min(startX, endX);
        let y = Math.min(startY, endY);
        let w = Math.abs(endX - startX);
        let h = Math.abs(endY - startY);

        switch (resizeHandle) {
          case 'nw': x = pos.x; y = pos.y; w = (initialSelection.endX > initialSelection.startX ? initialSelection.endX : initialSelection.startX) - x; h = (initialSelection.endY > initialSelection.startY ? initialSelection.endY : initialSelection.startY) - y; break;
          case 'n': y = pos.y; h = (initialSelection.endY > initialSelection.startY ? initialSelection.endY : initialSelection.startY) - y; break;
          case 'ne': y = pos.y; w = pos.x - x; h = (initialSelection.endY > initialSelection.startY ? initialSelection.endY : initialSelection.startY) - y; break;
          case 'e': w = pos.x - x; break;
          case 'se': w = pos.x - x; h = pos.y - y; break;
          case 's': h = pos.y - y; break;
          case 'sw': x = pos.x; w = (initialSelection.endX > initialSelection.startX ? initialSelection.endX : initialSelection.startX) - x; h = pos.y - y; break;
          case 'w': x = pos.x; w = (initialSelection.endX > initialSelection.startX ? initialSelection.endX : initialSelection.startX) - x; break;
        }

        setSelection({
          startX: x,
          startY: y,
          endX: x + w,
          endY: y + h,
          isSelecting: false
        });
      }
    } else {
      if (!currentAnnotation) return;
      if (currentAnnotation.type === 'rect') {
        setCurrentAnnotation({
          ...currentAnnotation,
          width: pos.x - currentAnnotation.x,
          height: pos.y - currentAnnotation.y
        });
      } else if (currentAnnotation.type === 'arrow') {
        setCurrentAnnotation({
          ...currentAnnotation,
          points: [currentAnnotation.points![0], currentAnnotation.points![1], pos.x, pos.y]
        });
      }
    }
  };

  const handleMouseUp = (e: any) => {
    if (tool === 'select') {
      if (interactionMode === 'creating' || interactionMode === 'moving' || interactionMode === 'resizing') {
        if (interactionMode === 'creating') {
           setSelection((prev) => ({ ...prev, isSelecting: false }));
        }
        
        setInteractionMode('none');
        setDragStart(null);
        setInitialSelection(null);
        setResizeHandle(null);

        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        const padding = 20;
        const toolbarWidth = 500;
        const toolbarHeight = 150;

        let tx = pos.x + padding;
        let ty = pos.y + padding;

        if (tx + toolbarWidth > window.innerWidth) {
          tx = pos.x - toolbarWidth - padding;
        }

        if (ty + toolbarHeight > window.innerHeight) {
          ty = pos.y - toolbarHeight - padding;
        }

        setToolbarPos({ x: tx, y: ty });
        setShowToolbar(true);
      }
    } else {
      if (currentAnnotation) {
        setAnnotations([...annotations, currentAnnotation]);
        setCurrentAnnotation(null);
      }
    }
  };

  const getSelectionRect = () => {
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);
    return { x, y, width, height };
  };

  // Handle Canvas Actions (Copy/Save)
  useEffect(() => {
    const handleCanvasAction = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const action = customEvent.detail.action;
      
      if (!stageRef.current) return;
      const { x, y, width, height } = getSelectionRect();
      if (width === 0 || height === 0) return;

      const layer = stageRef.current.getLayers()[0];
      const borderNode = layer.findOne('.selection-border');
      if (borderNode) borderNode.hide();

      const dataUrl = stageRef.current.toDataURL({
        x, y, width, height, pixelRatio: window.devicePixelRatio
      });

      if (borderNode) borderNode.show();

      try {
        if (action === 'copy') {
          await invoke("copy_to_clipboard", { base64Image: dataUrl });
          await getCurrentWindow().hide();
        } else if (action === 'save') {
           const path = await save({
            filters: [{
              name: 'Image',
              extensions: ['png']
            }]
          });

          if (path) {
            await invoke("save_image", { path, base64Image: dataUrl });
            await getCurrentWindow().hide();
          }
        }
      } catch (err) {
        console.error(`Failed to ${action}:`, err);
      }
    };

    window.addEventListener('canvas-action', handleCanvasAction);
    return () => {
      window.removeEventListener('canvas-action', handleCanvasAction);
    };
  }, [selection]);

  return (
    <Stage
      width={window.innerWidth}
      height={window.innerHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      ref={stageRef}
    >
      <BackgroundLayer />
      <Layer>
         <AnnotationLayer />
         {children}
         <Magnifier />
      </Layer>
    </Stage>
  );
};
