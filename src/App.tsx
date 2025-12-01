import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Stage, Layer, Image as KonvaImage, Rect, Group, Arrow } from "react-konva";
import { X, Save, Copy as CopyIcon, Square, ArrowRight } from "lucide-react";
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

type Tool = 'select' | 'rect' | 'arrow';

interface Annotation {
  type: 'rect' | 'arrow';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  color: string;
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

  const stageRef = useRef<any>(null);
  const borderRef = useRef<any>(null);

  useEffect(() => {
    async function init() {
      try {
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

        const win = getCurrentWindow();
        await win.show();
        await win.setFocus();
        setIsReady(true);
      } catch (e) {
        console.error("Failed to capture screen:", e);
      }
    }

    init();
  }, []);

  const handleMouseDown = (e: any) => {
    if (!isReady) return;
    if (e.target.getParent()?.hasName('toolbar') || e.target.hasName('toolbar')) return;

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
    } else {
      if (tool === 'rect') {
        setCurrentAnnotation({
          type: 'rect',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color: 'red'
        });
      } else if (tool === 'arrow') {
        setCurrentAnnotation({
          type: 'arrow',
          x: 0, y: 0,
          points: [pos.x, pos.y, pos.x, pos.y],
          color: 'red'
        });
      }
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

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
      await getCurrentWindow().close();
    } catch (e) {
      console.error("Failed to copy:", e);
      alert("Failed to copy to clipboard");
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
        await getCurrentWindow().close();
      }
    } catch (e) {
      console.error("Failed to save:", e);
      alert("Failed to save image");
    }
  };

  const handleClose = async () => {
    await getCurrentWindow().close();
  };

  if (!isReady) return null;

  const { x, y, width, height } = getSelectionRect();

  return (
    <>
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
              x={cap.x}
              y={cap.y}
              width={cap.width}
              height={cap.height}
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
                x={cap.x}
                y={cap.y}
                width={cap.width}
                height={cap.height}
              />
            ))}

            {annotations.map((ann, i) => {
              if (ann.type === 'rect') {
                return <Rect key={i} x={ann.x} y={ann.y} width={ann.width} height={ann.height} stroke={ann.color} strokeWidth={2} />;
              } else if (ann.type === 'arrow') {
                return <Arrow key={i} points={ann.points || []} stroke={ann.color} strokeWidth={2} fill={ann.color} />;
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
        </Layer>
      </Stage>

      {showToolbar && width > 0 && (
        <div style={{
          position: 'absolute',
          left: x + width - 150,
          top: y + height + 10,
          display: 'flex',
          gap: '8px',
          background: 'white',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          zIndex: 1000
        }}>
          <button onClick={() => setTool('rect')} title="Rectangle" style={{ padding: 8, background: tool === 'rect' ? '#eee' : 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
            <Square size={20} />
          </button>
          <button onClick={() => setTool('arrow')} title="Arrow" style={{ padding: 8, background: tool === 'arrow' ? '#eee' : 'transparent', border: 'none', cursor: 'pointer', color: '#333' }}>
            <ArrowRight size={20} />
          </button>
          <div style={{ width: 1, background: '#ccc' }} />
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
      )}
    </>
  );
}

export default App;
