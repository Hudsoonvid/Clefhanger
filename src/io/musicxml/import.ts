/**
 * MusicXML (partwise) import.
 *
 * Clefhanger's model has one voice per staff, so for each staff the first
 * voice found is imported and other voices are skipped. Tuplets, grace notes,
 * mid-score key, time and clef changes are not supported yet; measures are
 * padded or trimmed so the result always satisfies the model invariants.
 */
import { beatTicks, durationFromTicks, measureTicks, TICKS_PER_QUARTER } from '../../model/duration';
import { newId } from '../../model/ids';
import { guessInstrument } from '../../model/instruments';
import { createEmptyMeasure, fitEvents, makeRest, normalizeScore } from '../../model/score';
import type {
  ClefType,
  Duration,
  DurationType,
  Measure,
  MusicEvent,
  NoteEvent,
  Part,
  Score,
  Staff,
  Step,
  TimeSignature,
} from '../../model/types';

export class MusicXMLError extends Error {}

const TYPES: Record<string, DurationType> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  '16th': '16',
  '32nd': '32',
};

function child(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.localName === name) return c;
  return null;
}

function children(el: Element | null | undefined, name: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter((c) => c.localName === name);
}

function text(el: Element | null | undefined, name: string): string | null {
  const c = child(el, name);
  return c?.textContent?.trim() ?? null;
}

function num(el: Element | null | undefined, name: string): number | null {
  const t = text(el, name);
  if (t === null || t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clefFrom(el: Element): ClefType {
  const sign = text(el, 'sign')?.toUpperCase();
  const line = num(el, 'line');
  if (sign === 'F') return 'bass';
  if (sign === 'C') return line === 4 ? 'tenor' : 'alto';
  return 'treble';
}

interface PartInfo {
  id: string;
  name: string;
  abbreviation: string;
  program: number | null;
}

interface StaffBuild {
  clef: ClefType;
  /** The single voice imported for this staff. */
  voice: string | null;
  measures: MusicEvent[][];
}

export function importMusicXML(xml: string): Score {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new MusicXMLError('This file is not well-formed XML.');
  }
  const root = doc.documentElement;
  if (root.localName === 'score-timewise') {
    throw new MusicXMLError('Timewise MusicXML is not supported yet. Please export as partwise.');
  }
  if (root.localName !== 'score-partwise') {
    throw new MusicXMLError('This does not look like a MusicXML score.');
  }

  const title = text(child(root, 'work'), 'work-title') ?? text(root, 'movement-title') ?? 'Imported score';
  const identification = child(root, 'identification');
  const composer =
    children(identification, 'creator')
      .find((c) => c.getAttribute('type') === 'composer')
      ?.textContent?.trim() ?? '';

  const infos = new Map<string, PartInfo>();
  for (const sp of children(child(root, 'part-list'), 'score-part')) {
    const id = sp.getAttribute('id') ?? '';
    const program = num(child(sp, 'midi-instrument'), 'midi-program');
    infos.set(id, {
      id,
      name: text(sp, 'part-name') ?? '',
      abbreviation: text(sp, 'part-abbreviation') ?? '',
      program: program !== null ? program - 1 : null,
    });
  }

  let timeSignature: TimeSignature | null = null;
  let fifths: number | null = null;
  let tempo: number | null = null;

  const parts: Part[] = [];
  for (const partEl of children(root, 'part')) {
    const info = infos.get(partEl.getAttribute('id') ?? '') ?? { id: '', name: '', abbreviation: '', program: null };
    let divisions = 1;
    let staffCount = 1;
    const staves: StaffBuild[] = [{ clef: 'treble', voice: null, measures: [] }];
    const ensureStaves = (n: number) => {
      while (staves.length < n) staves.push({ clef: staves.length === 1 ? 'bass' : 'treble', voice: null, measures: [] });
    };

    children(partEl, 'measure').forEach((measureEl, mi) => {
      const current: MusicEvent[][] = staves.map(() => []);
      const meter = () => timeSignature ?? { beats: 4, beatType: 4 };
      const cap = () => measureTicks(meter());
      const lastNote: (NoteEvent | null)[] = staves.map(() => null);

      for (const el of Array.from(measureEl.children)) {
        switch (el.localName) {
          case 'attributes': {
            divisions = num(el, 'divisions') ?? divisions;
            const st = num(el, 'staves');
            if (st && st > staffCount) {
              staffCount = st;
              ensureStaves(st);
              while (current.length < st) current.push([]);
              while (lastNote.length < st) lastNote.push(null);
            }
            const key = num(child(el, 'key'), 'fifths');
            if (key !== null && fifths === null) fifths = key;
            const time = child(el, 'time');
            if (time && timeSignature === null) {
              const beats = parseInt(text(time, 'beats') ?? '4', 10);
              const beatType = num(time, 'beat-type') ?? 4;
              if (beats > 0 && [1, 2, 4, 8, 16, 32].includes(beatType)) timeSignature = { beats, beatType };
            }
            if (mi === 0) {
              for (const clefEl of children(el, 'clef')) {
                const n = Number(clefEl.getAttribute('number') ?? '1');
                ensureStaves(n);
                staves[n - 1].clef = clefFrom(clefEl);
              }
            }
            break;
          }
          case 'direction':
          case 'sound': {
            const sound = el.localName === 'sound' ? el : child(el, 'sound');
            const t = sound?.getAttribute('tempo');
            if (tempo === null && t) tempo = Number(t);
            if (tempo === null) {
              const metronome = child(child(el, 'direction-type'), 'metronome');
              const perMinute = num(metronome, 'per-minute');
              if (perMinute && text(metronome, 'beat-unit') === 'quarter') tempo = perMinute;
            }
            break;
          }
          case 'forward': {
            const staffNo = Number(text(el, 'staff') ?? '1');
            const voice = text(el, 'voice');
            const s = staffNo - 1;
            if (!staves[s] || (voice && staves[s].voice && voice !== staves[s].voice)) break;
            const ticks = Math.round(((num(el, 'duration') ?? 0) * TICKS_PER_QUARTER) / divisions);
            const d = durationFromTicks(ticks);
            if (d) current[s].push(makeRest(d));
            break;
          }
          case 'note': {
            if (child(el, 'grace') || child(el, 'cue')) break;
            const s = Number(text(el, 'staff') ?? '1') - 1;
            if (s < 0) break;
            ensureStaves(s + 1);
            while (current.length <= s) current.push([]);
            while (lastNote.length <= s) lastNote.push(null);
            const voice = text(el, 'voice') ?? '1';
            staves[s].voice ??= voice;
            if (voice !== staves[s].voice) break;

            const pitchEl = child(el, 'pitch');
            const isChord = !!child(el, 'chord');
            const tieStart = children(el, 'tie').some((t) => t.getAttribute('type') === 'start');
            if (isChord && pitchEl && lastNote[s]) {
              const prev = lastNote[s]!;
              prev.pitches.push(readPitch(pitchEl));
              if (tieStart) prev.tie = true;
              break;
            }
            const restEl = child(el, 'rest');
            const ticks = Math.round(((num(el, 'duration') ?? 0) * TICKS_PER_QUARTER) / divisions);
            let duration: Duration | null = durationFromTicks(ticks);
            if (!duration) {
              const type = TYPES[text(el, 'type') ?? ''];
              if (type) duration = { type, dots: Math.min(2, children(el, 'dot').length) };
            }
            if (restEl && restEl.getAttribute('measure') === 'yes') {
              current[s].push(...fitEvents([], cap(), beatTicks(meter())));
              lastNote[s] = null;
              break;
            }
            if (!duration) break;
            if (restEl || !pitchEl) {
              current[s].push(makeRest(duration));
              lastNote[s] = null;
            } else {
              const note: NoteEvent = { id: newId(), kind: 'note', pitches: [readPitch(pitchEl)], duration };
              if (tieStart) note.tie = true;
              current[s].push(note);
              lastNote[s] = note;
            }
            break;
          }
        }
      }
      current.forEach((events, s) => {
        ensureStaves(s + 1);
        staves[s].measures[mi] = fitEvents(events, cap(), beatTicks(meter()));
      });
      staves.forEach((st) => {
        st.measures[mi] ??= fitEvents([], cap(), beatTicks(meter()));
      });
    });

    const instrument = guessInstrument(info.name, info.program);
    parts.push({
      id: newId(),
      name: info.name || instrument.name,
      abbreviation: info.abbreviation || (info.name ? '' : instrument.abbreviation),
      instrument: instrument.id,
      staves: staves.map(
        (st): Staff => ({
          id: newId(),
          clef: st.clef,
          measures: Array.from(st.measures, (events): Measure => ({ id: newId(), events: events ?? [] })),
        }),
      ),
    });
  }

  if (parts.length === 0) throw new MusicXMLError('The score has no parts.');
  const ts = timeSignature ?? { beats: 4, beatType: 4 };
  for (const part of parts) {
    for (const staff of part.staves) if (staff.measures.length === 0) staff.measures.push(createEmptyMeasure(ts));
  }
  return normalizeScore({
    id: newId(),
    title,
    composer,
    tempo: tempo ?? 120,
    keySignature: { fifths: fifths ?? 0 },
    timeSignature: ts,
    parts,
  });
}

function readPitch(el: Element) {
  const step = (text(el, 'step') ?? 'C').toUpperCase() as Step;
  return {
    step: ['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(step) ? step : 'C',
    alter: Math.max(-2, Math.min(2, Math.round(num(el, 'alter') ?? 0))),
    octave: Math.max(0, Math.min(9, num(el, 'octave') ?? 4)),
  };
}
