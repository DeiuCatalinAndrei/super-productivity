import {
  LifeNetworkingData,
  NetworkContact,
  NetworkContactCadence,
} from './networking.model';

const toDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

export const timestampToLocalDay = (timestamp: number): string =>
  toDay(new Date(timestamp));

export const addCalendarDays = (day: string, days: number): string => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDay(date);
};

const addCalendarMonths = (day: string, months: number): string => {
  const source = new Date(`${day}T12:00:00`);
  const originalDay = source.getDate();
  source.setDate(1);
  source.setMonth(source.getMonth() + months);
  const lastDay = new Date(source.getFullYear(), source.getMonth() + 1, 0, 12).getDate();
  source.setDate(Math.min(originalDay, lastDay));
  return toDay(source);
};

export const getNextContactDay = (
  cadence: NetworkContactCadence,
  fromDay: string,
  cadenceDays?: number | null,
): string | null => {
  switch (cadence) {
    case 'WEEKLY':
      return addCalendarDays(fromDay, 7);
    case 'BIWEEKLY':
      return addCalendarDays(fromDay, 14);
    case 'MONTHLY':
      return addCalendarMonths(fromDay, 1);
    case 'BIMONTHLY':
      return addCalendarMonths(fromDay, 2);
    case 'QUARTERLY':
      return addCalendarMonths(fromDay, 3);
    case 'HALF_YEAR':
      return addCalendarMonths(fromDay, 6);
    case 'YEARLY':
      return addCalendarMonths(fromDay, 12);
    case 'CUSTOM':
      return cadenceDays && cadenceDays > 0
        ? addCalendarDays(fromDay, Math.round(cadenceDays))
        : null;
    case 'NONE':
    default:
      return null;
  }
};

export const isNetworkContactDue = (contact: NetworkContact, today: string): boolean =>
  !contact.isArchived && !!contact.nextContactDay && contact.nextContactDay <= today;

export const networkContactMatchesQuery = (
  contact: NetworkContact,
  data: LifeNetworkingData,
  rawQuery: string,
): boolean => {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;

  const interactionText = data.interactions
    .filter((item) => item.contactId === contact.id)
    .map((item) =>
      [
        item.summary,
        item.learned,
        item.iPromised,
        item.theyPromised,
        item.nextStep,
        item.nextTopic,
        item.location,
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ');

  const text = [
    contact.name,
    contact.phone,
    contact.email,
    contact.instagram,
    contact.facebook,
    contact.linkedin,
    contact.city,
    contact.region,
    contact.country,
    contact.occupation,
    contact.role,
    contact.company,
    contact.industry,
    contact.metThrough,
    contact.metAt,
    contact.relationshipType,
    contact.importance,
    contact.tags.join(' '),
    contact.interests,
    contact.canHelpWith,
    contact.canHelpMeWith,
    contact.notes,
    contact.nextTopic,
    interactionText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();

  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => text.includes(token));
};
