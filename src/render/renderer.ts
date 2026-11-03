/**
 * Draws a Score with VexFlow and returns a hit map so the UI can turn clicks
 * into model locations. The renderer only reads the model; it never edits it.
 *
 * Coordinates in the returned hit map are in "logical" units: the SVG's
 * viewBox space, before the display scale is applied.
 */
import {
  Accidental,
  BarlineType,
  Beam,
  Dot,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  Voice,
  type RenderContext,
} from 'vexflow/bravura';
import { measureTicks } from '../model/duration';
import { keyName, staffPosition } from '../model/pitch';
import { measureCount } from '../model/score';
import type { ClefType, MusicEvent, Pitch, Score, Staff } from '../model/types';

export interface EventHit {
  event: number;
  id: string;
  /** Centre of the notehead. */
  x: number;
}

export interface MeasureHit {
  measure: number;
  x0: number;
  x1: number;
  events: EventHit[];
}

export interface StaffHit {
  part: number;
  staff: number;
  clef: ClefType;
  /** y of the top staff line. Lines are LINE_SPACING apart. */
  topLineY: number;
  /** Vertical band of the page that belongs to this staff for clicks. */
  bandTop: number;
  bandBottom: number;
  measures: MeasureHit[];
}

export interface SystemHit {
  top: number;
  bottom: number;
  staves: StaffHit[];
}

export interface RenderResult {
  width: number;
  height: number;
  scale: number;
  systems: SystemHit[];
  /** SVG group for each event id, for selection and playback highlighting. */
  elements: Map<string, SVGElement>;
}

export const LINE_SPACING = 10;
const STAFF_SPAN = LINE_SPACING * 4;
const PAGE_PAD_X = 14;
const PAGE_PAD_TOP = 34;
const PAGE_PAD_BOTTOM = 40;
const SYSTEM_GAP = 34;
const STAFF_GAP_IN_PART = 46;
const STAFF_GAP_BETWEEN_PARTS = 58;
const MIN_MEASURE_WIDTH = 72;
const LABEL_FONT = '13px Inter, system-ui, sans-serif';

const STAVE_OPTIONS = { spaceAboveStaffLn: 4, spaceBelowStaffLn: 4 };
/** VexFlow places the top line this far below a stave's y. */
const STAVE_TOP_OFFSET = STAVE_OPTIONS.spaceAboveStaffLn * LINE_SPACING;

// ---------------------------------------------------------------------------
// Building VexFlow notes from model events
// ---------------------------------------------------------------------------

function vfKey(p: Pitch): string {
  const acc = p.alter > 0 ? '#'.repeat(p.alter) : 'b'.repeat(-p.alter);
  return `${p.step.toLowerCase()}${acc}/${p.octave}`;
}

const REST_KEY: Record<string, string> = { w: 'd/5', h: 'b/4', q: 'b/4', '8': 'b/4', '16': 'b/4', '32': 'b/4' };

interface BuiltMeasure {
  notes: StaveNote[];
  voice: Voice;
  beams: Beam[];
}

function buildMeasure(score: Score, staff: Staff, measureIndex: number): BuiltMeasure {
  const { beats, beatType } = score.timeSignature;
  const events = staff.measures[measureIndex].events;
  const wholeMeasureRest = events.length === 1 && events[0].kind === 'rest';
  const notes = events.map((e: MusicEvent) => {
    let note: StaveNote;
    if (e.kind === 'rest') {
      note = wholeMeasureRest
        ? new StaveNote({
            keys: ['d/5'],
            duration: 'wr',
            clef: 'treble',
            alignCenter: true,
            durationOverride: new Fraction(beats, beatType),
          })
        : new StaveNote({
            keys: [REST_KEY[e.duration.type]],
            duration: `${e.duration.type}r`,
            dots: e.duration.dots,
            clef: 'treble',
          });
    } else {
      note = new StaveNote({
        keys: e.pitches.map(vfKey),
        duration: e.duration.type,
        dots: e.duration.dots,
        clef: staff.clef,
        autoStem: true,
      });
    }
    if (!(wholeMeasureRest && e.kind === 'rest')) {
      for (let i = 0; i < e.duration.dots; i++) Dot.buildAndAttach([note], { all: true });
    }
    return note;
  });
  const voice = new Voice({ numBeats: beats, beatValue: beatType }).setMode(Voice.Mode.SOFT).addTickables(notes);
  Accidental.applyAccidentals([voice], keyName(score.keySignature.fifths));
  const beams = Beam.generateBeams(notes, { groups: Beam.getDefaultBeamGroups(`${beats}/${beatType}`) });
  return { notes, voice, beams };
}

// ---------------------------------------------------------------------------
// Horizontal layout
// ---------------------------------------------------------------------------

let measureCanvas: CanvasRenderingContext2D | null = null;
function textWidth(text: string): number {
  measureCanvas ??= document.createElement('canvas').getContext('2d');
  if (!measureCanvas) return text.length * 7;
  measureCanvas.font = LABEL_FONT;
  return measureCanvas.measureText(text).width;
}

/** Width a measure's notes need, before stretching to fill the line. */
function naturalWidth(score: Score, measureIndex: number): number {
  const staves = score.parts.flatMap((p) => p.staves);
  const built = staves.map((s) => buildMeasure(score, s, measureIndex));
  const formatter = new Formatter();
  for (const b of built) formatter.joinVoices([b.voice]);
  const min = formatter.preCalculateMinTotalWidth(built.map((b) => b.voice));
  const events = Math.max(...staves.map((s) => s.measures[measureIndex].events.length));
  return Math.max(MIN_MEASURE_WIDTH, min * 1.25 + events * 9 + 28);
}

/** Extra width the first measure of a line needs for clef, key and (maybe) time signature. */
function beginModifierWidth(score: Score, clefs: ClefType[], withTime: boolean): number {
  const key = keyName(score.keySignature.fifths);
  const plain = new Stave(0, 0, 400, STAVE_OPTIONS);
  const plainStart = plain.getNoteStartX();
  let widest = 0;
  for (const clef of new Set(clefs)) {
    const stave = new Stave(0, 0, 400, STAVE_OPTIONS).addClef(clef).addKeySignature(key);
    if (withTime) stave.addTimeSignature(`${score.timeSignature.beats}/${score.timeSignature.beatType}`);
    widest = Math.max(widest, stave.getNoteStartX() - plainStart);
  }
  return widest + 6;
}

interface SystemLayout {
  start: number;
  end: number; // exclusive
  left: number;
  widths: number[];
}

function layoutSystems(score: Score, pageWidth: number): SystemLayout[] {
  const count = measureCount(score);
  const clefs = score.parts.flatMap((p) => p.staves.map((s) => s.clef));
  const natural = Array.from({ length: count }, (_, m) => naturalWidth(score, m));
  const firstExtra = beginModifierWidth(score, clefs, true);
  const laterExtra = beginModifierWidth(score, clefs, false);
  const hasBrace = score.parts.some((p) => p.staves.length > 1);
  const labelPad = (labels: string[]) => {
    const w = Math.max(0, ...labels.map(textWidth));
    return PAGE_PAD_X + (w > 0 ? w + 12 : 0) + (hasBrace ? 14 : 0);
  };
  const firstLeft = labelPad(score.parts.map((p) => p.name));
  const laterLeft = labelPad(score.parts.map((p) => p.abbreviation));

  const systems: SystemLayout[] = [];
  let m = 0;
  while (m < count) {
    const first = systems.length === 0;
    const left = first ? firstLeft : laterLeft;
    const extra = first ? firstExtra : laterExtra;
    const available = pageWidth - left - PAGE_PAD_X;
    const start = m;
    let used = extra;
    while (m < count && (m === start || used + natural[m] <= available)) {
      used += natural[m];
      m++;
    }
    const widths = natural.slice(start, m);
    const contentTotal = widths.reduce((a, b) => a + b, 0);
    const isLast = m >= count;
    const fill = (contentTotal + extra) / available;
    const stretch = !isLast || fill > 0.7 ? Math.max(0, (available - extra) / contentTotal) : 1;
    const scaled = widths.map((w) => w * Math.max(stretch, Math.min(1, stretch)));
    scaled[0] += extra;
    systems.push({ start, end: m, left, widths: scaled });
  }
  return systems;
}

// ---------------------------------------------------------------------------
// Vertical layout
// ---------------------------------------------------------------------------

/** Space a staff needs above its top line and below its bottom line, from its notes. */
function staffExtents(staff: Staff, start: number, end: number): { above: number; below: number } {
  let minPos = 0;
  let maxPos = 8;
  for (let m = start; m < end; m++) {
    for (const e of staff.measures[m].events) {
      if (e.kind !== 'note') continue;
      for (const p of e.pitches) {
        const pos = staffPosition(p, staff.clef);
        minPos = Math.min(minPos, pos);
        maxPos = Math.max(maxPos, pos);
      }
    }
  }
  // Half a line spacing per staff position, plus room for stems and flags.
  const above = Math.max(0, -minPos) * (LINE_SPACING / 2) + 18;
  const below = Math.max(0, maxPos - 8) * (LINE_SPACING / 2) + 18;
  return { above, below };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderOptions {
  /** Available CSS pixel width. */
  width: number;
  /** Display scale (smaller on phones). */
  scale: number;
}

export function renderScore(container: HTMLElement, score: Score, options: RenderOptions): RenderResult {
  const scale = options.scale;
  const pageWidth = Math.max(280, options.width / scale);
  const systems = layoutSystems(score, pageWidth);
  const count = measureCount(score);
  const staves = score.parts.flatMap((part, p) => part.staves.map((staff, s) => ({ part: p, staff: s, data: staff })));

  // Vertical positions of every staff in every system.
  let y = PAGE_PAD_TOP;
  const tops: number[][] = [];
  const systemBounds: { top: number; bottom: number }[] = [];
  for (const sys of systems) {
    const extents = staves.map((st) => staffExtents(st.data, sys.start, sys.end));
    const systemTop = y;
    const rowTops: number[] = [];
    let topLine = systemTop + extents[0].above;
    staves.forEach((st, i) => {
      if (i > 0) {
        const samePart = st.part === staves[i - 1].part;
        const gap = Math.max(samePart ? STAFF_GAP_IN_PART : STAFF_GAP_BETWEEN_PARTS, extents[i - 1].below + extents[i].above);
        topLine = rowTops[i - 1] + STAFF_SPAN + gap;
      }
      rowTops.push(topLine);
    });
    const bottom = rowTops[rowTops.length - 1] + STAFF_SPAN + extents[extents.length - 1].below;
    tops.push(rowTops);
    systemBounds.push({ top: systemTop, bottom });
    y = bottom + SYSTEM_GAP;
  }
  const height = y - SYSTEM_GAP + PAGE_PAD_BOTTOM;

  container.innerHTML = '';
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(pageWidth, height);
  const ctx = renderer.getContext();
  const keySpec = keyName(score.keySignature.fifths);
  const timeSpec = `${score.timeSignature.beats}/${score.timeSignature.beatType}`;

  const elements = new Map<string, SVGElement>();
  const hitSystems: SystemHit[] = [];
  // Notes of the previous system, so ties can continue across a line break.
  const builtNotes = new Map<string, StaveNote>();

  systems.forEach((sys, si) => {
    const rowTops = tops[si];
    const hitStaves: StaffHit[] = staves.map((st, i) => ({
      part: st.part,
      staff: st.staff,
      clef: st.data.clef,
      topLineY: rowTops[i],
      bandTop: i === 0 ? systemBounds[si].top - SYSTEM_GAP / 2 : (rowTops[i - 1] + STAFF_SPAN + rowTops[i]) / 2,
      bandBottom:
        i === staves.length - 1
          ? systemBounds[si].bottom + SYSTEM_GAP / 2
          : (rowTops[i] + STAFF_SPAN + rowTops[i + 1]) / 2,
      measures: [],
    }));

    const firstColumn: Stave[] = [];
    let x = sys.left;
    for (let m = sys.start; m < sys.end; m++) {
      const width = sys.widths[m - sys.start];
      const isFirst = m === sys.start;
      const column = staves.map((st, i) => {
        const stave = new Stave(x, rowTops[i] - STAVE_TOP_OFFSET, width, STAVE_OPTIONS);
        if (isFirst) {
          stave.addClef(st.data.clef).addKeySignature(keySpec);
          if (m === 0) stave.addTimeSignature(timeSpec);
          if (si > 0 && i === 0) stave.setMeasure(m + 1);
        }
        if (m === 0 && i === 0) stave.setTempo({ duration: 'q', bpm: score.tempo }, -8);
        if (m === count - 1) stave.setEndBarType(BarlineType.END);
        return stave;
      });
      // Line up the first note across staves with different clef widths.
      const noteStart = Math.max(...column.map((s) => s.getNoteStartX()));
      column.forEach((s) => s.setNoteStartX(noteStart));
      column.forEach((s) => s.setContext(ctx).draw());
      if (isFirst) firstColumn.push(...column);

      const built = staves.map((st) => buildMeasure(score, st.data, m));
      const formatter = new Formatter();
      built.forEach((b, i) => {
        b.voice.setStave(column[i]);
        formatter.joinVoices([b.voice]);
      });
      const justify = Math.min(...column.map((s) => s.getNoteEndX() - s.getNoteStartX())) - 14;
      formatter.format(
        built.map((b) => b.voice),
        Math.max(20, justify),
      );
      built.forEach((b, i) => {
        b.voice.draw(ctx, column[i]);
        b.beams.forEach((beam) => beam.setContext(ctx).draw());
        const staffData = staves[i].data;
        const events: EventHit[] = staffData.measures[m].events.map((e, ei) => {
          const note = b.notes[ei];
          builtNotes.set(e.id, note);
          const el = note.getSVGElement();
          if (el) elements.set(e.id, el);
          return { event: ei, id: e.id, x: note.getAbsoluteX() + note.getGlyphWidth() / 2 };
        });
        hitStaves[i].measures.push({ measure: m, x0: x, x1: x + width, events });
      });

      // Barlines through every staff of a multi-staff part.
      let first = 0;
      score.parts.forEach((part) => {
        const last = first + part.staves.length - 1;
        if (last > first) {
          new StaveConnector(column[first], column[last])
            .setType(m === count - 1 ? 'boldDoubleRight' : 'singleRight')
            .setContext(ctx)
            .draw();
        }
        first = last + 1;
      });
      x += width;
    }

    // System bracket line, braces and instrument names.
    if (firstColumn.length > 1) {
      new StaveConnector(firstColumn[0], firstColumn[firstColumn.length - 1]).setType('singleLeft').setContext(ctx).draw();
    }
    let first = 0;
    score.parts.forEach((part) => {
      const last = first + part.staves.length - 1;
      if (last > first) {
        new StaveConnector(firstColumn[first], firstColumn[last]).setType('brace').setContext(ctx).draw();
      }
      const label = si === 0 ? part.name : part.abbreviation;
      if (label) {
        const mid = (rowTops[first] + rowTops[last] + STAFF_SPAN) / 2;
        const right = sys.left - (last > first ? 18 : 8);
        drawLabel(ctx, label, right, mid + 4);
      }
      first = last + 1;
    });

    drawTies(ctx, score, sys, builtNotes);
    hitSystems.push({ ...systemBounds[si], staves: hitStaves });
  });

  const svg = container.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${pageWidth} ${height}`);
    svg.setAttribute('width', String(pageWidth * scale));
    svg.setAttribute('height', String(height * scale));
    svg.style.width = `${pageWidth * scale}px`;
    svg.style.height = `${height * scale}px`;
  }
  return { width: pageWidth, height, scale, systems: hitSystems, elements };
}

function drawLabel(ctx: RenderContext, text: string, right: number, baseline: number): void {
  ctx.save();
  ctx.setFont('Inter, system-ui, sans-serif', 13);
  const w = ctx.measureText(text).width;
  ctx.fillText(text, right - w, baseline);
  ctx.restore();
}

/**
 * Draw ties for every tied note that starts in this system. A tie whose
 * second note is on the next line is drawn as two halves.
 */
function drawTies(ctx: RenderContext, score: Score, sys: SystemLayout, built: Map<string, StaveNote>): void {
  for (const part of score.parts) {
    for (const staff of part.staves) {
      const flat: { e: MusicEvent; m: number }[] = [];
      for (let m = Math.max(0, sys.start - 1); m < Math.min(sys.end + 1, staff.measures.length); m++) {
        for (const e of staff.measures[m].events) flat.push({ e, m });
      }
      for (let i = 0; i < flat.length - 1; i++) {
        const { e, m } = flat[i];
        const next = flat[i + 1];
        if (e.kind !== 'note' || !e.tie || next.e.kind !== 'note') continue;
        const nextPitches = next.e.pitches;
        const firstIdx: number[] = [];
        const lastIdx: number[] = [];
        e.pitches.forEach((p, pi) => {
          const j = nextPitches.findIndex((q) => q.step === p.step && q.octave === p.octave && q.alter === p.alter);
          if (j >= 0) {
            firstIdx.push(pi);
            lastIdx.push(j);
          }
        });
        if (firstIdx.length === 0) continue;
        const startsHere = m >= sys.start && m < sys.end;
        const endsHere = next.m >= sys.start && next.m < sys.end;
        if (!startsHere && !endsHere) continue;
        const firstNote = startsHere ? built.get(e.id) : undefined;
        const lastNote = endsHere ? built.get(next.e.id) : undefined;
        if (!firstNote && !lastNote) continue;
        new StaveTie({ firstNote, lastNote, firstIndexes: firstIdx, lastIndexes: lastIdx }).setContext(ctx).draw();
      }
    }
  }
}

/** Ticks per measure, re-exported for convenience in the UI layer. */
export function measureLength(score: Score): number {
  return measureTicks(score.timeSignature);
}
