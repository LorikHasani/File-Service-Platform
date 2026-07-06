import type { BusinessHours } from '@/types/database';

export interface NextOpening {
  dayOfWeek: number;
  minutes: number;
  /** 0 = later today, 1 = tomorrow, … */
  daysAhead: number;
}

export interface OpenStatus {
  open: boolean;
  /** When the portal opens next; null while open or if every day is closed. */
  nextOpening: NextOpening | null;
}

// Times are evaluated in the visitor's local time, matching the sidebar
// "Working Hours" widget.
export function getOpenStatus(hours: BusinessHours[], now: Date = new Date()): OpenStatus {
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));
  const today = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayRow = byDay.get(today);
  const open =
    !!todayRow &&
    !todayRow.is_closed &&
    nowMinutes >= todayRow.open_minutes &&
    nowMinutes < todayRow.close_minutes;

  let nextOpening: NextOpening | null = null;
  if (!open) {
    // daysAhead 7 covers "reopens next week on this same weekday".
    for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
      const dow = (today + daysAhead) % 7;
      const row = byDay.get(dow);
      if (!row || row.is_closed) continue;
      if (daysAhead === 0 && nowMinutes >= row.open_minutes) continue; // today's opening already passed
      nextOpening = { dayOfWeek: dow, minutes: row.open_minutes, daysAhead };
      break;
    }
  }

  return { open, nextOpening };
}
