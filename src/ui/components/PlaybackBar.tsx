import { useEffect, useState } from 'react';
import { updateTempo } from '../../editor/commands';
import { stopPlayback, togglePlayback } from '../../editor/playbackControl';
import { useEditor } from '../../editor/store';
import { DURATION_NAMES } from '../../model/duration';
import { pitchLabel } from '../../model/pitch';
import { getEvent } from '../../model/score';
import { PauseIcon, PlayIcon, StopIcon } from '../icons';

const STATUS_MS = 4000;

function useSelectionLabel(): string {
  const score = useEditor((s) => s.score);
  const sel = useEditor((s) => s.selection);
  const inputMode = useEditor((s) => s.inputMode);
  if (!sel) return '';
  const part = score.parts[sel.part];
  const e = getEvent(score, sel);
  if (!part || !e) return '';
  const staff = part.staves.length > 1 ? ` · staff ${sel.staff + 1}` : '';
  const what =
    e.kind === 'rest'
      ? `${DURATION_NAMES[e.duration.type].toLowerCase()} rest`
      : `${e.pitches.map(pitchLabel).join(' ')} ${DURATION_NAMES[e.duration.type].toLowerCase()}`;
  return `${inputMode ? 'Cursor' : 'Selected'}: ${part.name}${staff} · m. ${sel.measure + 1} · ${what}${e.duration.dots ? ' (dotted)' : ''}`;
}

export function PlaybackBar() {
  const playback = useEditor((s) => s.playback);
  const tempo = useEditor((s) => s.score.tempo);
  const status = useEditor((s) => s.status);
  const savedAt = useEditor((s) => s.savedLocallyAt);
  const selectionLabel = useSelectionLabel();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => tick((n) => n + 1), STATUS_MS);
    return () => clearTimeout(t);
  }, [status]);
  const showStatus = status && Date.now() - status.at < STATUS_MS;

  return (
    <footer className="playbar">
      <div className="transport">
        <button
          type="button"
          className="play-button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void togglePlayback()}
          aria-label={playback === 'playing' ? 'Pause' : 'Play'}
          title={playback === 'playing' ? 'Pause (Space)' : 'Play from the selected measure (Space)'}
        >
          {playback === 'playing' ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="bar-button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={stopPlayback}
          disabled={playback === 'stopped'}
          aria-label="Stop"
          title="Stop (Esc)"
        >
          <StopIcon />
        </button>
        <label className="tempo" title="Tempo in quarter notes per minute">
          <span className="tempo-glyph" aria-hidden="true">
            {''}
          </span>
          <span className="visually-hidden">Tempo</span>
          <span aria-hidden="true">=</span>
          <input
            type="number"
            min={20}
            max={400}
            value={tempo}
            onChange={(e) => e.target.value && updateTempo(Number(e.target.value))}
            className="tempo-number"
          />
          <input
            type="range"
            min={30}
            max={240}
            value={Math.min(240, Math.max(30, tempo))}
            onChange={(e) => updateTempo(Number(e.target.value))}
            onMouseUp={(e) => e.currentTarget.blur()}
            onTouchEnd={(e) => e.currentTarget.blur()}
            className="tempo-slider"
            aria-label="Tempo slider"
          />
        </label>
      </div>
      <div className={`status${showStatus && status?.tone === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
        {showStatus ? status!.text : selectionLabel}
      </div>
      <div className="saved" title="Your score is saved automatically in this browser. Nothing is uploaded.">
        {savedAt ? 'Saved in this browser' : 'Not saved yet'}
      </div>
    </footer>
  );
}
