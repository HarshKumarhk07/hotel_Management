import type { IAvailabilityWindow } from '@/models';

/**
 * Returns the current weekday (0=Sun..6=Sat) and minutes-since-midnight in a
 * given IANA timezone, using Intl so we don't need a date library. Falls back to
 * the host timezone if the provided one is invalid.
 */
export function nowInZone(timezone: string, now: Date = new Date()): { day: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  }

  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { day: map[weekday] ?? 0, minutes: hour * 60 + minute };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Is `current` (minutes) inside [start, end)? Handles windows crossing midnight. */
function inWindow(currentMinutes: number, start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s <= e) return currentMinutes >= s && currentMinutes < e;
  // Overnight window, e.g. 22:00–02:00.
  return currentMinutes >= s || currentMinutes < e;
}

/**
 * Determine whether a scheduled item is available right now. An unscheduled item
 * is always available. A scheduled item is available if the current time (in its
 * timezone) falls inside at least one window whose day list includes today
 * (empty/absent day list = every day).
 */
export function isAvailableNow(
  availability: { scheduled: boolean; timezone: string; windows: IAvailabilityWindow[] },
  now: Date = new Date(),
): boolean {
  if (!availability.scheduled || availability.windows.length === 0) return true;
  const { day, minutes } = nowInZone(availability.timezone, now);
  return availability.windows.some((w) => {
    const dayOk = !w.days || w.days.length === 0 || w.days.includes(day);
    return dayOk && inWindow(minutes, w.start, w.end);
  });
}

/**
 * Determine whether a kitchen is open and accepting orders right now.
 * Respects isActive, temporarilyClosed, weeklySchedule, holiday overrides, and daily timings.
 */
export function isKitchenAvailableNow(
  kitchen: {
    isActive: boolean;
    temporarilyClosed?: boolean;
    timings?: { open: string; close: string; timezone: string };
    weeklySchedule?: number[];
    holidayTimings?: { date: string; open?: string; close?: string; closed: boolean }[];
  },
  now: Date = new Date(),
): boolean {
  if (!kitchen.isActive || kitchen.temporarilyClosed) return false;
  if (!kitchen.timings || !kitchen.timings.open || !kitchen.timings.close) return true;

  const { day, minutes } = nowInZone(kitchen.timings.timezone, now);

  // Check weekly schedule (0=Sun..6=Sat)
  if (kitchen.weeklySchedule && kitchen.weeklySchedule.length > 0) {
    if (!kitchen.weeklySchedule.includes(day)) return false;
  }

  // Check holiday overrides
  if (kitchen.holidayTimings && kitchen.holidayTimings.length > 0) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: kitchen.timings.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const dayStr = parts.find((p) => p.type === 'day')?.value;
    const todayStr = `${year}-${month}-${dayStr}`;

    const holiday = kitchen.holidayTimings.find((h) => h.date === todayStr);
    if (holiday) {
      if (holiday.closed) return false;
      if (holiday.open && holiday.close) {
        return inWindow(minutes, holiday.open, holiday.close);
      }
    }
  }

  // Check regular timings
  return inWindow(minutes, kitchen.timings.open, kitchen.timings.close);
}

