/**
 * MusicXML 4.0 (partwise) export. Each staff is written as its own voice;
 * multi-staff parts use <backup> to return to the start of the measure.
 */
import { durationTicks, measureTicks, TICKS_PER_QUARTER } from '../../model/duration';
import { getInstrument } from '../../model/instruments';
import { samePitch } from '../../model/pitch';
import type { ClefType, DurationType, MusicEvent, Pitch, Score } from '../../model/types';

const TYPE_NAMES: Record<DurationType, string> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': '16th',
  '32': '32nd',
};

const CLEF_SIGNS: Record<ClefType, { sign: string; line: number }> = {
  treble: { sign: 'G', line: 2 },
  bass: { sign: 'F', line: 4 },
  alto: { sign: 'C', line: 3 },
  tenor: { sign: 'C', line: 4 },
};

export function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function hasPitch(e: MusicEvent | undefined, p: Pitch): boolean {
  return e?.kind === 'note' && e.pitches.some((q) => samePitch(p, q));
}

export function exportMusicXML(score: Score, software = 'Clefhanger'): string {
  const cap = measureTicks(score.timeSignature);
  // Smallest unit that expresses every duration as a whole number.
  let unit = gcd(TICKS_PER_QUARTER, cap);
  for (const part of score.parts) {
    for (const staff of part.staves) {
      for (const m of staff.measures) for (const e of m.events) unit = gcd(unit, durationTicks(e.duration));
    }
  }
  const divisions = TICKS_PER_QUARTER / unit;
  const dur = (ticks: number) => ticks / unit;

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  out.push(
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
  );
  out.push('<score-partwise version="4.0">');
  out.push(`  <work><work-title>${escapeXml(score.title)}</work-title></work>`);
  out.push('  <identification>');
  if (score.composer) out.push(`    <creator type="composer">${escapeXml(score.composer)}</creator>`);
  out.push(`    <encoding><software>${escapeXml(software)}</software>`);
  out.push(`      <encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding>`);
  out.push('  </identification>');

  out.push('  <part-list>');
  score.parts.forEach((part, i) => {
    const id = `P${i + 1}`;
    const channel = i >= 9 ? i + 2 : i + 1; // Skip channel 10 (percussion).
    out.push(`    <score-part id="${id}">`);
    out.push(`      <part-name>${escapeXml(part.name)}</part-name>`);
    if (part.abbreviation) out.push(`      <part-abbreviation>${escapeXml(part.abbreviation)}</part-abbreviation>`);
    out.push(`      <score-instrument id="${id}-I1"><instrument-name>${escapeXml(part.name)}</instrument-name></score-instrument>`);
    out.push(
      `      <midi-instrument id="${id}-I1"><midi-channel>${Math.min(16, channel)}</midi-channel><midi-program>${getInstrument(part.instrument).midiProgram + 1}</midi-program></midi-instrument>`,
    );
    out.push('    </score-part>');
  });
  out.push('  </part-list>');

  score.parts.forEach((part, pi) => {
    out.push(`  <part id="P${pi + 1}">`);
    // Flatten each staff once so ties can look across barlines.
    const flat = part.staves.map((staff) => staff.measures.flatMap((m) => m.events));
    const offsets = part.staves.map(() => 0);
    const measures = part.staves[0].measures.length;
    for (let m = 0; m < measures; m++) {
      out.push(`    <measure number="${m + 1}">`);
      if (m === 0) {
        out.push('      <attributes>');
        out.push(`        <divisions>${divisions}</divisions>`);
        out.push(`        <key><fifths>${score.keySignature.fifths}</fifths></key>`);
        out.push(
          `        <time><beats>${score.timeSignature.beats}</beats><beat-type>${score.timeSignature.beatType}</beat-type></time>`,
        );
        if (part.staves.length > 1) out.push(`        <staves>${part.staves.length}</staves>`);
        part.staves.forEach((staff, si) => {
          const c = CLEF_SIGNS[staff.clef];
          const num = part.staves.length > 1 ? ` number="${si + 1}"` : '';
          out.push(`        <clef${num}><sign>${c.sign}</sign><line>${c.line}</line></clef>`);
        });
        out.push('      </attributes>');
        if (pi === 0) {
          out.push('      <direction placement="above">');
          out.push(
            `        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome></direction-type>`,
          );
          out.push(`        <sound tempo="${score.tempo}"/>`);
          out.push('      </direction>');
        }
      }
      part.staves.forEach((staff, si) => {
        if (si > 0) out.push(`      <backup><duration>${dur(cap)}</duration></backup>`);
        const events = staff.measures[m].events;
        const voice = si * 4 + 1;
        const staffTag = part.staves.length > 1 ? `<staff>${si + 1}</staff>` : '';
        events.forEach((e) => {
          const index = offsets[si]++;
          const prev = flat[si][index - 1];
          const next = flat[si][index + 1];
          const len = dur(durationTicks(e.duration));
          if (e.kind === 'rest') {
            const whole = events.length === 1;
            out.push('      <note>');
            out.push(whole ? '        <rest measure="yes"/>' : '        <rest/>');
            out.push(`        <duration>${len}</duration><voice>${voice}</voice>`);
            if (!whole) out.push(`        <type>${TYPE_NAMES[e.duration.type]}</type>${'<dot/>'.repeat(e.duration.dots)}`);
            if (staffTag) out.push(`        ${staffTag}`);
            out.push('      </note>');
            return;
          }
          e.pitches.forEach((p, k) => {
            const stop = prev?.kind === 'note' && !!prev.tie && hasPitch(prev, p);
            const start = !!e.tie && hasPitch(next, p);
            out.push('      <note>');
            if (k > 0) out.push('        <chord/>');
            const alter = p.alter !== 0 ? `<alter>${p.alter}</alter>` : '';
            out.push(`        <pitch><step>${p.step}</step>${alter}<octave>${p.octave}</octave></pitch>`);
            out.push(`        <duration>${len}</duration>`);
            if (stop) out.push('        <tie type="stop"/>');
            if (start) out.push('        <tie type="start"/>');
            out.push(`        <voice>${voice}</voice>`);
            out.push(`        <type>${TYPE_NAMES[e.duration.type]}</type>${'<dot/>'.repeat(e.duration.dots)}`);
            if (staffTag) out.push(`        ${staffTag}`);
            if (stop || start) {
              const tied = [stop ? '<tied type="stop"/>' : '', start ? '<tied type="start"/>' : ''].join('');
              out.push(`        <notations>${tied}</notations>`);
            }
            out.push('      </note>');
          });
        });
      });
      if (m === measures - 1) {
        out.push('      <barline location="right"><bar-style>light-heavy</bar-style></barline>');
      }
      out.push('    </measure>');
    }
    out.push('  </part>');
  });
  out.push('</score-partwise>');
  return out.join('\n') + '\n';
}
