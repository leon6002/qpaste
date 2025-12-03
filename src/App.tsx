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
import { CloseButton } from './components/CloseButton';

function App() {
  invoke("log_msg", { msg: "Render: App" });
  const setImages = useAppStore(state => state.setImages);
  const setCaptures = useAppStore(state => state.setCaptures);
  const setIsReady = useAppStore(state => state.setIsReady);
  const resetState = useAppStore(state => state.resetState);

  const captureScreen = async () => {
    setIsReady(false);
    resetState();
    
    try {
      await invoke("log_msg", { msg: "Invoking capture_screen..." });
      const captures: Capture[] = await invoke("capture_screen");
      await invoke("log_msg", { msg: `Captures received: ${captures.length}` });

      await invoke("log_msg", { msg: "Loading images..." });
      const loadedImages = await Promise.all(captures.map(cap => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            // invoke("log_msg", { msg: "Image loaded" }); // Too noisy
            resolve(img);
          };
          img.onerror = (e) => {
            invoke("log_msg", { msg: `Image load error: ${JSON.stringify(e)}` });
            reject(e);
          };
          img.src = cap.image_base64;
        });
      }));
      await invoke("log_msg", { msg: "All images loaded" });

      setImages(loadedImages);
      setCaptures(captures);
      setIsReady(true);

      const win = getCurrentWindow();
      await invoke("log_msg", { msg: "Showing window..." });
      await win.show();
      await win.setFocus();
      await invoke("log_msg", { msg: "Window shown and focused" });

    } catch (error) {
      await invoke("log_msg", { msg: `Failed to capture screen: ${JSON.stringify(error)}` });
      setIsReady(true);
    }
  };

  useEffect(() => {
    captureScreen();

    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      unlistenFn = await listen('start_capture', () => {
        invoke("log_msg", { msg: "Received start_capture event" });
        captureScreen();
      });
    };

    setupListener();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  return (
    <>
      <CloseButton />
      <Canvas>
        <CursorInfo />
      </Canvas>
      <Toolbar />
      <TextInput />
    </>
  );
}

export default App;
