import { useState, useEffect, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save } from "@tauri-apps/plugin-dialog";
import { Stage, Layer, Rect, Image as KonvaImage, Arrow, Group, Text, Line } from 'react-konva';
import { Square, ArrowRight, Type, X, Undo, Copy as CopyIcon, Save } from 'lucide-react';
import './App.css';

interface Capture {
  x: number;
  y: number;
  width: number;
  height: number;
  image_path: string;
}

interface Annotation {
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

interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isSelecting: boolean;
}

function App() {
  const fontFamily = 'sans-serif';
  const lineHeight = 1.2;
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [tool, setTool] = useState<'select' | 'rect' | 'arrow' | 'text'>('select');
  const [color, setColor] = useState('#FF0000');
  const [selection, setSelection] = useState<Selection>({
    startX: 0, startY: 0, endX: 0, endY: 0, isSelecting: false
  });
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number, y: number } | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [textInput, setTextInput] = useState<{ x: number, y: number, value: string } | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const stageRef = useRef<any>(null);
  const borderRef = useRef<any>(null);

  const captureScreen = async () => {
    try {
      console.log("Capturing screen...");
      const captures: any[] = await invoke("capture_screen");
      console.log("Captures:", captures);

      const newCaptures: Capture[] = [];
      const newImages: HTMLImageElement[] = [];

      for (const cap of captures) {
        const img = new Image();
        img.src = cap.image_base64;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        newImages.push(img);
        newCaptures.push({
          x: cap.x,
          y: cap.y,
          width: cap.width,
          height: cap.height,
          image_path: cap.image_base64
        });
      }

      setImages(newImages);
      setCaptures(newCaptures);

      // Reset state
      setAnnotations([]);
      setCurrentAnnotation(null);
      setSelection({
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        isSelecting: false
      });
      setTool('select');
      setTextInput(null);
      setPendingText(null);
      setShowToolbar(false);

      setIsReady(true);
      await getCurrentWindow().show();
      await getCurrentWindow().setFocus();
    } catch (e) {
      console.error("Failed to capture screen:", e);
    }
  };

  useEffect(() => {
    // Listen for start_capture event from backend (Tray/Shortcut)
    const unlisten = listen("start_capture", () => {
      captureScreen();
    });

    // Initial capture (optional, maybe we start hidden?)
    // captureScreen();
    // Actually, let's capture on mount so if they run it manually it works
    captureScreen();

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleMouseDown = (e: any) => {
    console.log("MouseDown:", e.target.name(), e.target);
    if (!isReady) return;
    if (e.target.getParent()?.hasName('toolbar') || e.target.hasName('toolbar')) return;

    // If text input is open, commit it on click
    if (textInput) {
      handleTextSubmit();
      return;
    }

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    console.log("Pointer Pos:", pos, "Tool:", tool);

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
      console.log("Text tool active. Pending text:", pendingText);
      if (pendingText) {
        // Place stamp immediately
        setAnnotations([...annotations, {
          id: crypto.randomUUID(),
          type: 'text',
          x: pos.x,
          y: pos.y,
          text: pendingText,
          color: color,
          fontSize: fontSize,
          width: fontSize * pendingText.length // Initial width estimate
        }]);
        // Keep pendingText for multiple stamps
      } else {
        console.log("Opening text input at", pos);
        // Open text input
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

        // Calculate toolbar position based on mouse cursor
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        const padding = 20;
        const toolbarWidth = 150; // Approximate
        const toolbarHeight = 150; // Approximate

        let tx = pos.x + padding;
        let ty = pos.y + padding;

        // Check right edge
        if (tx + toolbarWidth > window.innerWidth) {
          tx = pos.x - toolbarWidth - padding;
        }

        // Check bottom edge
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

  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    if (!toolbarPos) return;
    setIsDraggingToolbar(true);
    setDragOffset({
      x: e.clientX - toolbarPos.x,
      y: e.clientY - toolbarPos.y
    });
    e.stopPropagation(); // Prevent stage from receiving click
  };

  const getSelectionRect = () => {
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);
    return { x, y, width, height };
  };

  const handleCopy = async () => {
    if (!stageRef.current) return;
    const { x, y, width, height } = getSelectionRect();
    if (width === 0 || height === 0) return;

    if (borderRef.current) borderRef.current.hide();

    const dataUrl = stageRef.current.toDataURL({
      x, y, width, height, pixelRatio: window.devicePixelRatio
    });

    if (borderRef.current) borderRef.current.show();

    try {
      await invoke("copy_to_clipboard", { base64Image: dataUrl });
      await getCurrentWindow().hide(); // Hide instead of close
    } catch (e) {
      console.error("Failed to copy:", e);
      alert(`Failed to copy to clipboard: ${JSON.stringify(e)}`);
    }
  };

  const handleSave = async () => {
    if (!stageRef.current) return;
    const { x, y, width, height } = getSelectionRect();
    if (width === 0 || height === 0) return;

    if (borderRef.current) borderRef.current.hide();

    const dataUrl = stageRef.current.toDataURL({
      x, y, width, height, pixelRatio: window.devicePixelRatio
    });

    if (borderRef.current) borderRef.current.show();

    try {
      const path = await save({
        filters: [{
          name: 'Image',
          extensions: ['png']
        }]
      });

      if (path) {
        await invoke("save_image", { path, base64Image: dataUrl });
        await getCurrentWindow().hide(); // Hide instead of close
      }
    } catch (e) {
      console.error("Failed to save:", e);
      alert(`Failed to save image: ${JSON.stringify(e)}`);
    }
  };

  const handleClose = async () => {
    await getCurrentWindow().hide(); // Hide instead of close
  };

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingToolbar) {
        setToolbarPos({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingToolbar(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDraggingToolbar, dragOffset]);



  const handleTextSubmit = () => {
    if (textInput && textInput.value.trim()) {
      if (editingId) {
        // Update existing annotation
        const idx = annotations.findIndex(a => a.id === editingId);
        if (idx >= 0) {
          const newAnns = [...annotations];
          newAnns[idx] = {
            ...newAnns[idx],
            text: textInput.value,
            // Update height estimation if needed, though usually handled by render
          };
          setAnnotations(newAnns);
        }
        setEditingId(null);
      } else {
        // Create new annotation
        setAnnotations([...annotations, {
          id: crypto.randomUUID(),
          type: 'text',
          x: textInput.x,
          y: textInput.y,
          text: textInput.value,
          color: color,
          fontSize: fontSize,
          width: 200 // Default width for text box
        }]);
      }
    } else if (editingId) {
      // If empty text on edit, maybe delete? or just cancel edit
      setEditingId(null);
    }
    setTextInput(null);
  };

  if (!isReady) return null;

  const { x, y, width, height } = getSelectionRect();
  const scale = 1 / window.devicePixelRatio;

  const colors = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FFFFFF', '#000000'];

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 9999,
          cursor: 'pointer',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '50%',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}
        onClick={handleClose}
        title="Close (Esc)"
      >
        <X size={16} />
      </div>

      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={stageRef}
      >
        <Layer>
          {captures.map((cap, i) => (
            <KonvaImage
              key={i}
              image={images[i]}
              x={cap.x * scale}
              y={cap.y * scale}
              width={cap.width * scale}
              height={cap.height * scale}
            />
          ))}

          <Rect
            x={0}
            y={0}
            width={window.innerWidth}
            height={window.innerHeight}
            fill="rgba(0,0,0,0.5)"
            listening={false}
          />

          <Group clipX={x} clipY={y} clipWidth={width} clipHeight={height}>
            {captures.map((cap, i) => (
              <KonvaImage
                key={`clip-${i}`}
                image={images[i]}
                x={cap.x * scale}
                y={cap.y * scale}
                width={cap.width * scale}
                height={cap.height * scale}
              />
            ))}

            {annotations.map((ann) => {
              const commonProps = {
                key: ann.id,
                name: `ann-${ann.id}`,
                draggable: true,
                onMouseDown: (e: any) => {
                  e.cancelBubble = true;
                  if (textInput) {
                    handleTextSubmit();
                  }
                },
                onClick: (e: any) => {
                  e.cancelBubble = true;
                },
                onDragEnd: (e: any) => {
                  const idx = annotations.findIndex(a => a.id === ann.id);
                  if (idx >= 0) {
                    const newAnns = [...annotations];
                    newAnns[idx] = {
                      ...newAnns[idx],
                      x: e.target.x(),
                      y: e.target.y()
                    };
                    setAnnotations(newAnns);
                  }
                }
              };

              if (ann.type === 'rect') {
                return (
                  <Rect
                    {...commonProps}
                    x={ann.x} y={ann.y}
                    width={ann.width} height={ann.height}
                    stroke={ann.color} strokeWidth={2}
                    scaleX={ann.scaleX} scaleY={ann.scaleY}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      const idx = annotations.findIndex(a => a.id === ann.id);
                      if (idx >= 0) {
                        const newAnns = [...annotations];
                        newAnns[idx] = {
                          ...newAnns[idx],
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(5, node.width() * scaleX),
                          height: Math.max(5, node.height() * scaleY),
                        };
                        setAnnotations(newAnns);
                      }
                    }}
                  />
                );
              } else if (ann.type === 'arrow') {
                return <Arrow {...commonProps} points={ann.points || []} stroke={ann.color} strokeWidth={2} fill={ann.color} />;
              } else if (ann.type === 'text') {
                return (
                  <Group
                    key={ann.id}
                    name={`ann-${ann.id}`}
                    x={ann.x} y={ann.y}
                    draggable
                    onMouseDown={commonProps.onMouseDown}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      setEditingId(ann.id);
                      setTextInput({
                        x: ann.x,
                        y: ann.y,
                        value: ann.text || ''
                      });
                    }}
                    onDragEnd={commonProps.onDragEnd}
                  >
                    <Text
                      text={ann.text}
                      fontSize={ann.fontSize}
                      fontFamily={fontFamily}
                      lineHeight={lineHeight}
                      fill={ann.color}
                      name={`text-${ann.id}`}
                      visible={editingId !== ann.id}
                    />
                  </Group>
                );
              }
              return null;
            })}


            {currentAnnotation && (
              currentAnnotation.type === 'rect' ?
                <Rect x={currentAnnotation.x} y={currentAnnotation.y} width={currentAnnotation.width} height={currentAnnotation.height} stroke={currentAnnotation.color} strokeWidth={2} /> :
                <Arrow points={currentAnnotation.points || []} stroke={currentAnnotation.color} strokeWidth={2} fill={currentAnnotation.color} />
            )}
          </Group>

          <Rect
            ref={borderRef}
            x={x}
            y={y}
            width={width}
            height={height}
            stroke="#00AAFF"
            strokeWidth={2}
            listening={false}
          />

          {
            cursorPos && !showToolbar && (
              <>
                <Line
                  points={[0, cursorPos.y, window.innerWidth, cursorPos.y]}
                  stroke="red"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
                <Line
                  points={[cursorPos.x, 0, cursorPos.x, window.innerHeight]}
                  stroke="red"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
                <Text
                  x={cursorPos.x + 10}
                  y={cursorPos.y + 10}
                  text={`(${Math.round(cursorPos.x)}, ${Math.round(cursorPos.y)})`}
                  fontSize={12}
                  fill="white"
                  shadowColor="black"
                  shadowBlur={2}
                  listening={false}
                />
              </>
            )
          }
        </Layer >
      </Stage >

      {showToolbar && width > 0 && toolbarPos && (
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
              <button className="tool-btn" onClick={handleCopy} title="Copy">
                <CopyIcon size={14} />
              </button>
              <button className="tool-btn" onClick={handleSave} title="Save">
                <Save size={14} />
              </button>
              <div style={{ width: '12px' }} /> {/* Spacer */}
              <button className="tool-btn danger" onClick={handleClose} title="Close">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="divider-h" />

          {/* Row 2: Colors & Settings */}
          <div className="toolbar-row">
            <div style={{ display: 'flex', gap: '6px' }}>
              {colors.map(c => (
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
              <option value={10}>10px</option>
              <option value={12}>12px</option>
              <option value={14}>14px</option>
              <option value={16}>16px</option>
              <option value={20}>20px</option>
              <option value={24}>24px</option>
              <option value={28}>28px</option>
              <option value={32}>32px</option>
              <option value={36}>36px</option>
              <option value={40}>40px</option>
              <option value={44}>44px</option>
              <option value={48}>48px</option>
              <option value={52}>52px</option>
              <option value={56}>56px</option>
              <option value={60}>60px</option>
              <option value={70}>70px</option>
              <option value={80}>80px</option>
              <option value={90}>90px</option>
              <option value={100}>100px</option>
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
      )}

      {
        textInput && (
          <textarea
            value={textInput.value}
            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
            // onBlur={handleTextSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextSubmit();
              }
            }}
            style={{
              position: 'absolute',
              left: textInput.x,
              top: textInput.y,
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily,
              lineHeight: lineHeight,
              color: color,
              background: 'transparent',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              outline: 'none',
              minWidth: '300px',
              minHeight: '1.5em',
              zIndex: 2000,
              overflow: 'hidden',
              padding: '0',
              borderRadius: '4px',
              // boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}
            autoFocus
          />
        )
      }
    </>
  );
}

export default App;
