/**
 * Date & Time utilities to guarantee 100% accurate LIVE local dates & times
 * Avoids the UTC-shift bug where new Date().toISOString().split('T')[0] gives yesterday's date.
 */

// Returns "YYYY-MM-DD" for the user's current live local timezone
export function getLocalDateString(d = new Date()) {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Returns "HH:MM" for the user's current live local time
export function getLocalTimeString(d = new Date()) {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Returns "YYYY-MM-DDTHH:MM" for datetime-local inputs in local time
export function getLocalDateTimeString(d = new Date()) {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  return `${getLocalDateString(dateObj)}T${getLocalTimeString(dateObj)}`;
}

// Formats a date string (YYYY-MM-DD or ISO) into readable local format without UTC shifting
export function formatReadableDate(dateStr, options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!dateStr) return '';
  const safeStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
  const d = new Date(safeStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', options);
}

// Formats a date time string into readable 12-hour format
export function formatReadableDateTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  return isNaN(d.getTime()) ? dateTimeStr : d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Add days to a date object without mutating
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Returns difference in calendar days (date2 - date1)
export function diffCalendarDays(d1, d2) {
  const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const diffTime = date2.getTime() - date1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Returns relative due label like in Asana/Linear ("Due Today", "Due Tomorrow", "Due Friday", etc.)
export function getRelativeDueLabel(targetDate) {
  if (!targetDate) return '';
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  if (isNaN(target.getTime())) return '';
  
  const now = new Date();
  const diff = diffCalendarDays(now, target);

  if (diff === 0) return 'Due Today';
  if (diff === 1) return 'Due Tomorrow';
  if (diff === -1) return 'Due Yesterday';
  if (diff > 1 && diff < 7) {
    const weekday = target.toLocaleDateString('en-US', { weekday: 'long' });
    return `Due ${weekday}`;
  }
  return `Due ${target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

