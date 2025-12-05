import React from 'react';
import { Layer, Rect, Image as KonvaImage, Group } from 'react-konva';
import { useAppStore } from '../store';

export const BackgroundLayer = () => {
  const images = useAppStore(state => state.images);
  const captures = useAppStore(state => state.captures);
  const selection = useAppStore(state => state.selection);
  const showMagnifier = useAppStore(state => state.showMagnifier); // Force re-render when magnifier toggles
  // We don't strictly need tool here if we assume this layer is only active/interactive when tool is select?
  // But for cursor reset logic 'crosshair', it implies tool is select.
  // Let's grab tool just in case we want to be safe, though hardcoding crosshair for now matches the request.
  // Actually, if tool is NOT select, we might not want crosshair.
  // But BackgroundLayer handles are only shown if !selection.isSelecting.
  // And usually handles are only relevant in select mode.
  // Let's assume select mode for now.


  const scale = 1 / window.devicePixelRatio;
  
  React.useEffect(() => {
    // Force re-render when magnifier toggles
  }, [showMagnifier]);

  const getSelectionRect = () => {
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);
    return { x, y, width, height };
  };

  const { x, y, width, height } = getSelectionRect();

  return (
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
      </Group>
      
      <Rect
        name="selection-border"
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="#00AAFF"
        strokeWidth={2}
        listening={false}
      />
      
      {/* Selection Move Area */}
      {width > 0 && height > 0 && !selection.isSelecting && (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="transparent"
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'move';
            }
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'crosshair';
            }
          }}
        />
      )}
      
      {/* Resize Handles */}
      {width > 0 && height > 0 && !selection.isSelecting && (
        <>
          {[
            { x: x, y: y, name: 'nw', cursor: 'nw-resize' },
            { x: x + width / 2, y: y, name: 'n', cursor: 'n-resize' },
            { x: x + width, y: y, name: 'ne', cursor: 'ne-resize' },
            { x: x + width, y: y + height / 2, name: 'e', cursor: 'e-resize' },
            { x: x + width, y: y + height, name: 'se', cursor: 'se-resize' },
            { x: x + width / 2, y: y + height, name: 's', cursor: 's-resize' },
            { x: x, y: y + height, name: 'sw', cursor: 'sw-resize' },
            { x: x, y: y + height / 2, name: 'w', cursor: 'w-resize' },
          ].map((handle) => (
            <Rect
              key={handle.name}
              x={handle.x - 4}
              y={handle.y - 4}
              width={8}
              height={8}
              fill="white"
              stroke="#00AAFF"
              strokeWidth={1}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) {
                  stage.container().style.cursor = handle.cursor;
                }
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) {
                  stage.container().style.cursor = 'crosshair';
                }
              }}
            />
          ))}
        </>
      )}
    </Layer>
  );
};
