import type { TaskCopy } from '../task.model';
import { isValidDBDateStr } from '../../../util/get-db-date-str';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LifeOsRepeatTemplateFields {
  lifePriorityId?: string | null;
  lifeFocus?: number | null;
  lifeEnergy?: number | null;
  lifeLocationIds?: string[];
  lifeRequirementIds?: string[];
  lifeIsNextAction?: boolean;
  lifeWaitingFor?: string | null;
  lifeBlockedByTaskIds?: string[];
  lifeDueDayOffset?: number | null;
  lifeFollowUpDayOffset?: number | null;
  lifeReviewDayOffset?: number | null;
}

const _toUtcDayNumber = (dateStr: string): number | null => {
  if (!isValidDBDateStr(dateStr)) {
    return null;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
};

const _getRelativeDayOffset = (
  dateStr: string | null | undefined,
  occurrenceDay: string,
): number | null | undefined => {
  if (dateStr === null) {
    return null;
  }
  if (!dateStr) {
    return undefined;
  }
  const target = _toUtcDayNumber(dateStr);
  const anchor = _toUtcDayNumber(occurrenceDay);
  return target === null || anchor === null ? undefined : target - anchor;
};

const _applyRelativeDayOffset = (
  occurrenceDay: string,
  offset: number | null | undefined,
): string | null | undefined => {
  if (offset === null) {
    return null;
  }
  if (offset === undefined || !Number.isFinite(offset)) {
    return undefined;
  }
  const anchor = _toUtcDayNumber(occurrenceDay);
  if (anchor === null) {
    return undefined;
  }
  return new Date((anchor + offset) * MS_PER_DAY).toISOString().slice(0, 10);
};

export const getLifeOsFieldsForDuplicate = (task: TaskCopy): Partial<TaskCopy> => ({
  lifePriorityId: task.lifePriorityId,
  lifeFocus: task.lifeFocus,
  lifeEnergy: task.lifeEnergy,
  lifeDueDay: task.lifeDueDay,
  lifeLocationIds: [...(task.lifeLocationIds ?? [])],
  lifeRequirementIds: [...(task.lifeRequirementIds ?? [])],
  lifeIsNextAction: task.lifeIsNextAction,
  lifeWaitingFor: task.lifeWaitingFor,
  lifeFollowUpDay: task.lifeFollowUpDay,
  lifeBlockedByTaskIds: [...(task.lifeBlockedByTaskIds ?? [])],
  lifeReviewDay: task.lifeReviewDay,
});

export const getLifeOsRepeatTemplateFields = (
  task: TaskCopy,
  occurrenceDay: string,
): LifeOsRepeatTemplateFields => ({
  lifePriorityId: task.lifePriorityId,
  lifeFocus: task.lifeFocus,
  lifeEnergy: task.lifeEnergy,
  lifeLocationIds: [...(task.lifeLocationIds ?? [])],
  lifeRequirementIds: [...(task.lifeRequirementIds ?? [])],
  lifeIsNextAction: task.lifeIsNextAction,
  lifeWaitingFor: task.lifeWaitingFor,
  lifeBlockedByTaskIds: [...(task.lifeBlockedByTaskIds ?? [])],
  lifeDueDayOffset: _getRelativeDayOffset(task.lifeDueDay, occurrenceDay),
  lifeFollowUpDayOffset: _getRelativeDayOffset(task.lifeFollowUpDay, occurrenceDay),
  lifeReviewDayOffset: _getRelativeDayOffset(task.lifeReviewDay, occurrenceDay),
});

export const applyLifeOsRepeatTemplateFields = (
  template: LifeOsRepeatTemplateFields,
  occurrenceDay: string,
): Partial<TaskCopy> => {
  const lifeDueDay = _applyRelativeDayOffset(occurrenceDay, template.lifeDueDayOffset);
  const lifeFollowUpDay = _applyRelativeDayOffset(
    occurrenceDay,
    template.lifeFollowUpDayOffset,
  );
  const lifeReviewDay = _applyRelativeDayOffset(
    occurrenceDay,
    template.lifeReviewDayOffset,
  );

  return {
    ...(template.lifePriorityId !== undefined && {
      lifePriorityId: template.lifePriorityId,
    }),
    ...(template.lifeFocus !== undefined && { lifeFocus: template.lifeFocus }),
    ...(template.lifeEnergy !== undefined && { lifeEnergy: template.lifeEnergy }),
    ...(lifeDueDay !== undefined && { lifeDueDay }),
    ...(template.lifeLocationIds !== undefined && {
      lifeLocationIds: [...template.lifeLocationIds],
    }),
    ...(template.lifeRequirementIds !== undefined && {
      lifeRequirementIds: [...template.lifeRequirementIds],
    }),
    ...(template.lifeIsNextAction !== undefined && {
      lifeIsNextAction: template.lifeIsNextAction,
    }),
    ...(template.lifeWaitingFor !== undefined && {
      lifeWaitingFor: template.lifeWaitingFor,
    }),
    ...(lifeFollowUpDay !== undefined && { lifeFollowUpDay }),
    ...(template.lifeBlockedByTaskIds !== undefined && {
      lifeBlockedByTaskIds: [...template.lifeBlockedByTaskIds],
    }),
    ...(lifeReviewDay !== undefined && { lifeReviewDay }),
  };
};
