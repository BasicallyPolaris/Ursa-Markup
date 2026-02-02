import { useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { useTabManager } from '../../contexts/TabManagerContext';

export function CloseTabDialog() {
  const { pendingCloseDocument, confirmCloseWithSave, confirmCloseWithoutSave, cancelClose } = useTabManager();
  
  const isOpen = pendingCloseDocument !== null;
  const fileName = pendingCloseDocument?.fileName ?? null;
  
  const handleSave = useCallback(() => {
    confirmCloseWithSave();
  }, [confirmCloseWithSave]);
  
  const handleDiscard = useCallback(() => {
    confirmCloseWithoutSave();
  }, [confirmCloseWithoutSave]);
  
  const handleCancel = useCallback(() => {
    cancelClose();
  }, [cancelClose]);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && handleCancel()}>
      <DialogContent className="bg-panel-bg border-panel-border text-text-primary">
        <DialogHeader>
          <DialogTitle>Save Changes?</DialogTitle>
          <DialogDescription className="text-text-secondary">
            {fileName 
              ? `"${fileName}" has unsaved changes.` 
              : 'This tab has unsaved changes.'}
            Do you want to save them before closing?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button 
            onClick={handleCancel}
            variant="secondary"
            className="bg-toolbar-bg text-toolbar-text hover:bg-toolbar-hover"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDiscard}
            variant="secondary"
            className="bg-toolbar-bg text-toolbar-text hover:bg-toolbar-hover"
          >
            Don't Save
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-accent-blue text-white hover:bg-accent-blue-hover"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
