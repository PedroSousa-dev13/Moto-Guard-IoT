/**
 * Formats a duration in seconds to MM:SS string.
 * Minutes can exceed 59 (no hours component).
 *
 * @param seconds - Non-negative number of seconds
 * @returns String in MM:SS format (e.g. 65 → "01:05")
 */
export function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
