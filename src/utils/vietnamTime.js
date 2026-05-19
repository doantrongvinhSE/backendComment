const VIETNAM_TIME_OFFSET_MINUTES = 7 * 60;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function shiftedDate(date) {
  return new Date(date.getTime() + VIETNAM_TIME_OFFSET_MINUTES * MS_PER_MINUTE);
}

function vietnamDateKey(date = new Date()) {
  const shifted = shiftedDate(date);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function vietnamTodayRange(now = new Date()) {
  const shifted = shiftedDate(now);
  const startUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const start = new Date(startUtc - VIETNAM_TIME_OFFSET_MINUTES * MS_PER_MINUTE);
  const end = new Date(start.getTime() + MS_PER_DAY);

  return { start, end };
}

module.exports = {
  vietnamDateKey,
  vietnamTodayRange,
};
