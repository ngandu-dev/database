function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function timezoneOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;

  return `${sign}${pad(hours)}:${pad(mins)}`;
}

function formatToken(token: string, date: Date): string {
  switch (token) {
    case "Y":
      return pad(date.getFullYear(), 4);
    case "m":
      return pad(date.getMonth() + 1);
    case "d":
      return pad(date.getDate());
    case "H":
      return pad(date.getHours());
    case "i":
      return pad(date.getMinutes());
    case "s":
      return pad(date.getSeconds());
    case "u":
      return pad(date.getMilliseconds() * 1000, 6);
    case "P":
      return timezoneOffset(date);
    default:
      return token;
  }
}

export function formatDateByPattern(date: Date, pattern: string): string {
  return pattern.replace(/[YmdHisuP]/g, (token) => formatToken(token, date));
}

export function parseDateByPattern(value: string, pattern: string): Date | null {
  const formatWithMicros = pattern.includes(".u");
  const formatWithZone = pattern.includes("P");

  if (pattern === "Y-m-d") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match === null) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);

    return new Date(year, month, day, 0, 0, 0, 0);
  }

  if (pattern === "H:i:s") {
    const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
    if (match === null) {
      return null;
    }

    return new Date(1970, 0, 1, Number(match[1]), Number(match[2]), Number(match[3]), 0);
  }

  if (formatWithZone) {
    const withMicros =
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\.(\d{1,6})\s*([+-]\d{2}:\d{2}|Z)$/;
    const withoutMicros =
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*([+-]\d{2}:\d{2}|Z)$/;
    const match = formatWithMicros ? withMicros.exec(value) : withoutMicros.exec(value);
    if (match === null) {
      return null;
    }

    if (formatWithMicros) {
      const [, year, month, day, hours, minutes, seconds, micros, zone] = match;
      if (
        year === undefined ||
        month === undefined ||
        day === undefined ||
        hours === undefined ||
        minutes === undefined ||
        seconds === undefined ||
        micros === undefined ||
        zone === undefined
      ) {
        return null;
      }

      const iso = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${micros.padEnd(3, "0").slice(0, 3)}${zone}`;
      const parsed = new Date(iso);
      return Number.isNaN(parsed.valueOf()) ? null : parsed;
    }

    const [, year, month, day, hours, minutes, seconds, zone] = match;
    if (
      year === undefined ||
      month === undefined ||
      day === undefined ||
      hours === undefined ||
      minutes === undefined ||
      seconds === undefined ||
      zone === undefined
    ) {
      return null;
    }

    const iso = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${zone}`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }

  const withMicros = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\.(\d{1,6})$/;
  const withoutMicros = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
  const match = formatWithMicros ? withMicros.exec(value) : withoutMicros.exec(value);
  if (match === null) {
    return null;
  }

  if (formatWithMicros) {
    const [, year, month, day, hours, minutes, seconds, micros] = match;
    if (
      year === undefined ||
      month === undefined ||
      day === undefined ||
      hours === undefined ||
      minutes === undefined ||
      seconds === undefined ||
      micros === undefined
    ) {
      return null;
    }

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(micros.padEnd(3, "0").slice(0, 3)),
    );
  }

  const [, year, month, day, hours, minutes, seconds] = match;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hours === undefined ||
    minutes === undefined ||
    seconds === undefined
  ) {
    return null;
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
    0,
  );
}
