import { pitchToMidi } from './pitch';
import { capacity, eventTicks, measureCount } from './score';
import type { Score } from './types';

/** A sounding note with ties already merged. Times are absolute ticks. */
export interface TimelineNote {
  part: number;
  staff: number;
  midi: number;
  startTick: number;
  durationTicks: number;
}

/** When each notated event starts, for cursors and playback highlighting. */
export interface TimelineEvent {
  tick: number;
  id: string;
  part: number;
  staff: number;
  measure: number;
  event: number;
}

export interface Timeline {
  notes: TimelineNote[];
  events: TimelineEvent[];
  totalTicks: number;
}

/**
 * Flatten a score into absolutely timed notes. A tie extends the sounding
 * note instead of re-attacking it, as long as the next event shares the pitch.
 */
export function buildTimeline(score: Score): Timeline {
  const notes: TimelineNote[] = [];
  const events: TimelineEvent[] = [];
  const cap = capacity(score);

  score.parts.forEach((part, p) => {
    part.staves.forEach((staff, s) => {
      let open = new Map<number, TimelineNote>();
      staff.measures.forEach((measure, m) => {
        let tick = m * cap;
        measure.events.forEach((e, i) => {
          const len = eventTicks(e);
          events.push({ tick, id: e.id, part: p, staff: s, measure: m, event: i });
          const stillOpen = new Map<number, TimelineNote>();
          if (e.kind === 'note') {
            for (const pitch of e.pitches) {
              const midi = pitchToMidi(pitch);
              let note = open.get(midi);
              if (note) {
                note.durationTicks += len;
              } else {
                note = { part: p, staff: s, midi, startTick: tick, durationTicks: len };
                notes.push(note);
              }
              if (e.tie) stillOpen.set(midi, note);
            }
          }
          open = stillOpen;
          tick += len;
        });
      });
    });
  });

  notes.sort((a, b) => a.startTick - b.startTick || a.part - b.part || a.midi - b.midi);
  events.sort((a, b) => a.tick - b.tick);
  return { notes, events, totalTicks: measureCount(score) * cap };
}
