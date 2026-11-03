import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '../../editor/keyboard';
import { CloseIcon } from '../icons';

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="shortcuts-title"
    >
      <header className="dialog-header">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" className="bar-button" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>
      <p className="dialog-intro">
        <strong>Note input</strong> (pencil) writes at the cursor and moves on, like typing. <strong>Select</strong> mode
        edits the note you click. On a Mac, use ⌘ instead of Ctrl.
      </p>
      <table className="shortcuts">
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.keys}>
              <td>
                <kbd>{s.keys}</kbd>
              </td>
              <td>{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </dialog>
  );
}
