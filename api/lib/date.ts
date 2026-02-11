const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

export const getTodaySaoPaulo = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
};
