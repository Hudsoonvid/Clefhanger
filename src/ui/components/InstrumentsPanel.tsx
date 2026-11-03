import { useState } from 'react';
import { addInstrument, changeClef, moveInstrument, removeInstrument, renameInstrument } from '../../editor/commands';
import { useEditor } from '../../editor/store';
import { INSTRUMENTS, type InstrumentFamily } from '../../model/instruments';
import type { ClefType } from '../../model/types';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, PlusIcon, TrashIcon } from '../icons';

const FAMILY_NAMES: Record<InstrumentFamily, string> = {
  keyboard: 'Keyboards',
  strings: 'Strings',
  woodwind: 'Woodwinds',
  brass: 'Brass',
  plucked: 'Plucked',
  voice: 'Voices',
};
const CLEFS: ClefType[] = ['treble', 'bass', 'alto', 'tenor'];

export function InstrumentsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const parts = useEditor((s) => s.score.parts);
  const [choice, setChoice] = useState('violin');
  const families = Object.keys(FAMILY_NAMES) as InstrumentFamily[];

  return (
    <div className="drawer-layer">
      <div className={`scrim${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer${open ? ' is-open' : ''}`} aria-label="Instruments" aria-hidden={!open} inert={!open}>
        <header className="drawer-header">
          <h2>Instruments</h2>
          <button type="button" className="bar-button" onClick={onClose} aria-label="Close instruments">
            <CloseIcon />
          </button>
        </header>
        <ol className="part-list">
          {parts.map((part, i) => (
            <li key={part.id} className="part-row">
              <div className="part-fields">
                <input
                  value={part.name}
                  onChange={(e) => renameInstrument(i, e.target.value)}
                  aria-label={`Name of part ${i + 1}`}
                  className="part-name"
                />
                <input
                  value={part.abbreviation}
                  onChange={(e) => renameInstrument(i, part.name, e.target.value)}
                  aria-label={`Short name of part ${i + 1}`}
                  className="part-abbr"
                  placeholder="Short"
                />
              </div>
              <div className="part-clefs">
                {part.staves.map((staff, si) => (
                  <select
                    key={staff.id}
                    value={staff.clef}
                    onChange={(e) => changeClef(i, si, e.target.value as ClefType)}
                    aria-label={`Clef for staff ${si + 1} of ${part.name}`}
                  >
                    {CLEFS.map((c) => (
                      <option key={c} value={c}>
                        {c[0].toUpperCase() + c.slice(1)} clef
                      </option>
                    ))}
                  </select>
                ))}
              </div>
              <div className="part-actions">
                <button type="button" className="icon-button" disabled={i === 0} onClick={() => moveInstrument(i, -1)} aria-label={`Move ${part.name} up`}>
                  <ChevronUpIcon />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={i === parts.length - 1}
                  onClick={() => moveInstrument(i, 1)}
                  aria-label={`Move ${part.name} down`}
                >
                  <ChevronDownIcon />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  disabled={parts.length === 1}
                  onClick={() => {
                    if (confirm(`Remove ${part.name || 'this part'} and all of its notes?`)) removeInstrument(i);
                  }}
                  aria-label={`Remove ${part.name}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ol>
        <div className="add-part">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Instrument to add">
            {families.map((family) => (
              <optgroup key={family} label={FAMILY_NAMES[family]}>
                {INSTRUMENTS.filter((i) => i.family === family).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="primary-button" onClick={() => addInstrument(choice)}>
            <PlusIcon /> Add
          </button>
        </div>
        <p className="drawer-note">
          Instruments are written at concert pitch. Each part plays with a built-in synthesized sound, so playback works
          offline.
        </p>
      </aside>
    </div>
  );
}
