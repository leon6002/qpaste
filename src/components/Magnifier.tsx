import { Group, Circle, Rect } from 'react-konva';
import { useAppStore } from '../store';

export const Magnifier = () => {
  const cursorPos = useAppStore(state => state.cursorPos);
  const showMagnifier = useAppStore(state => state.showMagnifier);
  const images = useAppStore(state => state.images);
  const captures = useAppStore(state => state.captures);

  if (!showMagnifier || !cursorPos || images.length === 0) return null;

  const dpr = window.devicePixelRatio || 1;
  const screenX = cursorPos.x + window.screenX;
  const screenY = cursorPos.y + window.screenY;

  // Find which capture the cursor is in (compare in logical pixels)
  const captureIndex = captures.findIndex(cap => {
    const capX = cap.x / dpr;
    const capY = cap.y / dpr;
    const capW = cap.width / dpr;
    const capH = cap.height / dpr;
    return screenX >= capX && screenX < capX + capW && screenY >= capY && screenY < capY + capH;
  });

  if (captureIndex === -1) return null;

  const capture = captures[captureIndex];
  const image = images[captureIndex];

  if (!image) return null;

  const magnifierSize = useAppStore(state => state.magnifierSize);
  const magnifierZoom = useAppStore(state => state.magnifierZoom);

  if (!image) return null;

  const zoom = magnifierZoom;
  const radius = magnifierSize;
  const offset = 20;

  // Calculate local position in the image (physical pixels)
  // screenX * dpr converts logical screen coord to physical
  // capture.x is already physical
  const localX = screenX * dpr - capture.x;
  const localY = screenY * dpr - capture.y;

  let mx = cursorPos.x + offset + radius;
  let my = cursorPos.y + offset + radius;

  if (mx + radius > window.innerWidth) {
    mx = cursorPos.x - offset - radius;
  }
  if (my + radius > window.innerHeight) {
    my = cursorPos.y - offset - radius;
  }

  return (
    <Group x={mx} y={my}>
      <Circle
        radius={radius}
        fill="white"
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.3}
      />
      <Circle
        radius={radius}
        fillPatternImage={image}
        fillPatternOffset={{ x: localX, y: localY }}
        fillPatternScale={{ x: zoom / dpr, y: zoom / dpr }}
        stroke="white"
        strokeWidth={2}
      />
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
