/**
 * Time helpers. All dates stored as ISO timestamptz; rendered in
 * Africa/Lusaka (UTC+2, no DST).
 */

export const LUSAKA_TZ = 'Africa/Lusaka';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: LUSAKA_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DATETIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: LUSAKA_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const ISO_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: LUSAKA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function nowLusaka(): Date {
  return new Date();
}

export function formatLusakaDate(iso: string | Date): string {
  return DATE_FMT.format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function formatLusakaDateTime(iso: string | Date): string {
  return `${DATETIME_FMT.format(typeof iso === 'string' ? new Date(iso) : iso)} CAT`;
}

/** Return the YYYY-MM-DD ISO date string for a given moment in Lusaka time. */
export function toLusakaIsoDate(iso: string | Date): string {
  return ISO_DATE_FMT.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/**
 * Add a number of calendar months to a YYYY-MM-DD string and align to
 * `dayOfMonth` (clamped to the last day of the target month).
 */
export function addMonthsAligned(isoDate: string, months: number, dayOfMonth: number): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) {
    throw new RangeError(`addMonthsAligned: expected YYYY-MM-DD, got ${isoDate}`);
  }
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    throw new RangeError(`addMonthsAligned: invalid date ${isoDate}`);
  }
  const total = m - 1 + months;
  const newYear = y + Math.floor(total / 12);
  const newMonth = ((total % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(Math.max(1, dayOfMonth), daysInMonth);
  return `${newYear.toString().padStart(4, '0')}-${(newMonth + 1)
    .toString()
    .padStart(2, '0')}-${clampedDay.toString().padStart(2, '0')}`;
}
