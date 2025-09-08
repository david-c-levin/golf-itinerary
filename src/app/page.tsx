/* ---------- deterministic date/time formatters ---------- */
const ieFormatter = new Intl.DateTimeFormat('en-IE', {
  timeZone: 'Europe/Dublin',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Dublin',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

/** Ireland time for on-screen display */
function formatIE(input: string | number | Date): string {
  const date =
    typeof input === 'string' || typeof input === 'number'
      ? new Date(input)
      : input;
  return ieFormatter.format(date);
}

/** Day label computed from real timestamps */
function formatDayLabel(day: DayPlan): string {
  const dates = (day.events || [])
    .map((e) => new Date(e.start))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const src =
    dates.length > 0 ? dates[0] : new Date(`${day.id}T00:00:00Z`);
  return dayLabelFormatter.format(src);
}
