import type { ReactNode } from 'react';
import {
  addMeasure,
  deleteAtCursor,
  deleteMeasure,
  enterRest,
  setAccidental,
  setDuration,
  tie,
  toggleDot,
  toggleInputMode,
  transpose,
  updateKey,
  updateTime,
} from '../../editor/commands';
import { DURATION_KEYS } from '../../editor/keyboard';
import { useEditor } from '../../editor/store';
import { DURATION_NAMES, DURATION_TYPES } from '../../model/duration';
import { keyName, relativeMinorName } from '../../model/pitch';
import type { DurationType } from '../../model/types';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EraseIcon,
  MeasureMinusIcon,
  MeasurePlusIcon,
  PencilIcon,
  PointerIcon,
  TieIcon,
} from '../icons';

/** SMuFL code points in the Bravura font that VexFlow already loads. */
const NOTE_GLYPHS: Record<DurationType, string> = {
  w: '',
  h: '',
  q: '',
  '8': '',
  '16': '',
  '32': '',
};
const DOT = '';
const REST = '';
const FLAT = '';
const NATURAL = '';
const SHARP = '';

const KEY_FOR_DURATION = Object.fromEntries(Object.entries(DURATION_KEYS).map(([k, v]) => [v, k]));

const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/4', '2/2', '3/8', '6/8', '9/8', '12/8'];

/** Toolbar buttons should not steal keyboard focus from the score. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

function ToolButton(props: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  const title = props.shortcut ? `${props.label} (${props.shortcut})` : props.label;
  return (
    <button
      type="button"
      className={`tool${props.active ? ' is-active' : ''}${props.className ? ` ${props.className}` : ''}`}
      title={title}
      aria-label={props.label}
      aria-pressed={props.active}
      onMouseDown={keepFocus}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function Palette() {
  const inputMode = useEditor((s) => s.inputMode);
  const duration = useEditor((s) => s.duration);
  const dots = useEditor((s) => s.dots);
  const fifths = useEditor((s) => s.score.keySignature.fifths);
  const ts = useEditor((s) => s.score.timeSignature);

  return (
    <div className="palette" role="toolbar" aria-label="Notation tools">
      <div className="tool-group">
        <ToolButton
          label={inputMode ? 'Note input (on)' : 'Select mode'}
          shortcut="N"
          active={inputMode}
          onClick={() => toggleInputMode()}
          className="mode-toggle"
        >
          {inputMode ? <PencilIcon /> : <PointerIcon />}
          <span className="tool-text">{inputMode ? 'Input' : 'Select'}</span>
        </ToolButton>
      </div>

      <div className="tool-group">
        {DURATION_TYPES.map((type) => (
          <ToolButton
            key={type}
            label={`${DURATION_NAMES[type]} note`}
            shortcut={KEY_FOR_DURATION[type]}
            active={duration === type}
            onClick={() => setDuration(type)}
          >
            <span className={`glyph glyph-note glyph-${type}`}>{NOTE_GLYPHS[type]}</span>
          </ToolButton>
        ))}
        <ToolButton label="Dot" shortcut="." active={dots > 0} onClick={toggleDot}>
          <span className="glyph glyph-dot">{DOT}</span>
        </ToolButton>
        <ToolButton label="Rest" shortcut="0" onClick={enterRest}>
          <span className="glyph glyph-rest">{REST}</span>
        </ToolButton>
      </div>

      <div className="tool-group">
        <ToolButton label="Flat" shortcut="-" onClick={() => setAccidental(-1)}>
          <span className="glyph glyph-acc">{FLAT}</span>
        </ToolButton>
        <ToolButton label="Natural" shortcut="=" onClick={() => setAccidental(0)}>
          <span className="glyph glyph-acc">{NATURAL}</span>
        </ToolButton>
        <ToolButton label="Sharp" shortcut="+" onClick={() => setAccidental(1)}>
          <span className="glyph glyph-acc">{SHARP}</span>
        </ToolButton>
        <ToolButton label="Tie" shortcut="T" onClick={tie}>
          <TieIcon />
        </ToolButton>
      </div>

      <div className="tool-group">
        <ToolButton label="Pitch up" shortcut="↑" onClick={() => transpose('diatonic', 1)}>
          <ChevronUpIcon />
        </ToolButton>
        <ToolButton label="Pitch down" shortcut="↓" onClick={() => transpose('diatonic', -1)}>
          <ChevronDownIcon />
        </ToolButton>
        <ToolButton label="Delete note" shortcut="Del" onClick={() => deleteAtCursor(false)}>
          <EraseIcon />
        </ToolButton>
      </div>

      <div className="tool-group">
        <label className="select-tool" title="Key signature">
          <span className="visually-hidden">Key signature</span>
          <select
            value={fifths}
            onChange={(e) => {
              updateKey(Number(e.target.value));
              e.target.blur();
            }}
          >
            {Array.from({ length: 15 }, (_, i) => i - 7).map((f) => (
              <option key={f} value={f}>
                {keyName(f).replace('b', '♭').replace('#', '♯')} major / {relativeMinorName(f).replace('b', '♭').replace('#', '♯')} minor
              </option>
            ))}
          </select>
        </label>
        <label className="select-tool select-time" title="Time signature">
          <span className="visually-hidden">Time signature</span>
          <select
            value={`${ts.beats}/${ts.beatType}`}
            onChange={(e) => {
              const [beats, beatType] = e.target.value.split('/').map(Number);
              updateTime({ beats, beatType });
              e.target.blur();
            }}
          >
            {(TIME_SIGNATURES.includes(`${ts.beats}/${ts.beatType}`)
              ? TIME_SIGNATURES
              : [...TIME_SIGNATURES, `${ts.beats}/${ts.beatType}`]
            ).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <ToolButton label="Add measure" shortcut="Ctrl+B" onClick={addMeasure}>
          <MeasurePlusIcon />
        </ToolButton>
        <ToolButton label="Delete selected measure" onClick={deleteMeasure}>
          <MeasureMinusIcon />
        </ToolButton>
      </div>
    </div>
  );
}
