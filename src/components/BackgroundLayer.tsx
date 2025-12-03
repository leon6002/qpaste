import { Layer, Rect, Image as KonvaImage, Group } from 'react-konva';
import { useAppStore } from '../store';

export const BackgroundLayer = () => {
  const images = useAppStore(state => state.images);
  const captures = useAppStore(state => state.captures);
  const selection = useAppStore(state => state.selection);

  const scale = 1 / window.devicePixelRatio;

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
      
      {/* Resize Handles */}
      {width > 0 && height > 0 && !selection.isSelecting && (
        <>
          {[
            { x: x, y: y, name: 'nw' },
            { x: x + width / 2, y: y, name: 'n' },
            { x: x + width, y: y, name: 'ne' },
            { x: x + width, y: y + height / 2, name: 'e' },
            { x: x + width, y: y + height, name: 'se' },
            { x: x + width / 2, y: y + height, name: 's' },
            { x: x, y: y + height, name: 'sw' },
            { x: x, y: y + height / 2, name: 'w' },
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
            />
          ))}
        </>
      )}
    </Layer>
  );
};
