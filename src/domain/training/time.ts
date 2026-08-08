/** Course startTime/endTime are stored as Postgres TIME values, represented by Prisma as a Date on the 1970-01-01 epoch day. */
export function timeStringToDate(time: string): Date {
  return new Date(`1970-01-01T${time}:00.000Z`)
}

export function dateToTimeString(date: Date): string {
  return date.toISOString().slice(11, 16)
}
