export type NetworkContactCadence =
  | 'NONE'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEAR'
  | 'YEARLY'
  | 'CUSTOM';

export type NetworkRelationshipType =
  | 'PROFESSIONAL'
  | 'FRIEND'
  | 'FAMILY'
  | 'UNIVERSITY'
  | 'CLIENT'
  | 'POTENTIAL_CLIENT'
  | 'RECRUITER'
  | 'MENTOR'
  | 'COLLEAGUE'
  | 'ACQUAINTANCE'
  | 'OTHER';

export type NetworkImportance = 'CORE' | 'IMPORTANT' | 'NORMAL' | 'OCCASIONAL';

export type NetworkInteractionChannel =
  | 'MEETING'
  | 'PHONE'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'EMAIL'
  | 'EVENT'
  | 'OTHER';

export type NetworkFollowUpStatus = 'OPEN' | 'DONE' | 'CANCELLED';

export interface NetworkContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  city?: string;
  region?: string;
  country?: string;
  occupation?: string;
  role?: string;
  company?: string;
  industry?: string;
  metThrough?: string;
  introducedByContactId?: string | null;
  metAt?: string;
  metOn?: string | null;
  relationshipType: NetworkRelationshipType;
  importance: NetworkImportance;
  tags: string[];
  interests?: string;
  canHelpWith?: string;
  canHelpMeWith?: string;
  notes?: string;
  cadence: NetworkContactCadence;
  cadenceDays?: number | null;
  lastContactAt?: number | null;
  nextContactDay?: string | null;
  nextTopic?: string;
  createdAt: number;
  modifiedAt: number;
  isArchived?: boolean;
}

export interface NetworkInteraction {
  id: string;
  contactId: string;
  at: number;
  channel: NetworkInteractionChannel;
  location?: string;
  summary: string;
  learned?: string;
  iPromised?: string;
  theyPromised?: string;
  nextStep?: string;
  nextTopic?: string;
  nextContactDay?: string | null;
  createdAt: number;
}

export interface NetworkFollowUp {
  id: string;
  contactId: string;
  interactionId?: string | null;
  title: string;
  dueDay?: string | null;
  status: NetworkFollowUpStatus;
  taskId?: string | null;
  createdAt: number;
  completedAt?: number | null;
}

export interface LifeNetworkingData {
  version: 1;
  contacts: NetworkContact[];
  interactions: NetworkInteraction[];
  followUps: NetworkFollowUp[];
}

export const EMPTY_LIFE_NETWORKING_DATA: LifeNetworkingData = {
  version: 1,
  contacts: [],
  interactions: [],
  followUps: [],
};

export const NETWORK_CADENCE_OPTIONS: ReadonlyArray<{
  value: NetworkContactCadence;
  label: string;
}> = [
  { value: 'NONE', label: 'No reminder' },
  { value: 'WEEKLY', label: 'Every week' },
  { value: 'BIWEEKLY', label: 'Every 2 weeks' },
  { value: 'MONTHLY', label: 'Every month' },
  { value: 'BIMONTHLY', label: 'Every 2 months' },
  { value: 'QUARTERLY', label: 'Every 3 months' },
  { value: 'HALF_YEAR', label: 'Every 6 months' },
  { value: 'YEARLY', label: 'Every year' },
  { value: 'CUSTOM', label: 'Custom days' },
];

export const NETWORK_RELATIONSHIP_OPTIONS: ReadonlyArray<{
  value: NetworkRelationshipType;
  label: string;
}> = [
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'FRIEND', label: 'Friend' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'UNIVERSITY', label: 'University' },
  { value: 'CLIENT', label: 'Client' },
  { value: 'POTENTIAL_CLIENT', label: 'Potential client' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'COLLEAGUE', label: 'Colleague' },
  { value: 'ACQUAINTANCE', label: 'Acquaintance' },
  { value: 'OTHER', label: 'Other' },
];

export const NETWORK_IMPORTANCE_OPTIONS: ReadonlyArray<{
  value: NetworkImportance;
  label: string;
}> = [
  { value: 'CORE', label: 'Core' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'OCCASIONAL', label: 'Occasional' },
];

export const NETWORK_CHANNEL_OPTIONS: ReadonlyArray<{
  value: NetworkInteractionChannel;
  label: string;
}> = [
  { value: 'MEETING', label: 'Meeting' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'EVENT', label: 'Event' },
  { value: 'OTHER', label: 'Other' },
];
