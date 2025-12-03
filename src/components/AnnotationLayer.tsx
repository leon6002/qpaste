import React from 'react';
import { Rect, Arrow, Group, Text } from 'react-konva';
import { useAppStore } from '../store';

export const AnnotationLayer = () => {
  const annotations = useAppStore(state => state.annotations);
  const setAnnotations = useAppStore(state => state.setAnnotations);
  const currentAnnotation = useAppStore(state => state.currentAnnotation);
  const selection = useAppStore(state => state.selection);
  const setEditingId = useAppStore(state => state.setEditingId);
  const setTextInput = useAppStore(state => state.setTextInput);
  const editingId = useAppStore(state => state.editingId);
  const tool = useAppStore(state => state.tool);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const fontFamily = 'sans-serif';
  const lineHeight = 1.2;

  const getSelectionRect = () => {
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);
    return { x, y, width, height };
  };

  const { x, y, width, height } = getSelectionRect();



  return (
    <Group clipX={x} clipY={y} clipWidth={width} clipHeight={height}>
      {annotations.map((ann) => {
        const commonProps = {
          name: `ann-${ann.id}`,
          draggable: tool === 'select',
          listening: tool === 'select',
          onMouseDown: (e: any) => {
            e.cancelBubble = true;
            // if (textInput) handleTextSubmit(); // Handled globally or in store
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
          },
          onMouseEnter: (e: any) => {
            if (tool === 'select') {
              const container = e.target.getStage().container();
              container.style.cursor = 'move';
              setHoveredId(ann.id);
            }
          },
          onMouseLeave: (e: any) => {
            if (tool === 'select') {
              const container = e.target.getStage().container();
              container.style.cursor = 'default';
              setHoveredId(null);
            }
          },
          shadowColor: 'black',
          shadowBlur: hoveredId === ann.id ? 10 : 0,
          shadowOpacity: 0.6,
          shadowOffset: { x: 0, y: 0 }
        };

        if (ann.type === 'rect') {
          return (
            <Rect
              key={ann.id}
              {...commonProps}
              x={ann.x} y={ann.y}
              width={ann.width || 0} height={ann.height || 0}
              stroke={ann.color} strokeWidth={2}
              scaleX={ann.scaleX} scaleY={ann.scaleY}

            />
          );
        } else if (ann.type === 'arrow') {
          return <Arrow key={ann.id} {...commonProps} points={ann.points || []} stroke={ann.color} strokeWidth={2} fill={ann.color} />;
        } else if (ann.type === 'text') {
          return (
            <Group
              key={ann.id}
              name={`ann-${ann.id}`}
              x={ann.x} y={ann.y}
              draggable={tool === 'select'}
              listening={tool === 'select'}
              onMouseDown={commonProps.onMouseDown}
              onMouseEnter={commonProps.onMouseEnter}
              onMouseLeave={commonProps.onMouseLeave}
              shadowColor={commonProps.shadowColor}
              shadowBlur={commonProps.shadowBlur}
              shadowOpacity={commonProps.shadowOpacity}
              shadowOffset={commonProps.shadowOffset}
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
  );
};
