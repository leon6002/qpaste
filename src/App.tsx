import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { Stage, Layer, Image as KonvaImage, Rect, Group, Arrow, Text, Line } from "react-konva";
import { X, Save, Copy as CopyIcon, Square, ArrowRight, Type, Undo } from "lucide-react";
import { save } from '@tauri-apps/plugin-dialog';
import "./App.css";

interface MonitorCapture {
  x: number;
  y: number;
  width: number;
  height: number;
  image_base64: string;
}

interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isSelecting: boolean;
}

type Tool = 'select' | 'rect' | 'arrow' | 'text';

interface Annotation {
  type: 'rect' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  color: string;
  text?: string;
  fontSize?: number;
}

interface TextInput {
  x: number;
  y: number;
  value: string;
}

function App() {
  const [captures, setCaptures] = useState<MonitorCapture[]>([]);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [selection, setSelection] = useState<Selection>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isSelecting: false,
  });
  const [isReady, setIsReady] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);

  const [color, setColor] = useState('red');
  const [fontSize, setFontSize] = useState(16);
  const [textInput, setTextInput] = useState<TextInput | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);

  const stageRef = useRef<any>(null);
  const borderRef = useRef<any>(null);

  const captureScreen = async () => {
    try {
      setIsReady(false);
      const result = await invoke<MonitorCapture[]>("capture_screen");
      setCaptures(result);

      const loadedImages = await Promise.all(
        result.map((cap) => {
          return new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = cap.image_base64;
          });
        })
      );
      setImages(loadedImages);

      // Reset state
      setSelection({ startX: 0, startY: 0, endX: 0, endY: 0, isSelecting: false });
      setAnnotations([]);
      setCurrentAnnotation(null);
      setTool('select');
      setTextInput(null);
      setPendingText(null);
      setShowToolbar(false);

      setIsReady(true);
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
          type: 'text',
          x: pos.x,
          y: pos.y,
          text: pendingText,
          color: color,
          fontSize: fontSize
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
          type: 'rect',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color: color
        });
      } else if (tool === 'arrow') {
        setCurrentAnnotation({
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

  const handleMouseUp = () => {
    if (tool === 'select') {
      if (selection.isSelecting) {
        setSelection((prev) => ({ ...prev, isSelecting: false }));
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

  const handleCopy = async () => {
    if (!stageRef.current) return;
    const { x, y, width, height } = getSelectionRect();
    if (width === 0 || height === 0) return;

    if (borderRef.current) borderRef.current.hide();

    const dataUrl = stageRef.current.toDataURL({
      x, y, width, height, pixelRatio: 1
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
      x, y, width, height, pixelRatio: 1
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
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleTextSubmit = () => {
    if (textInput && textInput.value.trim()) {
      setAnnotations([...annotations, {
        type: 'text',
        x: textInput.x,
        y: textInput.y,
        text: textInput.value,
        color: color,
        fontSize: fontSize
      }]);
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
          top: 20,
          right: 20,
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
        <X size={24} />
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

            {annotations.map((ann, i) => {
              if (ann.type === 'rect') {
                return <Rect key={i} x={ann.x} y={ann.y} width={ann.width} height={ann.height} stroke={ann.color} strokeWidth={2} />;
              } else if (ann.type === 'arrow') {
                return <Arrow key={i} points={ann.points || []} stroke={ann.color} strokeWidth={2} fill={ann.color} />;
              } else if (ann.type === 'text') {
                return <Text key={i} x={ann.x} y={ann.y} text={ann.text} fontSize={ann.fontSize} fill={ann.color} />;
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

          {cursorPos && !showToolbar && (
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
          )}
        </Layer>
      </Stage>

      {showToolbar && width > 0 && (
        <div style={{
          position: 'absolute',
          left: x + width - 300,
          top: y + height + 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'white',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => { setTool('rect'); setPendingText(null); }} title="Rectangle" style={{ padding: 8, background: tool === 'rect' ? '#eee' : 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
              <Square size={20} />
            </button>
            <button onClick={() => { setTool('arrow'); setPendingText(null); }} title="Arrow" style={{ padding: 8, background: tool === 'arrow' ? '#eee' : 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
              <ArrowRight size={20} />
            </button>
            <button onClick={() => { setTool('text'); setPendingText(null); }} title="Text" style={{ padding: 8, background: tool === 'text' && !pendingText ? '#eee' : 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
              <Type size={20} />
            </button>
            <div style={{ width: 1, height: 20, background: '#ccc' }} />
            <div style={{ display: 'flex', gap: '2px' }}>
              {colors.map(c => (
                <div
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 20,
                    height: 20,
                    background: c,
                    border: color === c ? '2px solid #333' : '1px solid #ccc',
                    cursor: 'pointer'
                  }}
                  title={c}
                />
              ))}
            </div>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 30, height: 30, border: 'none', cursor: 'pointer', padding: 0 }} />
            <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ padding: 4, borderRadius: 4, border: '1px solid #ccc' }}>
              <option value={12}>12</option>
              <option value={16}>16</option>
              <option value={20}>20</option>
              <option value={24}>24</option>
              <option value={32}>32</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {['①', '②', '③', '④', '⑤', '⑧'].map(char => (
              <button
                key={char}
                onClick={() => { setTool('text'); setPendingText(char); }}
                style={{
                  padding: '4px 8px',
                  background: pendingText === char ? '#eee' : 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {char}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: '#ccc', margin: '4px 0' }} />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={handleUndo} title="Undo (Ctrl+Z)" style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
              <Undo size={20} />
            </button>
            <button onClick={handleCopy} title="Copy" style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
              <CopyIcon size={20} />
            </button>
            <button onClick={handleSave} title="Save" style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
              <Save size={20} />
            </button>
            <button onClick={handleClose} title="Close" style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {textInput && (
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
            color: color,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            minWidth: '100px',
            minHeight: '1.5em',
            zIndex: 2000,
            resize: 'none',
            overflow: 'hidden',
            padding: '4px',
            borderRadius: '4px',
            // boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}
          autoFocus
        />
      )}
    </>
  );
}

export default App;
