import React from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../store';

export const SelectionOverlay = () => {
  const selectedId = useAppStore(state => state.selectedId);
  const annotations = useAppStore(state => state.annotations);
  const setAnnotations = useAppStore(state => state.setAnnotations);
  const setSelectedId = useAppStore(state => state.setSelectedId);
  const tool = useAppStore(state => state.tool);

  if (!selectedId || tool !== 'select') return null;

  const ann = annotations.find(a => a.id === selectedId);
  if (!ann) return null;

  let btnX = 0;
  let btnY = 0;

  // Calculate position (top-right corner)
  if (ann.type === 'rect') {
    btnX = ann.x + (ann.width || 0);
    btnY = ann.y;
  } else if (ann.type === 'text') {
    // Estimate width if not available, though store should have it
    btnX = ann.x + (ann.width || 100); 
    btnY = ann.y;
  } else if (ann.type === 'arrow' && ann.points) {
    const xs = ann.points.filter((_, i) => i % 2 === 0);
    const ys = ann.points.filter((_, i) => i % 2 === 1);
    btnX = Math.max(...xs);
    btnY = Math.min(...ys);
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newAnns = annotations.filter(a => a.id !== selectedId);
    setAnnotations(newAnns);
    setSelectedId(null);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: btnX,
        top: btnY,
        transform: 'translate(-50%, -50%)', // Center on the corner
        zIndex: 1000,
        cursor: 'pointer',
      }}
      onClick={handleDelete}
      title="Delete"
    >
      <div style={{
        background: '#FF3B30',
        borderRadius: '50%',
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        border: '2px solid white'
      }}>
        <X size={12} color="white" strokeWidth={3} />
      </div>
    </div>
  );
};
