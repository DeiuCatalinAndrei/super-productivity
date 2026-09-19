import {
  addCalendarDays,
  getNextContactDay,
  networkContactMatchesQuery,
} from './networking.util';
import { LifeNetworkingData, NetworkContact } from './networking.model';

const contact: NetworkContact = {
  id: 'c1',
  name: 'Andrei Popescu',
  city: 'Timișoara',
  occupation: 'AI Engineer',
  company: 'Example',
  relationshipType: 'PROFESSIONAL',
  importance: 'IMPORTANT',
  tags: ['AI', 'Distributed Systems'],
  cadence: 'MONTHLY',
  createdAt: 1,
  modifiedAt: 1,
};

describe('networking.util', () => {
  it('calculates calendar-aware recurring contact dates', () => {
    expect(getNextContactDay('MONTHLY', '2026-01-31')).toBe('2026-02-28');
    expect(getNextContactDay('QUARTERLY', '2026-09-30')).toBe('2026-12-30');
    expect(getNextContactDay('CUSTOM', '2026-09-19', 10)).toBe('2026-09-29');
    expect(getNextContactDay('NONE', '2026-09-19')).toBeNull();
  });

  it('adds calendar days deterministically', () => {
    expect(addCalendarDays('2026-12-29', 7)).toBe('2027-01-05');
  });

  it('searches profile and conversation history', () => {
    const data: LifeNetworkingData = {
      version: 1,
      contacts: [contact],
      interactions: [
        {
          id: 'i1',
          contactId: 'c1',
          at: 1,
          channel: 'MEETING',
          summary: 'Talked about RAG infrastructure and hiring.',
          createdAt: 1,
        },
      ],
      followUps: [],
    };
    expect(networkContactMatchesQuery(contact, data, 'timisoara ai')).toBe(true);
    expect(networkContactMatchesQuery(contact, data, 'rag hiring')).toBe(true);
    expect(networkContactMatchesQuery(contact, data, 'accounting')).toBe(false);
  });
});
