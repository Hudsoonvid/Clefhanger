import { useEffect, useRef, useState } from 'react';
import {
  exportMidiFile,
  exportMusicXMLFile,
  importMusicXMLFile,
  newScore,
  openProject,
  saveProject,
} from '../../editor/files';
import { redo, undo, useEditor } from '../../editor/store';
import { FileIcon, InstrumentsIcon, KeyboardIcon, LogoMark, MoonIcon, RedoIcon, SunIcon, UndoIcon } from '../icons';

const MENU: { label: string; hint?: string; action: () => void | Promise<void>; divider?: boolean }[] = [
  { label: 'New score', action: newScore },
  { label: 'Open project…', hint: 'Ctrl+O', action: openProject },
  { label: 'Save project', hint: 'Ctrl+S', action: () => saveProject(false) },
  { label: 'Save project as…', hint: 'Ctrl+Shift+S', action: () => saveProject(true) },
  { label: 'Import MusicXML…', action: importMusicXMLFile, divider: true },
  { label: 'Export MusicXML', action: exportMusicXMLFile },
  { label: 'Export MIDI', action: exportMidiFile },
];

function FileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="bar-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <FileIcon />
        <span className="bar-label">File</span>
      </button>
      {open && (
        <div className="menu-popover" role="menu">
          {MENU.map((item) => (
            <div key={item.label}>
              {item.divider && <div className="menu-divider" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setOpen(false);
                  void item.action();
                }}
              >
                <span>{item.label}</span>
                {item.hint && <kbd>{item.hint}</kbd>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar(props: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onShowHelp: () => void;
  onShowInstruments: () => void;
}) {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const fileName = useEditor((s) => s.fileName);

  return (
    <header className="topbar">
      <div className="brand">
        <LogoMark />
        <span className="brand-name">Clefhanger</span>
        {fileName && <span className="file-name" title={fileName}>{fileName}</span>}
      </div>
      <nav className="topbar-actions" aria-label="Main">
        <FileMenu />
        <button type="button" className="bar-button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          <UndoIcon />
        </button>
        <button type="button" className="bar-button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
          <RedoIcon />
        </button>
        <span className="bar-spacer" />
        <button type="button" className="bar-button" onClick={props.onShowInstruments} title="Instruments" aria-label="Instruments">
          <InstrumentsIcon />
          <span className="bar-label">Instruments</span>
        </button>
        <button type="button" className="bar-button" onClick={props.onShowHelp} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
          <KeyboardIcon />
        </button>
        <button
          type="button"
          className="bar-button"
          onClick={props.onToggleTheme}
          title={props.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={props.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {props.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </nav>
    </header>
  );
}
