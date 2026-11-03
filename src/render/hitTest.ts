import { pitchAtStaffPosition } from '../model/pitch';
import type { EventLocation, Pitch } from '../model/types';
import { LINE_SPACING, type RenderResult, type StaffHit } from './renderer';

export interface Hit {
  loc: EventLocation;
  pitch: Pitch;
  /** Staff position in half-spaces below the top line. */
  position: number;
  /** Logical x of the event the click snapped to. */
  x: number;
  staff: StaffHit;
}

/** Half-spaces above/below the staff that a click may reach (four ledger lines). */
const MIN_POSITION = -10;
const MAX_POSITION = 18;

/** Map a point in logical (viewBox) coordinates to an event and a pitch. */
export function hitTest(layout: RenderResult, x: number, y: number, fifths: number): Hit | null {
  for (const system of layout.systems) {
    const staff = system.staves.find((s) => y >= s.bandTop && y < s.bandBottom);
    if (!staff || staff.measures.length === 0) continue;
    const measures = staff.measures;
    const measure =
      measures.find((m) => x >= m.x0 && x < m.x1) ?? (x < measures[0].x0 ? measures[0] : measures[measures.length - 1]);
    const events = measure.events;
    let index = 0;
    for (let i = 0; i < events.length - 1; i++) {
      if (x >= (events[i].x + events[i + 1].x) / 2) index = i + 1;
    }
    const position = Math.max(
      MIN_POSITION,
      Math.min(MAX_POSITION, Math.round((y - staff.topLineY) / (LINE_SPACING / 2))),
    );
    return {
      loc: { part: staff.part, staff: staff.staff, measure: measure.measure, event: index },
      pitch: pitchAtStaffPosition(position, staff.clef, fifths),
      position,
      x: events[index].x,
      staff,
    };
  }
  return null;
}

/** Find where an event was drawn. */
export function locate(layout: RenderResult, loc: EventLocation): { staff: StaffHit; x: number } | null {
  for (const system of layout.systems) {
    for (const staff of system.staves) {
      if (staff.part !== loc.part || staff.staff !== loc.staff) continue;
      const measure = staff.measures.find((m) => m.measure === loc.measure);
      const event = measure?.events[loc.event];
      if (event) return { staff, x: event.x };
    }
  }
  return null;
}
