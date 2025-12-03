import { Group, Line, Text } from 'react-konva';
import { useAppStore } from '../store';
import { invoke } from "@tauri-apps/api/core";

export const CursorInfo = () => {
  invoke("log_msg", { msg: "Render: CursorInfo" });
  const cursorPos = useAppStore(state => state.cursorPos);
  const showToolbar = useAppStore(state => state.showToolbar);

  if (!cursorPos || showToolbar) return null;

  return (
    <Group>
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
    </Group>
  );
};
