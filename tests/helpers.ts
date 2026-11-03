import { parseEvents } from '../src/model/notation';
import { pitchLabel } from '../src/model/pitch';
import type { Duration, MusicEvent, Score } from '../src/model/types';

/** Compact, id-free description of events, for readable assertions. */
export function describe(events: MusicEvent[]): string {
  return events
    .map((e) => {
      const d = durText(e.duration);
      if (e.kind === 'rest') return `r:${d}`;
      return `${e.pitches.map(pitchLabel).join('+')}:${d}${e.tie ? '~' : ''}`;
    })
    .join(' ');
}

function durText(d: Duration): string {
  return d.type + '.'.repeat(d.dots);
}

export function staffText(score: Score, part = 0, staff = 0): string[] {
  return score.parts[part].staves[staff].measures.map((m) => describe(m.events));
}

/** Set one measure's events from shorthand (test convenience; mutates a fresh score). */
export function fill(score: Score, part: number, staff: number, measure: number, text: string): Score {
  const copy: Score = JSON.parse(JSON.stringify(score));
  copy.parts[part].staves[staff].measures[measure].events = parseEvents(text);
  return copy;
}

/** Score without ids, for structural comparisons across serialisation. */
export function withoutIds(score: Score): unknown {
  return JSON.parse(JSON.stringify(score), (key, value) => (key === 'id' ? undefined : value));
}
