/**
 * PACT Phase 2E — Pure Temporal Engine & Timezone Abstraction Layer
 * Provides deterministic, timezone-aware, server-safe temporal operations.
 */

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class TestClock implements Clock {
  private fixedInstant: Date;

  constructor(instant: Date | string | number) {
    this.fixedInstant = new Date(instant);
  }

  setInstant(instant: Date | string | number): void {
    this.fixedInstant = new Date(instant);
  }

  now(): Date {
    return new Date(this.fixedInstant.getTime());
  }
}

export const defaultClock: Clock = new SystemClock();

/**
 * Validates whether a string is a valid IANA timezone identifier.
 * Uses native Intl.DateTimeFormat to prevent invalid abbreviations like 'IST' or 'PST'.
 */
export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  const trimmed = timeZone.trim();
  // Reject non-canonical abbreviations (e.g. IST, PST, EST) or GMT offset strings that lack slash
  if (
    !trimmed.includes('/') &&
    !['UTC', 'GMT', 'Etc/UTC', 'Etc/GMT'].includes(trimmed)
  ) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export interface LocalToUtcResult {
  utcIso: string | null;
  isNonexistent: boolean;
  isAmbiguous: boolean;
  error: string | null;
}

/**
 * Helper to get the UTC offset in minutes for a given wall-clock date in a specific IANA timezone.
 */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => {
    const val = parts.find((p) => p.type === type)?.value;
    return val ? parseInt(val, 10) : 0;
  };

  const year = getPart('year');
  const month = getPart('month') - 1;
  const day = getPart('day');
  let hour = getPart('hour');
  if (hour === 24) hour = 0;
  const minute = getPart('minute');
  const second = getPart('second');

  const asUtc = Date.UTC(year, month, day, hour, minute, second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * Converts a local wall-clock date/time string in a specific IANA timezone
 * to an absolute UTC ISO 8601 timestamp.
 *
 * Handles DST spring-forward (nonexistent local times) and fall-back
 * (ambiguous local times).
 *
 * @param localDateTimeStr - Local wall-clock date/time in
 * "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss" format.
 * @param timeZone - Valid IANA timezone identifier, such as "Asia/Kolkata"
 * or "America/New_York".
 * @returns A LocalToUtcResult containing the UTC ISO timestamp,
 * DST status flags, and an error message when applicable.
 *
 * @example
 * localToUtc("2026-10-15T18:30", "Asia/Kolkata");
 * // {
 * //   utcIso: "2026-10-15T13:00:00.000Z",
 * //   isNonexistent: false,
 * //   isAmbiguous: false,
 * //   error: null
 * // }
 */
export function localToUtc(localDateTimeStr: string, timeZone: string): LocalToUtcResult {
  if (!isValidIanaTimezone(timeZone)) {
    return { utcIso: null, isNonexistent: false, isAmbiguous: false, error: `Invalid IANA timezone: ${timeZone}` };
  }

  if (!localDateTimeStr || typeof localDateTimeStr !== 'string') {
    return { utcIso: null, isNonexistent: false, isAmbiguous: false, error: 'Invalid local date string provided.' };
  }

  // Parse YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
  const match = localDateTimeStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return { utcIso: null, isNonexistent: false, isAmbiguous: false, error: 'Format must be YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss.' };
  }

  const [, yearStr, monthStr, dayStr, hourStr, minStr, secStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const second = secStr ? parseInt(secStr, 10) : 0;

  // Initial estimate pretending local wall-clock components are UTC
  const targetUtcGuess = Date.UTC(year, month, day, hour, minute, second);
  const approxDate = new Date(targetUtcGuess);

  // Compute offset in timezone for this target date
  const offsetMinutes = getTimezoneOffsetMinutes(approxDate, timeZone);
  const calculatedUtcTime = targetUtcGuess - offsetMinutes * 60000;
  const finalDate = new Date(calculatedUtcTime);

  // Verify reverse conversion matches original wall-clock input
  const reverseOffset = getTimezoneOffsetMinutes(finalDate, timeZone);
  const reverseUtcTime = targetUtcGuess - reverseOffset * 60000;
  const reverseDate = new Date(reverseUtcTime);

  const checkFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Helper function to check if a UTC timestamp formats back to the target wall-clock time
  const formatsToTarget = (utcMs: number) => {
    const p = checkFormatter.formatToParts(new Date(utcMs));
    const g = (t: string) => parseInt(p.find((x) => x.type === t)?.value || '0', 10);
    let h = g('hour');
    if (h === 24) h = 0;
    return (
      g('year') === year &&
      g('month') - 1 === month &&
      g('day') === day &&
      h === hour &&
      g('minute') === minute
    );
  };

  const matchesOriginal = formatsToTarget(reverseUtcTime);

  if (!matchesOriginal) {
    // Nonexistent local time (e.g. DST spring forward gap)
    return {
      utcIso: reverseDate.toISOString(),
      isNonexistent: true,
      isAmbiguous: false,
      error: `Local time ${localDateTimeStr} does not exist in timezone ${timeZone} due to DST spring-forward shift.`,
    };
  }

  // Check for ambiguous time (fall-back overlap) by checking alternative UTC candidate offsets
  const offMinus1h = getTimezoneOffsetMinutes(new Date(reverseUtcTime - 3600000), timeZone);
  const offPlus1h = getTimezoneOffsetMinutes(new Date(reverseUtcTime + 3600000), timeZone);

  const altUtc1 = targetUtcGuess - offMinus1h * 60000;
  const altUtc2 = targetUtcGuess - offPlus1h * 60000;

  const isAmbiguous =
    (altUtc1 !== reverseUtcTime && formatsToTarget(altUtc1)) ||
    (altUtc2 !== reverseUtcTime && formatsToTarget(altUtc2));

  return {
    utcIso: reverseDate.toISOString(),
    isNonexistent: false,
    isAmbiguous: Boolean(isAmbiguous),
    error: null,
  };
}

/**
 * Converts a stored UTC ISO string to a user-local formatted string with timezone context.
 */
export function utcToLocal(
  utcIsoStr: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isValidIanaTimezone(timeZone)) {
    timeZone = 'UTC';
  }

  try {
    const date = new Date(utcIsoStr);
    if (isNaN(date.getTime())) return utcIsoStr;

    const defaultOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
      ...options,
    };

    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  } catch {
    return utcIsoStr;
  }
}

/**
 * Evaluates whether a Task deadline instant has been reached (now >= deadline).
 * Operates purely on absolute temporal comparison (Date milliseconds).
 */
export function isDeadlineReached(deadlineAt: Date | string, clock: Clock = defaultClock): boolean {
  const deadlineTime = new Date(deadlineAt).getTime();
  const nowTime = clock.now().getTime();
  if (isNaN(deadlineTime)) return false;
  return nowTime >= deadlineTime;
}

/**
 * Compares two temporal instants.
 * Returns negative if instantA < instantB, 0 if equal, positive if instantA > instantB.
 */
export function compareInstants(instantA: Date | string, instantB: Date | string): number {
  const timeA = new Date(instantA).getTime();
  const timeB = new Date(instantB).getTime();
  return timeA - timeB;
}

/**
 * Returns temporal deadline state ('FUTURE' or 'EXPIRED').
 */
export function getDeadlineStatus(deadlineAt: Date | string, clock: Clock = defaultClock): 'FUTURE' | 'EXPIRED' {
  return isDeadlineReached(deadlineAt, clock) ? 'EXPIRED' : 'FUTURE';
}

/**
 * Converts a stored UTC ISO 8601 timestamp to a wall-clock
 * "YYYY-MM-DDTHH:mm" string formatted for an
 * <input type="datetime-local"> in a specific IANA timezone.
 *
 * @param utcIsoStr - UTC ISO 8601 timestamp to convert.
 * @param timeZone - IANA timezone identifier, such as "Asia/Kolkata" or "America/New_York".
 * @returns A local datetime string in "YYYY-MM-DDTHH:mm" format,
 * or an empty string when the UTC timestamp is invalid.
 *
 * @example
 * utcToDatetimeLocalInput("2026-10-15T13:00:00.000Z", "Asia/Kolkata");
 * // Returns: "2026-10-15T18:30"
 */
export function utcToDatetimeLocalInput(utcIsoStr: string, timeZone: string): string {
  if (!isValidIanaTimezone(timeZone)) {
    timeZone = 'UTC';
  }
  const date = new Date(utcIsoStr);
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  let hour = getPart('hour');
  if (hour === '24') hour = '00';
  const minute = getPart('minute');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Gets the default wall-clock deadline string ("YYYY-MM-DDTHH:mm") for tomorrow at 23:59
 * in a specific IANA timezone.
 */
export function getDefaultLocalDeadline(timeZone: string, clock: Clock = defaultClock): string {
  if (!isValidIanaTimezone(timeZone)) {
    timeZone = 'UTC';
  }
  const now = clock.now();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const getPart = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  // Advance by 1 calendar day
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const y = tomorrow.getUTCFullYear();
  const m = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T23:59`;
}

/**
 * Computes the ISO-8601 week number and ISO week year for a date in a given IANA timezone.
 * Matches PostgreSQL's EXTRACT(isoyear FROM ...) and EXTRACT(week FROM ...).
 */
export function getIsoWeekAndYear(date: Date, timeZone: string): { weekYear: number; weekNumber: number } {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const getPart = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
  const year = getPart('year');
  const month = getPart('month') - 1;
  const day = getPart('day');

  const target = new Date(Date.UTC(year, month, day));
  const dayNr = (target.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
  const weekYear = new Date(firstThursday).getUTCFullYear();
  return { weekYear, weekNumber };
}

/**
 * Returns a "YYYY-MM-DD" date string for a given Date in a specific IANA timezone.
 */
export function getLocalDateString(date: Date, timeZone: string): string {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const getPart = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

/**
 * Computes the authoritative start (00:00:00) and end (23:59:59.999) UTC timestamps
 * for a local calendar day "YYYY-MM-DD" in a specific IANA timezone.
 */
export function getDayBoundariesUtc(
  dateStr: string,
  timeZone: string
): { startUtc: string; endUtc: string } {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const startConv = localToUtc(`${dateStr}T00:00:00`, safeTz);
  const endConv = localToUtc(`${dateStr}T23:59:59`, safeTz);

  const startUtc = startConv.utcIso || new Date(`${dateStr}T00:00:00.000Z`).toISOString();
  let endUtc = endConv.utcIso || new Date(`${dateStr}T23:59:59.999Z`).toISOString();

  // If end timestamp needs to cover the remainder of the 59th second
  if (endUtc.endsWith('Z') && !endUtc.includes('.')) {
    endUtc = endUtc.replace('Z', '.999Z');
  }

  return { startUtc, endUtc };
}

/**
 * Formats a "YYYY-MM-DD" date string in a specific timezone for the calendar header.
 */
export function formatCalendarDateHeader(
  dateStr: string,
  timeZone: string
): { formatted: string; dayOfWeek: string; fullDate: string } {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
  const approxDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    weekday: 'long',
  }).format(approxDate);

  const fullDate = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(approxDate);

  const formatted = `${dayOfWeek}, ${fullDate}`;

  return { formatted, dayOfWeek, fullDate };
}

/**
 * Extracts the local hour (0..23) and minute (0..59) from a UTC ISO timestamp
 * in a specific IANA timezone.
 */
export function getLocalHourAndMinute(
  utcIso: string,
  timeZone: string
): { hour: number; minute: number } {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const date = new Date(utcIso);
  if (isNaN(date.getTime())) {
    return { hour: 0, minute: 0 };
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (t: string) => {
    const val = parts.find((p) => p.type === t)?.value;
    return val ? parseInt(val, 10) : 0;
  };

  let hour = getPart('hour');
  if (hour === 24) hour = 0;
  const minute = getPart('minute');

  return { hour, minute };
}

/**
 * Adds or subtracts calendar days from a "YYYY-MM-DD" string.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface WeekDayInfo {
  dateStr: string;
  dayOfWeek: string;
  dayOfWeekFull: string;
  dayNumber: number;
  isToday: boolean;
}

/**
 * Computes the 7 days of the ISO week (Monday to Sunday) containing a given date in profile timezone.
 */
export function getWeekDaysForDate(
  dateStr: string,
  timeZone: string
): { mondayStr: string; sundayStr: string; days: WeekDayInfo[] } {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const todayStr = getLocalDateString(new Date(), safeTz);

  const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
  const approxDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = approxDate.getUTCDay(); // 0 = Sun, 1 = Mon ...
  const isoOffset = (dayOfWeek + 6) % 7; // Mon = 0, Sun = 6

  const mondayStr = addDaysToDateString(dateStr, -isoOffset);
  const sundayStr = addDaysToDateString(mondayStr, 6);

  const days: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const currentStr = addDaysToDateString(mondayStr, i);
    const [cy, cm, cd] = currentStr.split('-').map((v) => parseInt(v, 10));
    const cDate = new Date(Date.UTC(cy, cm - 1, cd, 12, 0, 0));

    const dayOfWeekShort = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      weekday: 'short',
    }).format(cDate);

    const dayOfWeekFull = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      weekday: 'long',
    }).format(cDate);

    days.push({
      dateStr: currentStr,
      dayOfWeek: dayOfWeekShort,
      dayOfWeekFull,
      dayNumber: cd,
      isToday: currentStr === todayStr,
    });
  }

  return { mondayStr, sundayStr, days };
}

/**
 * Computes authoritative UTC start and end boundaries for the full ISO week containing dateStr.
 */
export function getWeekBoundariesUtc(
  dateStr: string,
  timeZone: string
): { startUtc: string; endUtc: string; mondayStr: string; sundayStr: string } {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const { mondayStr, sundayStr } = getWeekDaysForDate(dateStr, safeTz);
  const { startUtc } = getDayBoundariesUtc(mondayStr, safeTz);
  const { endUtc } = getDayBoundariesUtc(sundayStr, safeTz);
  return { startUtc, endUtc, mondayStr, sundayStr };
}

/**
 * Formats a week header title, e.g. "Sep 14 – Sep 20, 2026" or "Sep 28 – Oct 4, 2026".
 */
export function formatWeekRangeHeader(dateStr: string, timeZone: string): string {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const { mondayStr, sundayStr } = getWeekDaysForDate(dateStr, safeTz);

  const [my, mm, md] = mondayStr.split('-').map((v) => parseInt(v, 10));
  const [sy, sm, sd] = sundayStr.split('-').map((v) => parseInt(v, 10));

  const monDate = new Date(Date.UTC(my, mm - 1, md, 12, 0, 0));
  const sunDate = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));

  const monMonth = new Intl.DateTimeFormat('en-US', { timeZone: safeTz, month: 'short' }).format(monDate);
  const sunMonth = new Intl.DateTimeFormat('en-US', { timeZone: safeTz, month: 'short' }).format(sunDate);

  if (my !== sy) {
    return `${monMonth} ${md}, ${my} – ${sunMonth} ${sd}, ${sy}`;
  }
  if (mm !== sm) {
    return `${monMonth} ${md} – ${sunMonth} ${sd}, ${my}`;
  }
  return `${monMonth} ${md} – ${sd}, ${my}`;
}

/**
 * Formats month and year header, e.g. "September 2026".
 */
export function formatMonthYearHeader(dateStr: string, timeZone: string): string {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export interface MonthGridCell {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Computes full monthly grid (weeks of Mon..Sun) for the month containing dateStr.
 */
export function getMonthGridForDate(
  dateStr: string,
  timeZone: string
): {
  year: number;
  month: number;
  monthName: string;
  grid: MonthGridCell[];
  startUtc: string;
  endUtc: string;
} {
  const safeTz = isValidIanaTimezone(timeZone) ? timeZone : 'UTC';
  const todayStr = getLocalDateString(new Date(), safeTz);

  const [year, month] = dateStr.split('-').map((v) => parseInt(v, 10));
  const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;

  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const firstDateObj = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const firstDayOfWeek = firstDateObj.getUTCDay();
  const leadingPadding = (firstDayOfWeek + 6) % 7; // Monday = 0

  const gridStartDateStr = addDaysToDateString(firstDayStr, -leadingPadding);

  // Determine number of cells needed (multiples of 7 to end on Sunday)
  const totalDaysSoFar = leadingPadding + totalDaysInMonth;
  const trailingPadding = (7 - (totalDaysSoFar % 7)) % 7;
  const totalCells = totalDaysSoFar + trailingPadding;

  const grid: MonthGridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const cStr = addDaysToDateString(gridStartDateStr, i);
    const [cy, cm, cd] = cStr.split('-').map((v) => parseInt(v, 10));
    const isCurrentMonth = cy === year && cm === month;

    grid.push({
      dateStr: cStr,
      dayNumber: cd,
      isCurrentMonth,
      isToday: cStr === todayStr,
    });
  }

  const gridEndDateStr = grid[grid.length - 1].dateStr;
  const { startUtc } = getDayBoundariesUtc(gridStartDateStr, safeTz);
  const { endUtc } = getDayBoundariesUtc(gridEndDateStr, safeTz);

  const monthName = formatMonthYearHeader(firstDayStr, safeTz);

  return {
    year,
    month,
    monthName,
    grid,
    startUtc,
    endUtc,
  };
}

/**
 * Computes remaining whole days until a target deadline date.
 * Returns 0 if the target date is today or in the past.
 *
 * @param targetDate Target date as Date object or ISO string.
 * @param clock Optional Clock implementation for deterministic temporal testing.
 * @returns Non-negative integer representing remaining whole days.
 *
 * @example
 * getDaysRemaining('2026-12-31T23:59:59Z'); // e.g. 93
 * getDaysRemaining(new Date(Date.now() - 1000)); // 0
 */
export function getDaysRemaining(
  targetDate: Date | string,
  clock: Clock = defaultClock,
): number {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  if (isNaN(target.getTime())) {
    return 0;
  }
  const now = clock.now();
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}


