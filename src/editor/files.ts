/**
 * Opening and saving files. Uses the File System Access API where the
 * browser has it (so Save writes back to the same file) and falls back to a
 * plain download and file input everywhere else.
 */
import { exportMidi } from '../io/midi/export';
import { exportMusicXML } from '../io/musicxml/export';
import { importMusicXML } from '../io/musicxml/import';
import { musicXMLText } from '../io/musicxml/mxl';
import { parseProject, PROJECT_EXTENSION, serializeProject } from '../io/project';
import { createScore } from '../model/score';
import { playback } from '../playback/engine';
import { loadDocument, setStatus, useEditor } from './store';

interface FilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface WritableHandle {
  name: string;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

type PickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string; types: FilePickerType[] }) => Promise<WritableHandle>;
};

let projectHandle: WritableHandle | null = null;

function baseName(): string {
  const title = useEditor.getState().score.title.trim() || 'Untitled score';
  return title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'score';
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function saveBlob(blob: Blob, name: string, type: FilePickerType, handle?: WritableHandle | null) {
  const picker = (window as PickerWindow).showSaveFilePicker;
  try {
    const target = handle ?? (picker ? await picker({ suggestedName: name, types: [type] }) : null);
    if (target) {
      const writable = await target.createWritable();
      await writable.write(blob);
      await writable.close();
      return target;
    }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return null;
    // Some browsers expose the API but refuse it (e.g. inside iframes): fall back to a download.
  }
  download(blob, name);
  return null;
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

function stopPlaybackForLoad(): void {
  playback.stop();
  useEditor.setState({ playback: 'stopped', playingIds: [] });
}

export function newScore(): void {
  if (!confirm('Start a new score? The current score will be replaced, so save it first if you want to keep it.')) return;
  stopPlaybackForLoad();
  projectHandle = null;
  loadDocument(createScore());
  setStatus('New score');
}

export async function saveProject(saveAs = false): Promise<void> {
  const blob = new Blob([serializeProject(useEditor.getState().score)], { type: 'application/json' });
  const name = useEditor.getState().fileName ?? `${baseName()}${PROJECT_EXTENSION}`;
  const handle = await saveBlob(
    blob,
    name,
    { description: 'Clefhanger project', accept: { 'application/json': ['.json'] } },
    saveAs ? null : projectHandle,
  );
  if (handle) {
    projectHandle = handle;
    useEditor.setState({ fileName: handle.name });
  }
  setStatus(handle ? `Saved ${handle.name}` : `Downloaded ${name}`);
}

export async function openProject(): Promise<void> {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  try {
    const score = parseProject(await file.text());
    stopPlaybackForLoad();
    projectHandle = null;
    loadDocument(score, file.name);
    setStatus(`Opened ${file.name}`);
  } catch (err) {
    setStatus((err as Error).message, 'error');
  }
}

export async function importMusicXMLFile(): Promise<void> {
  const file = await pickFile('.musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml');
  if (!file) return;
  try {
    const score = importMusicXML(musicXMLText(await file.arrayBuffer()));
    stopPlaybackForLoad();
    projectHandle = null;
    loadDocument(score);
    setStatus(`Imported ${file.name}`);
  } catch (err) {
    setStatus(`Could not import ${file.name}: ${(err as Error).message}`, 'error');
  }
}

export async function exportMusicXMLFile(): Promise<void> {
  const xml = exportMusicXML(useEditor.getState().score, 'Clefhanger');
  const name = `${baseName()}.musicxml`;
  const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
  await saveBlob(blob, name, { description: 'MusicXML', accept: { 'application/vnd.recordare.musicxml+xml': ['.musicxml'] } });
  setStatus(`Exported ${name}`);
}

export async function exportMidiFile(): Promise<void> {
  const bytes = exportMidi(useEditor.getState().score);
  const name = `${baseName()}.mid`;
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'audio/midi' });
  await saveBlob(blob, name, { description: 'MIDI file', accept: { 'audio/midi': ['.mid'] } });
  setStatus(`Exported ${name}`);
}
