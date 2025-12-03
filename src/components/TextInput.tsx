import { useAppStore } from '../store';

export const TextInput = () => {
  const textInput = useAppStore(state => state.textInput);
  const setTextInput = useAppStore(state => state.setTextInput);
  const fontSize = useAppStore(state => state.fontSize);
  const color = useAppStore(state => state.color);
  const annotations = useAppStore(state => state.annotations);
  const setAnnotations = useAppStore(state => state.setAnnotations);
  const editingId = useAppStore(state => state.editingId);
  const setEditingId = useAppStore(state => state.setEditingId);

  const fontFamily = 'sans-serif';
  const lineHeight = 1.2;

  const handleTextSubmit = () => {
    if (textInput && textInput.value.trim()) {
      if (editingId) {
        const idx = annotations.findIndex(a => a.id === editingId);
        if (idx >= 0) {
          const newAnns = [...annotations];
          newAnns[idx] = {
            ...newAnns[idx],
            text: textInput.value,
          };
          setAnnotations(newAnns);
        }
        setEditingId(null);
      } else {
        setAnnotations([...annotations, {
          id: crypto.randomUUID(),
          type: 'text',
          x: textInput.x,
          y: textInput.y,
          text: textInput.value,
          color: color,
          fontSize: fontSize,
          width: 200
        }]);
      }
    } else if (editingId) {
      setEditingId(null);
    }
    setTextInput(null);
  };

  if (!textInput) return null;

  return (
    <textarea
      value={textInput.value}
      onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
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
      }}
      autoFocus
    />
  );
};
