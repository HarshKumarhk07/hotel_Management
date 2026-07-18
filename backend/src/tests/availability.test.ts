import { isAvailableNow, nowInZone } from '@/utils/availability';

/** Build a UTC Date for a given wall-clock; tests pin the timezone to UTC. */
function utc(hour: number, minute = 0, weekdayOffsetFromSunday = 0): Date {
  // 2024-01-07 was a Sunday. Add offset days to land on a specific weekday.
  const day = 7 + weekdayOffsetFromSunday;
  return new Date(Date.UTC(2024, 0, day, hour, minute, 0));
}

describe('availability — nowInZone', () => {
  it('reports weekday and minutes in UTC', () => {
    const { day, minutes } = nowInZone('UTC', utc(9, 30, 1)); // Monday 09:30
    expect(day).toBe(1);
    expect(minutes).toBe(9 * 60 + 30);
  });
});

describe('availability — isAvailableNow', () => {
  const tz = 'UTC';

  it('is always available when not scheduled', () => {
    expect(isAvailableNow({ scheduled: false, timezone: tz, windows: [] }, utc(3))).toBe(true);
  });

  it('is available inside a breakfast window', () => {
    const breakfast = { scheduled: true, timezone: tz, windows: [{ start: '07:00', end: '11:00' }] };
    expect(isAvailableNow(breakfast, utc(8))).toBe(true);
    expect(isAvailableNow(breakfast, utc(11))).toBe(false); // end is exclusive
    expect(isAvailableNow(breakfast, utc(6, 59))).toBe(false);
  });

  it('respects a weekday whitelist', () => {
    const weekdayLunch = {
      scheduled: true,
      timezone: tz,
      windows: [{ days: [1, 2, 3, 4, 5], start: '12:00', end: '15:00' }],
    };
    expect(isAvailableNow(weekdayLunch, utc(13, 0, 1))).toBe(true); // Monday
    expect(isAvailableNow(weekdayLunch, utc(13, 0, 0))).toBe(false); // Sunday
  });

  it('handles windows that cross midnight', () => {
    const lateNight = { scheduled: true, timezone: tz, windows: [{ start: '22:00', end: '02:00' }] };
    expect(isAvailableNow(lateNight, utc(23))).toBe(true);
    expect(isAvailableNow(lateNight, utc(1))).toBe(true);
    expect(isAvailableNow(lateNight, utc(3))).toBe(false);
  });
});
