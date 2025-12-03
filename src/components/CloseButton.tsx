import { X } from 'lucide-react';
import { getCurrentWindow } from "@tauri-apps/api/window";

export const CloseButton = () => {
  const handleClose = async () => {
    await getCurrentWindow().hide();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        zIndex: 9999,
        cursor: 'pointer',
        background: 'rgba(0,0,0,0.5)',
        borderRadius: '50%',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}
      onClick={handleClose}
      title="Close (Esc)"
    >
      <X size={16} />
    </div>
  );
};
