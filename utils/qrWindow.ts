const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

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

export const QR_WINDOW_MESSAGE =
  'O QR Code so pode ser gerado no horario do cafe da manha: de segunda a sabado, das 06:00 as 10:00, e aos domingos, das 07:00 as 10:00 (horario de Sao Paulo).';

export const isQrIssuanceWindowOpen = (date: Date = new Date()) => {
  const parts = clockFormatter.formatToParts(date);
  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value || '';
  const hourLabel = parts.find((part) => part.type === 'hour')?.value || '0';
  const minuteLabel = parts.find((part) => part.type === 'minute')?.value || '0';

  const weekday = weekdayMap[weekdayLabel] ?? 0;
  const hour = Number.isFinite(Number(hourLabel)) ? Number(hourLabel) % 24 : 0;
  const minute = Number.isFinite(Number(minuteLabel)) ? Number(minuteLabel) : 0;
  const currentMinutes = hour * 60 + minute;

  const openingMinutes = weekday === 0 ? 7 * 60 : 6 * 60;
  const closingMinutes = 10 * 60;

  return currentMinutes >= openingMinutes && currentMinutes <= closingMinutes;
};

