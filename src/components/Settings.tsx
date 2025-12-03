import { useEffect, useState } from 'react';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { useAppStore } from '../store';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getSettingsStore } from '../store-utils';

export const Settings = () => {
  const [autoStart, setAutoStart] = useState(false);
  const [defaultColor, setDefaultColor] = useState('#FF0000');
  const [defaultFontSize, setDefaultFontSize] = useState(16);
  const [magnifierEnabled, setMagnifierEnabled] = useState(true);
  const [magnifierSize, setMagnifierSize] = useState(60);
  const [magnifierZoom, setMagnifierZoom] = useState(2);

  const setAppColor = useAppStore(state => state.setColor);
  const setAppFontSize = useAppStore(state => state.setFontSize);
  const setAppShowMagnifier = useAppStore(state => state.setShowMagnifier);
  const setAppMagnifierSize = useAppStore(state => state.setMagnifierSize);
  const setAppMagnifierZoom = useAppStore(state => state.setMagnifierZoom);

  useEffect(() => {
    const loadSettings = async () => {
      const store = await getSettingsStore();
      const savedColor = await store.get<string>('defaultColor');
      const savedFontSize = await store.get<number>('defaultFontSize');
      const savedMagEnabled = await store.get<boolean>('magnifierEnabled');
      const savedMagSize = await store.get<number>('magnifierSize');
      const savedMagZoom = await store.get<number>('magnifierZoom');

      if (savedColor) {
        setDefaultColor(savedColor);
        setAppColor(savedColor);
      }
      if (savedFontSize) {
        setDefaultFontSize(savedFontSize);
        setAppFontSize(savedFontSize);
      }
      if (savedMagEnabled !== null && savedMagEnabled !== undefined) {
        setMagnifierEnabled(savedMagEnabled);
        setAppShowMagnifier(savedMagEnabled);
      }
      if (savedMagSize) {
        setMagnifierSize(savedMagSize);
        setAppMagnifierSize(savedMagSize);
      }
      if (savedMagZoom) {
        setMagnifierZoom(savedMagZoom);
        setAppMagnifierZoom(savedMagZoom);
      }

      const autostartEnabled = await isEnabled();
      setAutoStart(autostartEnabled);
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    const store = await getSettingsStore();
    await store.set('defaultColor', defaultColor);
    await store.set('defaultFontSize', defaultFontSize);
    await store.set('magnifierEnabled', magnifierEnabled);
    await store.set('magnifierSize', magnifierSize);
    await store.set('magnifierZoom', magnifierZoom);
    await store.save();

    // Update app state immediately
    setAppColor(defaultColor);
    setAppFontSize(defaultFontSize);
    setAppShowMagnifier(magnifierEnabled);
    setAppMagnifierSize(magnifierSize);
    setAppMagnifierZoom(magnifierZoom);

    if (autoStart) {
      await enable();
    } else {
      await disable();
    }
    
    // Hide window instead of close to keep state if needed, or close
    await getCurrentWindow().hide();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', color: '#333', background: '#f5f5f7', height: '100vh', boxSizing: 'border-box' }}>
      <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Settings</h2>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Default Color</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FFFFFF', '#000000'].map(c => (
            <div
              key={c}
              onClick={() => setDefaultColor(c)}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: c,
                border: defaultColor === c ? '2px solid #007AFF' : '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Default Font Size: {defaultFontSize}px</label>
        <input
          type="range"
          min="12"
          max="48"
          value={defaultFontSize}
          onChange={(e) => setDefaultFontSize(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={magnifierEnabled}
            onChange={(e) => setMagnifierEnabled(e.target.checked)}
          />
          Enable Magnifier
        </label>
      </div>

      {magnifierEnabled && (
        <>
          <div style={{ marginBottom: '15px', paddingLeft: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Magnifier Size: {magnifierSize}px</label>
            <input
              type="range"
              min="40"
              max="150"
              value={magnifierSize}
              onChange={(e) => setMagnifierSize(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px', paddingLeft: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Magnifier Zoom: {magnifierZoom}x</label>
            <input
              type="range"
              min="2"
              max="10"
              value={magnifierZoom}
              onChange={(e) => setMagnifierZoom(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}

      <div style={{ marginBottom: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
          />
          Launch on Startup
        </label>
      </div>

      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: '10px',
          background: '#007AFF',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        Save & Close
      </button>
    </div>
  );
};
