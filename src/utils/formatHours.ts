/** Hours as hours and minutes, rounded to the minute: 5.5 → "5h 30min", 6 → "6h". */
export function formatHours(h: number) {
  const totalMinutes = Math.round(h * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}
