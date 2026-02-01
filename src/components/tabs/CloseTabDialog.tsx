import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

interface CloseTabDialogProps {
  isOpen: boolean;
  fileName: string | null;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function CloseTabDialog({ isOpen, fileName, onSave, onDiscard, onCancel }: CloseTabDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onCancel()}>
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
            onClick={onCancel}
            variant="secondary"
            className="bg-toolbar-bg text-toolbar-text hover:bg-toolbar-hover"
          >
            Cancel
          </Button>
          <Button 
            onClick={onDiscard}
            variant="secondary"
            className="bg-toolbar-bg text-toolbar-text hover:bg-toolbar-hover"
          >
            Don't Save
          </Button>
          <Button 
            onClick={onSave}
            className="bg-accent-blue text-white hover:bg-accent-blue-hover"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
