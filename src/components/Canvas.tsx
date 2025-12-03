import React, { useRef, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import { useAppStore } from '../store';
import { BackgroundLayer } from './BackgroundLayer';
import { AnnotationLayer } from './AnnotationLayer';
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
    // console.log('MouseMove:', { tool, isSelecting: selection.isSelecting, pos });

    if (tool === 'select') {
      if (!selection.isSelecting) return;
      setSelection((prev) => ({
        ...prev,
        endX: pos.x,
        endY: pos.y,
      }));
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
      if (selection.isSelecting) {
        setSelection((prev) => ({ ...prev, isSelecting: false }));

        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        const padding = 20;
        const toolbarWidth = 300;
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
      </Layer>
    </Stage>
  );
};
