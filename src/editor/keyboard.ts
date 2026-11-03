import type { DurationType, Step } from '../model/types';
import {
  addMeasure,
  deleteAtCursor,
  enterRest,
  enterStep,
  moveCursor,
  moveStaff,
  moveToEdge,
  setAccidental,
  setDuration,
  tie,
  toggleDot,
  toggleInputMode,
  transpose,
} from './commands';
import { openProject, saveProject } from './files';
import { stopPlayback, togglePlayback } from './playbackControl';
import { redo, undo, useEditor } from './store';

/** Number keys for durations, following the convention of most notation editors. */
export const DURATION_KEYS: Record<string, DurationType> = {
  '7': 'w',
  '6': 'h',
  '5': 'q',
  '4': '8',
  '3': '16',
  '2': '32',
};

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'N', action: 'Toggle note input / select mode' },
  { keys: 'A – G', action: 'Enter a note (or change the selected note)' },
  { keys: 'Shift + A – G', action: 'Add a note to the chord' },
  { keys: 'Click staff', action: 'Place a note (Shift + click adds to chord)' },
  { keys: '0 or R', action: 'Enter a rest' },
  { keys: '7 6 5 4 3 2', action: 'Whole, half, quarter, eighth, 16th, 32nd' },
  { keys: '.', action: 'Toggle dot' },
  { keys: '+ or #', action: 'Sharp' },
  { keys: '-', action: 'Flat' },
  { keys: '=', action: 'Natural' },
  { keys: 'T', action: 'Tie (adds a tied note in input mode)' },
  { keys: '↑ / ↓', action: 'Move pitch by step in the key' },
  { keys: 'Shift + ↑ / ↓', action: 'Move pitch by semitone' },
  { keys: 'Ctrl + ↑ / ↓', action: 'Move pitch by octave' },
  { keys: '← / →', action: 'Previous / next note' },
  { keys: 'Ctrl + ← / →', action: 'Previous / next measure' },
  { keys: 'Alt + ↑ / ↓', action: 'Staff above / below' },
  { keys: 'Home / End', action: 'Start / end of score' },
  { keys: 'Delete / Backspace', action: 'Turn note into rest' },
  { keys: 'Space', action: 'Play / pause' },
  { keys: 'Esc', action: 'Stop playback, or leave note input' },
  { keys: 'Ctrl + Z', action: 'Undo' },
  { keys: 'Ctrl + Y / Ctrl + Shift + Z', action: 'Redo' },
  { keys: 'Ctrl + B', action: 'Add a measure at the end' },
  { keys: 'Ctrl + S / Ctrl + Shift + S', action: 'Save / save as' },
  { keys: 'Ctrl + O', action: 'Open project' },
  { keys: '?', action: 'Show this list' },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Handle a keydown. Returns true if it was a Clefhanger shortcut. */
export function handleKey(e: KeyboardEvent, openHelp: () => void): boolean {
  if (isTyping(e.target) || document.querySelector('dialog[open]')) return false;
  // Let focused buttons handle Space and Enter themselves.
  if ((e.key === ' ' || e.key === 'Enter') && (e.target as HTMLElement)?.tagName === 'BUTTON') return false;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (mod) {
    switch (lower) {
      case 'z':
        if (e.shiftKey) redo();
        else undo();
        return true;
      case 'y':
        redo();
        return true;
      case 's':
        void saveProject(e.shiftKey);
        return true;
      case 'o':
        void openProject();
        return true;
      case 'b':
        addMeasure();
        return true;
      case 'ArrowUp':
      case 'ArrowDown':
        transpose('octave', key === 'ArrowUp' ? 1 : -1);
        return true;
      case 'ArrowLeft':
      case 'ArrowRight':
        moveCursor(key === 'ArrowRight' ? 1 : -1, true);
        return true;
    }
    return false;
  }
  if (e.altKey) {
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      moveStaff(key === 'ArrowDown' ? 1 : -1);
      return true;
    }
    return false;
  }

  if ('abcdefg'.includes(lower) && lower.length === 1) {
    enterStep(lower.toUpperCase() as Step, e.shiftKey);
    return true;
  }
  const digit = e.code.startsWith('Numpad') ? e.code.slice(6) : key;
  if (DURATION_KEYS[digit]) {
    setDuration(DURATION_KEYS[digit]);
    return true;
  }
  switch (key) {
    case '0':
    case 'r':
    case 'R':
      enterRest();
      return true;
    case '.':
      toggleDot();
      return true;
    case '+':
    case '#':
      setAccidental(1);
      return true;
    case '-':
      setAccidental(-1);
      return true;
    case '=':
      // Shift+= is "+" on most layouts, but some report "=" with Shift held.
      setAccidental(e.shiftKey ? 1 : 0);
      return true;
    case 't':
    case 'T':
      tie();
      return true;
    case 'n':
    case 'N':
      toggleInputMode();
      return true;
    case 'ArrowUp':
    case 'ArrowDown':
      transpose(e.shiftKey ? 'chromatic' : 'diatonic', key === 'ArrowUp' ? 1 : -1);
      return true;
    case 'ArrowLeft':
    case 'ArrowRight':
      moveCursor(key === 'ArrowRight' ? 1 : -1);
      return true;
    case 'Home':
    case 'End':
      moveToEdge(key === 'End');
      return true;
    case 'Delete':
    case 'Backspace':
      deleteAtCursor(key === 'Backspace');
      return true;
    case ' ':
      void togglePlayback();
      return true;
    case 'Escape':
      if (useEditor.getState().playback !== 'stopped') stopPlayback();
      else toggleInputMode(false);
      return true;
    case '?':
      openHelp();
      return true;
  }
  return false;
}
