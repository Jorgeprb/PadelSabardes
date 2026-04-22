export type MatchReservation = {
  id?: string;
  date: string;
  time: string;
  source?: 'match' | 'tournament';
};

export type AvailabilityState = 'free' | 'near' | 'busy';

export const parseMatchDateTime = (dateString?: string, timeString?: string, baseDate = new Date()) => {
  const [day, month] = (dateString || '01/01').split('/').map((entry) => parseInt(entry || '1', 10));
  const [hours, minutes] = (timeString || '00:00').split(':').map((entry) => parseInt(entry || '0', 10));

  const result = new Date(baseDate);
  const matchMonth = (month || 1) - 1;

  result.setHours(hours || 0, minutes || 0, 0, 0);
  if (matchMonth < result.getMonth() - 2) {
    result.setFullYear(result.getFullYear() + 1);
  }
  result.setMonth(matchMonth);
  result.setDate(day || 1);
  return result;
};

export const getMinutesFromTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
};

const MATCH_DURATION_MINUTES = 90;
const NEAR_MARGIN_MINUTES = 30;

export const getReservationAvailability = (
  dateString: string,
  timeString: string,
  reservations: MatchReservation[],
  excludedReservationId?: string | null,
): AvailabilityState => {
  const start = getMinutesFromTime(timeString);
  const end = start + MATCH_DURATION_MINUTES;

  let isNear = false;

  for (const reservation of reservations) {
    if (!reservation?.date || !reservation?.time) continue;
    if (reservation.date !== dateString) continue;
    if (excludedReservationId && reservation.id === excludedReservationId) continue;

    const reservationStart = getMinutesFromTime(reservation.time);
    const reservationEnd = reservationStart + MATCH_DURATION_MINUTES;

    if (start < reservationEnd && end > reservationStart) {
      return 'busy';
    }

    const gapBefore = Math.abs(reservationStart - end);
    const gapAfter = Math.abs(start - reservationEnd);
    if (gapBefore <= NEAR_MARGIN_MINUTES || gapAfter <= NEAR_MARGIN_MINUTES) {
      isNear = true;
    }
  }

  return isNear ? 'near' : 'free';
};
