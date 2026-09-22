import { computed, inject, Injectable } from '@angular/core';
import { nanoid } from 'nanoid';
import { GlobalConfigService } from '../config/global-config.service';
import { TasksConfig } from '../config/global-config.model';
import { TaskService } from '../tasks/task.service';
import { INBOX_PROJECT } from '../project/project.const';
import { getDbDateStr } from '../../util/get-db-date-str';
import {
  EMPTY_LIFE_NETWORKING_DATA,
  LifeNetworkingData,
  NetworkContact,
  NetworkFollowUp,
  NetworkInteraction,
} from './networking.model';
import {
  addCalendarDays,
  getNextContactDay,
  isNetworkContactDue,
  networkContactMatchesQuery,
  timestampToLocalDay,
} from './networking.util';

type TasksConfigWithNetworking = TasksConfig & {
  lifeNetworking?: LifeNetworkingData;
};

export type NetworkContactInput = Omit<
  NetworkContact,
  'id' | 'createdAt' | 'modifiedAt' | 'lastContactAt' | 'isArchived'
> & {
  lastContactAt?: number | null;
  isArchived?: boolean;
};

export interface NetworkInteractionInput extends Omit<
  NetworkInteraction,
  'id' | 'contactId' | 'createdAt'
> {
  followUpTitle?: string;
  followUpDueDay?: string | null;
}

@Injectable({ providedIn: 'root' })
export class NetworkingService {
  private readonly _globalConfig = inject(GlobalConfigService);
  private readonly _taskService = inject(TaskService);

  readonly data = computed<LifeNetworkingData>(() => {
    const tasks = this._globalConfig.tasks() as TasksConfigWithNetworking | undefined;
    const stored = tasks?.lifeNetworking;
    if (!stored) {
      return EMPTY_LIFE_NETWORKING_DATA;
    }
    return {
      version: 1,
      contacts: Array.isArray(stored.contacts) ? stored.contacts : [],
      interactions: Array.isArray(stored.interactions) ? stored.interactions : [],
      followUps: Array.isArray(stored.followUps) ? stored.followUps : [],
    };
  });

  readonly contacts = computed(() =>
    this.data()
      .contacts.filter((contact) => !contact.isArchived)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly archivedContacts = computed(() =>
    this.data()
      .contacts.filter((contact) => contact.isArchived)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly dueContacts = computed(() => {
    const today = getDbDateStr();
    return this.contacts()
      .filter((contact) => isNetworkContactDue(contact, today))
      .sort((a, b) =>
        (a.nextContactDay || '9999').localeCompare(b.nextContactDay || '9999'),
      );
  });

  readonly overdueContacts = computed(() => {
    const today = getDbDateStr();
    return this.contacts()
      .filter((contact) => !!contact.nextContactDay && contact.nextContactDay < today)
      .sort((a, b) =>
        (a.nextContactDay || '9999').localeCompare(b.nextContactDay || '9999'),
      );
  });

  readonly todayContacts = computed(() => {
    const today = getDbDateStr();
    return this.contacts().filter((contact) => contact.nextContactDay === today);
  });

  readonly upcomingContacts = computed(() => {
    const today = getDbDateStr();
    const end = addCalendarDays(today, 7);
    return this.contacts()
      .filter(
        (contact) =>
          !!contact.nextContactDay &&
          contact.nextContactDay > today &&
          contact.nextContactDay <= end,
      )
      .sort((a, b) =>
        (a.nextContactDay || '9999').localeCompare(b.nextContactDay || '9999'),
      );
  });

  contact(id: string | null | undefined): NetworkContact | undefined {
    if (!id) return undefined;
    return this.data().contacts.find((contact) => contact.id === id);
  }

  interactionsForContact(contactId: string): NetworkInteraction[] {
    return this.data()
      .interactions.filter((interaction) => interaction.contactId === contactId)
      .slice()
      .sort((a, b) => b.at - a.at);
  }

  followUpsForContact(contactId: string): NetworkFollowUp[] {
    return this.data()
      .followUps.filter((followUp) => followUp.contactId === contactId)
      .slice()
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'OPEN' ? -1 : 1;
        return (a.dueDay || '9999').localeCompare(b.dueDay || '9999');
      });
  }

  search(rawQuery: string, includeArchived = false): NetworkContact[] {
    const data = this.data();
    return data.contacts
      .filter(
        (contact) =>
          (includeArchived || !contact.isArchived) &&
          networkContactMatchesQuery(contact, data, rawQuery),
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  addContact(input: NetworkContactInput): string {
    const now = Date.now();
    const id = nanoid();
    const lastContactAt = input.lastContactAt ?? null;
    const cadenceBaseDay =
      lastContactAt != null
        ? timestampToLocalDay(lastContactAt)
        : input.metOn || getDbDateStr();
    const contact: NetworkContact = {
      ...input,
      id,
      name: input.name.trim(),
      tags: this._normalizeTags(input.tags),
      createdAt: now,
      modifiedAt: now,
      lastContactAt,
      nextContactDay:
        input.nextContactDay ??
        getNextContactDay(input.cadence, cadenceBaseDay, input.cadenceDays),
      isArchived: input.isArchived ?? false,
    };
    this._setData({
      ...this.data(),
      contacts: [...this.data().contacts, contact],
    });
    return id;
  }

  updateContact(id: string, changes: Partial<NetworkContact>): void {
    const current = this.contact(id);
    if (!current) return;
    const mergedCadence = changes.cadence ?? current.cadence;
    const mergedCadenceDays = changes.cadenceDays ?? current.cadenceDays;
    const mergedLastContactAt = changes.lastContactAt ?? current.lastContactAt ?? null;
    const mergedNextContactDay = changes.nextContactDay ?? current.nextContactDay ?? null;
    const cadenceBaseDay =
      mergedLastContactAt != null
        ? timestampToLocalDay(mergedLastContactAt)
        : changes.metOn || current.metOn || getDbDateStr();
    const updated: NetworkContact = {
      ...current,
      ...changes,
      id,
      name: (changes.name ?? current.name).trim(),
      tags: changes.tags ? this._normalizeTags(changes.tags) : current.tags,
      nextContactDay:
        mergedNextContactDay ??
        getNextContactDay(mergedCadence, cadenceBaseDay, mergedCadenceDays),
      modifiedAt: Date.now(),
    };
    this._setData({
      ...this.data(),
      contacts: this.data().contacts.map((contact) =>
        contact.id === id ? updated : contact,
      ),
    });
  }

  archiveContact(id: string, isArchived = true): void {
    this.updateContact(id, { isArchived });
  }

  deleteContactPermanently(id: string): void {
    const data = this.data();
    this._setData({
      ...data,
      contacts: data.contacts.filter((contact) => contact.id !== id),
      interactions: data.interactions.filter(
        (interaction) => interaction.contactId !== id,
      ),
      followUps: data.followUps.filter((followUp) => followUp.contactId !== id),
    });
  }

  updateInteraction(id: string, input: NetworkInteractionInput): void {
    const current = this.data().interactions.find((item) => item.id === id);
    if (!current) return;

    const contact = this.contact(current.contactId);
    if (!contact) return;

    const data = this.data();
    const nextContactDay =
      input.nextContactDay !== undefined && input.nextContactDay !== null
        ? input.nextContactDay || null
        : (current.nextContactDay ?? null);

    const updatedInteraction: NetworkInteraction = {
      ...current,
      at: input.at,
      channel: input.channel,
      channelCustom: input.channelCustom?.trim() || undefined,
      location: input.location?.trim() || undefined,
      summary: input.summary.trim(),
      learned: input.learned?.trim() || undefined,
      iPromised: input.iPromised?.trim() || undefined,
      theyPromised: input.theyPromised?.trim() || undefined,
      nextStep: input.nextStep?.trim() || undefined,
      nextTopic: input.nextTopic?.trim() || undefined,
      nextContactDay,
    };

    const interactions = data.interactions.map((item) =>
      item.id === id ? updatedInteraction : item,
    );
    const latest = interactions
      .filter((item) => item.contactId === current.contactId)
      .slice()
      .sort((a, b) => b.at - a.at)[0];

    const updatedContact: NetworkContact = {
      ...contact,
      lastContactAt: latest?.at ?? null,
      nextContactDay:
        latest?.nextContactDay !== undefined
          ? latest.nextContactDay
          : contact.nextContactDay,
      nextTopic: latest ? latest.nextTopic : contact.nextTopic,
      modifiedAt: Date.now(),
    };

    this._setData({
      ...data,
      contacts: data.contacts.map((item) =>
        item.id === current.contactId ? updatedContact : item,
      ),
      interactions,
    });
  }

  logInteraction(contactId: string, input: NetworkInteractionInput): string {
    const contact = this.contact(contactId);
    if (!contact) {
      throw new Error('Networking contact not found');
    }

    const data = this.data();
    const now = Date.now();
    const interactionId = nanoid();
    const contactDay = timestampToLocalDay(input.at);
    const nextContactDay =
      input.nextContactDay !== undefined && input.nextContactDay !== null
        ? input.nextContactDay || null
        : getNextContactDay(contact.cadence, contactDay, contact.cadenceDays);

    const interaction: NetworkInteraction = {
      id: interactionId,
      contactId,
      at: input.at,
      channel: input.channel,
      channelCustom: input.channelCustom?.trim() || undefined,
      location: input.location?.trim() || undefined,
      summary: input.summary.trim(),
      learned: input.learned?.trim() || undefined,
      iPromised: input.iPromised?.trim() || undefined,
      theyPromised: input.theyPromised?.trim() || undefined,
      nextStep: input.nextStep?.trim() || undefined,
      nextTopic: input.nextTopic?.trim() || undefined,
      nextContactDay,
      createdAt: now,
    };

    const updatedContact: NetworkContact = {
      ...contact,
      lastContactAt: input.at,
      nextContactDay,
      nextTopic: input.nextTopic?.trim() || contact.nextTopic,
      modifiedAt: now,
    };

    const followUps = [...data.followUps];
    if (input.followUpTitle?.trim()) {
      followUps.push({
        id: nanoid(),
        contactId,
        interactionId,
        title: input.followUpTitle.trim(),
        dueDay: input.followUpDueDay || null,
        status: 'OPEN',
        createdAt: now,
      });
    }

    this._setData({
      ...data,
      contacts: data.contacts.map((item) =>
        item.id === contactId ? updatedContact : item,
      ),
      interactions: [...data.interactions, interaction],
      followUps,
    });

    return interactionId;
  }

  addFollowUp(
    contactId: string,
    title: string,
    dueDay?: string | null,
    interactionId?: string | null,
  ): string {
    const trimmed = title.trim();
    if (!trimmed || !this.contact(contactId)) return '';
    const id = nanoid();
    this._setData({
      ...this.data(),
      followUps: [
        ...this.data().followUps,
        {
          id,
          contactId,
          interactionId: interactionId ?? null,
          title: trimmed,
          dueDay: dueDay ?? null,
          status: 'OPEN',
          createdAt: Date.now(),
        },
      ],
    });
    return id;
  }

  setFollowUpStatus(id: string, status: NetworkFollowUp['status']): void {
    this._setData({
      ...this.data(),
      followUps: this.data().followUps.map((followUp) =>
        followUp.id === id
          ? {
              ...followUp,
              status,
              completedAt: status === 'DONE' ? Date.now() : null,
            }
          : followUp,
      ),
    });
  }

  createTaskForFollowUp(id: string): string | null {
    const followUp = this.data().followUps.find((item) => item.id === id);
    if (!followUp) return null;
    if (followUp.taskId) return followUp.taskId;

    const contact = this.contact(followUp.contactId);
    const configuredProjectId = this._globalConfig.tasks()?.defaultProjectId;
    const projectId =
      typeof configuredProjectId === 'string' ? configuredProjectId : INBOX_PROJECT.id;
    const taskId = this._taskService.add(
      contact ? `${followUp.title} — ${contact.name}` : followUp.title,
      false,
      {
        projectId,
        dueDay: followUp.dueDay || getDbDateStr(),
        lifeIsNextAction: true,
      },
      true,
    );

    this._setData({
      ...this.data(),
      followUps: this.data().followUps.map((item) =>
        item.id === id ? { ...item, taskId } : item,
      ),
    });
    return taskId;
  }

  private _normalizeTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of tags) {
      const tag = raw.trim();
      const key = tag.toLocaleLowerCase();
      if (tag && !seen.has(key)) {
        seen.add(key);
        result.push(tag);
      }
    }
    return result;
  }

  private _setData(data: LifeNetworkingData): void {
    const section = { lifeNetworking: data } as unknown as Partial<TasksConfig>;
    this._globalConfig.updateSection('tasks', section, true);
  }
}
