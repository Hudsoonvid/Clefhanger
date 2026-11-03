import { playback } from '../playback/engine';
import { playbackStartTick } from './commands';
import { setStatus, useEditor } from './store';

/** The event currently sounding on each staff, for highlighting. */
const current = new Map<string, string>();

export async function togglePlayback(): Promise<void> {
  const s = useEditor.getState();
  if (s.playback === 'playing') {
    playback.pause();
    useEditor.setState({ playback: 'paused' });
    return;
  }
  if (s.playback === 'paused') {
    playback.resume();
    useEditor.setState({ playback: 'playing' });
    return;
  }
  current.clear();
  useEditor.setState({ playback: 'playing', playingIds: [] });
  try {
    await playback.play(s.score, playbackStartTick(), {
      onEvents(events) {
        for (const e of events) current.set(`${e.part}:${e.staff}`, e.id);
        useEditor.setState({ playingIds: [...current.values()] });
      },
      onEnd() {
        current.clear();
        useEditor.setState({ playback: 'stopped', playingIds: [] });
      },
    });
  } catch (err) {
    useEditor.setState({ playback: 'stopped', playingIds: [] });
    setStatus(`Audio could not start: ${(err as Error).message}`, 'error');
  }
}

export function stopPlayback(): void {
  playback.stop();
  current.clear();
  useEditor.setState({ playback: 'stopped', playingIds: [] });
}
