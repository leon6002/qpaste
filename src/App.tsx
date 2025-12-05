import { useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from "@tauri-apps/api/window";
import './App.css';
import { useAppStore, Capture } from './store';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { TextInput } from './components/TextInput';
import { CursorInfo } from './components/CursorInfo';
import { SelectionOverlay } from './components/SelectionOverlay';
import { getSettingsStore } from './store-utils';

function App() {
  const setImages = useAppStore(state => state.setImages);
  const setCaptures = useAppStore(state => state.setCaptures);
  const setIsReady = useAppStore(state => state.setIsReady);
  const resetState = useAppStore(state => state.resetState);
  
  // Settings setters
  const setAppColor = useAppStore(state => state.setColor);
  const setAppFontSize = useAppStore(state => state.setFontSize);
  const setAppShowMagnifier = useAppStore(state => state.setShowMagnifier);
  const setAppMagnifierSize = useAppStore(state => state.setMagnifierSize);
  const setAppMagnifierZoom = useAppStore(state => state.setMagnifierZoom);

  useEffect(() => {
    const init = async () => {
      // Logic to check window label removed as we only have main window now
      await invoke('log_msg', { msg: "App initialized" });

      // Load settings for main window
      const store = await getSettingsStore();
      const savedColor = await store.get<string>('defaultColor');
      const savedFontSize = await store.get<number>('defaultFontSize');
      const savedMagEnabled = await store.get<boolean>('magnifierEnabled');
      const savedMagSize = await store.get<number>('magnifierSize');
      const savedMagZoom = await store.get<number>('magnifierZoom');

      if (savedColor) setAppColor(savedColor);
      if (savedFontSize) setAppFontSize(savedFontSize);
      if (savedMagEnabled !== null && savedMagEnabled !== undefined) setAppShowMagnifier(savedMagEnabled);
      if (savedMagSize) setAppMagnifierSize(savedMagSize);
      if (savedMagZoom) setAppMagnifierZoom(savedMagZoom);
    };
    init();
  }, []);

  const captureScreen = async () => {
    setIsReady(false);
    resetState();
    
    try {
      const captures: Capture[] = await invoke("capture_screen");

      const loadedImages = await Promise.all(captures.map(cap => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            resolve(img);
          };
          img.onerror = (e) => {
            reject(e);
          };
          img.src = cap.image_base64;
        });
      }));

      setImages(loadedImages);
      setCaptures(captures);
      setIsReady(true);

      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();

    } catch (error) {
      console.error("Failed to capture screen:", error);
      setIsReady(true);
    }
  };

  useEffect(() => {
    // captureScreen(); // Removed to prevent auto-capture on startup

    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      unlistenFn = await listen('start_capture', () => {
        captureScreen();
      });
    };

    setupListener();

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        await getCurrentWindow().hide();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useAppStore.getState();
        if (state.selectedId) {
          const newAnns = state.annotations.filter(a => a.id !== state.selectedId);
          state.setAnnotations(newAnns);
          state.setSelectedId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (unlistenFn) unlistenFn();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="container">
      <Canvas />
      <SelectionOverlay />
      <CursorInfo />
      <Toolbar />
      <TextInput />
    </div>
  );
}

export default App;
