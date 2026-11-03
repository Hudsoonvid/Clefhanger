import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Registers the embedded Bravura music font (no network request).
import 'vexflow/bravura';
import { loadDocument, useEditor } from './editor/store';
import { createWelcomeScore } from './model/demo';
import { loadAutosave, writeAutosave } from './storage/autosave';
import { App } from './ui/App';
import './ui/styles.css';

function startAutosave(): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    const { score, fileName } = useEditor.getState();
    const ok = writeAutosave(score, fileName);
    useEditor.setState({ savedLocallyAt: ok ? Date.now() : null });
  };
  useEditor.subscribe((state, prev) => {
    if (state.score === prev.score && state.fileName === prev.fileName) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  });
  window.addEventListener('pagehide', flush);
}

async function main(): Promise<void> {
  // VexFlow measures glyphs while laying out, so the music font must be ready first.
  await Promise.all([document.fonts.load('30px Bravura'), document.fonts.load('12px Academico')]).catch(() => undefined);

  const saved = loadAutosave();
  loadDocument(saved?.score ?? createWelcomeScore(), saved?.fileName ?? null);
  if (saved) useEditor.setState({ savedLocallyAt: Date.now() });
  startAutosave();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void main();
