import React from 'react';
import { Square, ArrowRight, Type, X, Undo, Copy as CopyIcon, Save, ZoomIn } from 'lucide-react';
import { useAppStore } from '../store';
import { getCurrentWindow } from "@tauri-apps/api/window";

export const Toolbar = () => {
  const tool = useAppStore(state => state.tool);
  const setTool = useAppStore(state => state.setTool);
  const color = useAppStore(state => state.color);
  const setColor = useAppStore(state => state.setColor);
  const fontSize = useAppStore(state => state.fontSize);
  const setFontSize = useAppStore(state => state.setFontSize);
  const pendingText = useAppStore(state => state.pendingText);
  const setPendingText = useAppStore(state => state.setPendingText);
  const setAnnotations = useAppStore(state => state.setAnnotations);
  const toolbarPos = useAppStore(state => state.toolbarPos);
  const isDraggingToolbar = useAppStore(state => state.isDraggingToolbar);
  const setIsDraggingToolbar = useAppStore(state => state.setIsDraggingToolbar);
  const setDragOffset = useAppStore(state => state.setDragOffset);
  const showToolbar = useAppStore(state => state.showToolbar);
  const selection = useAppStore(state => state.selection);
  const showMagnifier = useAppStore(state => state.showMagnifier);
  const setShowMagnifier = useAppStore(state => state.setShowMagnifier);
  const width = Math.abs(selection.endX - selection.startX);

  const colors = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FFFFFF', '#000000'];

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };



  // Note: These handlers need access to the Stage to export image.
  // Since Toolbar is separate, we might need a way to trigger export on Canvas.
  // OR we can keep these handlers in App/Canvas and pass them down?
  // OR we can use a global event bus or store flag to trigger save/copy.
  // For now, let's assume we can't easily access Stage ref here.
  // A common pattern is to put the Stage ref in the store or use a custom event.
  // Let's use a custom event for now to keep it decoupled.
  
  const triggerCanvasAction = (action: 'copy' | 'save') => {
    window.dispatchEvent(new CustomEvent('canvas-action', { detail: { action } }));
  };

  const handleClose = async () => {
    await getCurrentWindow().hide();
  };

  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    if (!toolbarPos) return;
    setIsDraggingToolbar(true);
    setDragOffset({
      x: e.clientX - toolbarPos.x,
      y: e.clientY - toolbarPos.y
    });
    e.stopPropagation();
  };

  if (!showToolbar || width === 0 || !toolbarPos) return null;

  return (
    <div
      className="toolbar"
      style={{
        left: toolbarPos.x,
        top: toolbarPos.y,
        cursor: isDraggingToolbar ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleToolbarMouseDown}
    >
      {/* Row 1: Tools & Actions */}
      <div className="toolbar-row">
        <div className="toolbar-group">
          <button
            className={`tool-btn ${tool === 'rect' ? 'active' : ''}`}
            onClick={() => { setTool('rect'); setPendingText(null); }}
            title="Rectangle"
          >
            <Square size={14} />
          </button>
          <button
            className={`tool-btn ${tool === 'arrow' ? 'active' : ''}`}
            onClick={() => { setTool('arrow'); setPendingText(null); }}
            title="Arrow"
          >
            <ArrowRight size={14} />
          </button>
          <button
            className={`tool-btn ${tool === 'text' && !pendingText ? 'active' : ''}`}
            onClick={() => { setTool('text'); setPendingText(null); }}
            title="Text"
          >
            <Type size={14} />
          </button>
        </div>

        <div className="divider" />

        <div className="toolbar-group">
          <button className="tool-btn" onClick={handleUndo} title="Undo (Ctrl+Z)">
            <Undo size={14} />
          </button>
          <button className="tool-btn" onClick={() => triggerCanvasAction('copy')} title="Copy">
            <CopyIcon size={14} />
          </button>
          <button className="tool-btn" onClick={() => triggerCanvasAction('save')} title="Save">
            <Save size={14} />
          </button>
          <div style={{ width: '12px' }} /> {/* Spacer */}
          <button 
            className={`tool-btn ${showMagnifier ? 'active' : ''}`}
            onClick={() => setShowMagnifier(!showMagnifier)} 
            title="Toggle Magnifier"
          >
            <ZoomIn size={14} />
          </button>
          <button className="tool-btn danger" onClick={handleClose} title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="divider-h" />

      {/* Row 2: Colors & Settings */}
      <div className="toolbar-row">
        <div style={{ display: 'flex', gap: '6px' }}>
          {colors.map((c: string) => (
            <div
              key={c}
              className={`color-swatch ${color === c ? 'active' : ''}`}
              onClick={() => setColor(c)}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>

        <div className="divider" />

        <select
          className="font-select"
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
        >
          {[10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 70, 80, 90, 100].map(size => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>
      </div>

      {/* Row 3: Stamps */}
      <div className="toolbar-row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
        {['①', '②', '③', '④', '⑤', '⑧'].map(char => (
          <button
            key={char}
            className={`stamp-btn ${pendingText === char ? 'active' : ''}`}
            onClick={() => { setTool('text'); setPendingText(char); }}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
