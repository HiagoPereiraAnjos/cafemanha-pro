const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const clockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SAO_PAULO_TIMEZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type SaoPauloClock = {
  weekday: number;
  hour: number;
  minute: number;
};

const getSaoPauloClock = (date: Date = new Date()): SaoPauloClock => {
  const parts = clockFormatter.formatToParts(date);
  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value || '';
  const hourLabel = parts.find((part) => part.type === 'hour')?.value || '0';
  const minuteLabel = parts.find((part) => part.type === 'minute')?.value || '0';

  const weekday = weekdayMap[weekdayLabel] ?? 0;
  let hour = Number(hourLabel);
  if (!Number.isFinite(hour)) hour = 0;
  if (hour === 24) hour = 0;

  let minute = Number(minuteLabel);
  if (!Number.isFinite(minute)) minute = 0;

  return { weekday, hour, minute };
};

export const getTodaySaoPaulo = () => {
  return dayFormatter.format(new Date());
};

export const isQrIssuanceWindowOpen = (date: Date = new Date()) => {
  const { weekday, hour, minute } = getSaoPauloClock(date);
  const currentMinutes = hour * 60 + minute;

  const openingMinutes = weekday === 0 ? 7 * 60 : 6 * 60; // Sunday starts at 07:00
  const closingMinutes = 10 * 60; // 10:00 inclusive

  return currentMinutes >= openingMinutes && currentMinutes <= closingMinutes;
};
