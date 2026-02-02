import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTabManager } from '../contexts/TabManagerContext';

/**
 * useWindowTitle updates the window title based on the active document
 */
export function useWindowTitle() {
  const { activeDocument } = useTabManager();

  useEffect(() => {
    const updateTitle = async () => {
      const currentWindow = getCurrentWindow();
      const title = activeDocument 
        ? `${activeDocument.getDisplayTitle()}${activeDocument.hasChanges ? ' ●' : ''} - OmniMark`
        : 'OmniMark';
      
      await currentWindow.setTitle(title);
    };

    updateTitle();
  }, [activeDocument?.fileName, activeDocument?.hasChanges]);
}
