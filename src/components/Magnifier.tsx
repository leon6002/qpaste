import { Group, Circle, Rect } from 'react-konva';
import { useAppStore } from '../store';

export const Magnifier = () => {
  const cursorPos = useAppStore(state => state.cursorPos);
  const showMagnifier = useAppStore(state => state.showMagnifier);
  const images = useAppStore(state => state.images);
  const captures = useAppStore(state => state.captures);

  if (!showMagnifier || !cursorPos || images.length === 0) return null;

  // Find which capture the cursor is in
  const captureIndex = captures.findIndex(cap => 
    cursorPos.x >= cap.x && 
    cursorPos.x < cap.x + cap.width && 
    cursorPos.y >= cap.y && 
    cursorPos.y < cap.y + cap.height
  );

  if (captureIndex === -1) return null;

  const capture = captures[captureIndex];
  const image = images[captureIndex];

  if (!image) return null;

  const zoom = 2;
  const radius = 60;
  const offset = 20; // Distance from cursor

  // Calculate local position in the image
  const localX = cursorPos.x - capture.x;
  const localY = cursorPos.y - capture.y;

  // Position the magnifier to the bottom-right of the cursor
  // Adjust if it goes off screen
  let mx = cursorPos.x + offset + radius;
  let my = cursorPos.y + offset + radius;

  // Simple boundary check (assuming window size)
  if (mx + radius > window.innerWidth) {
    mx = cursorPos.x - offset - radius;
  }
  if (my + radius > window.innerHeight) {
    my = cursorPos.y - offset - radius;
  }

  return (
    <Group x={mx} y={my}>
      {/* Border/Shadow */}
      <Circle
        radius={radius}
        fill="white"
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.3}
      />
      {/* Magnified Image */}
      <Circle
        radius={radius}
        fillPatternImage={image}
        fillPatternOffset={{ 
          x: localX - radius / zoom, 
          y: localY - radius / zoom 
        }}
        fillPatternScale={{ x: zoom, y: zoom }}
        stroke="white"
        strokeWidth={2}
      />
      {/* Crosshair in the magnifier */}
      <Rect
        x={-5}
        y={-0.5}
        width={10}
        height={1}
        fill="red"
        opacity={0.5}
      />
      <Rect
        x={-0.5}
        y={-5}
        width={1}
        height={10}
        fill="red"
        opacity={0.5}
      />
    </Group>
  );
};
