import { useCallback, useEffect, useState } from 'react';
import { handleKey } from '../editor/keyboard';
import { readPreference, writePreference } from '../storage/autosave';
import { InstrumentsPanel } from './components/InstrumentsPanel';
import { Palette } from './components/Palette';
import { PlaybackBar } from './components/PlaybackBar';
import { ScoreView } from './components/ScoreView';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { TopBar } from './components/TopBar';

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  const saved = readPreference('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [helpOpen, setHelpOpen] = useState(false);
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writePreference('theme', next);
  };

  const openHelp = useCallback(() => setHelpOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (instrumentsOpen) {
        if (e.key === 'Escape') setInstrumentsOpen(false);
        return;
      }
      if (handleKey(e, openHelp)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openHelp, instrumentsOpen]);

  return (
    <div className="app">
      <TopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        onShowHelp={openHelp}
        onShowInstruments={() => setInstrumentsOpen(true)}
      />
      <Palette />
      <main className="workspace">
        <ScoreView />
      </main>
      <PlaybackBar />
      <InstrumentsPanel open={instrumentsOpen} onClose={() => setInstrumentsOpen(false)} />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
