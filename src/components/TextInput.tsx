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
            // We don't update x/y here because we assume the text box didn't move, 
            // only content changed. 
            // BUT if we are editing, the TextInput was placed at ann.x - 6.
            // So the text inside is at (ann.x - 6) + 6 = ann.x.
            // So we don't need to update x/y if we didn't move the box.
            // However, if we want to be safe or if we support moving the text input later:
            // x: textInput.x + 6,
            // y: textInput.y + 6
          };
          setAnnotations(newAnns);
        }
        setEditingId(null);
      } else {
        setAnnotations([...annotations, {
          id: crypto.randomUUID(),
          type: 'text',
          x: textInput.x + 6, // Offset for border(2) + padding(4)
          y: textInput.y + 6,
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
        background: 'rgba(255, 255, 255, 0.3)', // More transparent
        border: '2px dashed #00AAFF',
        outline: 'none',
        minWidth: '300px', // Longer
        height: `${fontSize * lineHeight + 8}px`, // Match font size + padding
        zIndex: 2000,
        overflow: 'hidden',
        padding: '4px',
        // borderRadius: '4px', // Removed for cleaner look
        // boxShadow: '0 2px 4px rgba(0,0,0,0.2)' // Removed for cleaner look
      }}
      placeholder="Type here..."
      autoFocus
    />
  );
};
