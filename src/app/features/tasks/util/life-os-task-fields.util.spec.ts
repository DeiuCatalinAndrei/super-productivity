import { DEFAULT_TASK, Task } from '../task.model';
import {
  applyLifeOsRepeatTemplateFields,
  getLifeOsFieldsForDuplicate,
  getLifeOsRepeatTemplateFields,
} from './life-os-task-fields.util';

describe('LifeOS task field inheritance', () => {
  const task: Task = {
    ...DEFAULT_TASK,
    id: 'task-1',
    title: 'LifeOS task',
    projectId: 'project-1',
    lifePriorityId: 'priority-high',
    lifeFocus: 3,
    lifeEnergy: 2,
    lifeDueDay: '2026-03-31',
    lifeLocationIds: ['office'],
    lifeRequirementIds: ['laptop'],
    lifeIsNextAction: true,
    lifeWaitingFor: 'Client reply',
    lifeFollowUpDay: '2026-04-02',
    lifeBlockedByTaskIds: ['dependency-1'],
    lifeReviewDay: '2026-04-07',
  };

  it('copies all LifeOS fields exactly for Duplicate', () => {
    expect(getLifeOsFieldsForDuplicate(task)).toEqual({
      lifePriorityId: 'priority-high',
      lifeFocus: 3,
      lifeEnergy: 2,
      lifeDueDay: '2026-03-31',
      lifeLocationIds: ['office'],
      lifeRequirementIds: ['laptop'],
      lifeIsNextAction: true,
      lifeWaitingFor: 'Client reply',
      lifeFollowUpDay: '2026-04-02',
      lifeBlockedByTaskIds: ['dependency-1'],
      lifeReviewDay: '2026-04-07',
    });
  });

  it('stores recurring LifeOS dates as occurrence-relative offsets', () => {
    const template = getLifeOsRepeatTemplateFields(task, '2026-03-30');

    expect(template.lifeDueDayOffset).toBe(1);
    expect(template.lifeFollowUpDayOffset).toBe(3);
    expect(template.lifeReviewDayOffset).toBe(8);
  });

  it('shifts recurring LifeOS dates with each occurrence across month boundaries', () => {
    const template = getLifeOsRepeatTemplateFields(task, '2026-03-30');
    const next = applyLifeOsRepeatTemplateFields(template, '2026-04-30');

    expect(next.lifeDueDay).toBe('2026-05-01');
    expect(next.lifeFollowUpDay).toBe('2026-05-03');
    expect(next.lifeReviewDay).toBe('2026-05-08');
    expect(next.lifePriorityId).toBe('priority-high');
    expect(next.lifeLocationIds).toEqual(['office']);
    expect(next.lifeRequirementIds).toEqual(['laptop']);
    expect(next.lifeIsNextAction).toBe(true);
    expect(next.lifeWaitingFor).toBe('Client reply');
  });

  it('preserves explicit null dates', () => {
    const nullDateTask: Task = {
      ...task,
      lifeDueDay: null,
      lifeFollowUpDay: null,
      lifeReviewDay: null,
    };
    const template = getLifeOsRepeatTemplateFields(nullDateTask, '2026-03-30');
    const next = applyLifeOsRepeatTemplateFields(template, '2026-04-30');

    expect(next.lifeDueDay).toBeNull();
    expect(next.lifeFollowUpDay).toBeNull();
    expect(next.lifeReviewDay).toBeNull();
  });

  it('does not override task defaults for legacy templates without LifeOS fields', () => {
    expect(applyLifeOsRepeatTemplateFields({}, '2026-04-30')).toEqual({});
  });
});
