import { Injectable } from '@angular/core';
import { Task } from '../tasks/task.model';
import { LifeOsConfig } from './life-os.model';

export interface LifeCurrentContext {
  day: string;
  availableMinutes: number | null;
  focus: number | null;
  energy: number | null;
  locationIds: string[];
  requirementIds: string[];
}

export interface LifeTaskRecommendation {
  task: Task;
  score: number;
  reasons: string[];
}

@Injectable({ providedIn: 'root' })
export class LifeContextEngineService {
  rankTasks(
    tasks: Task[],
    config: LifeOsConfig,
    context: LifeCurrentContext,
    limit = 5,
  ): LifeTaskRecommendation[] {
    const byId = new Map(tasks.map((task) => [task.id, task]));

    return tasks
      .filter((task) => !task.isDone && !task.parentId)
      .map((task) => this._scoreTask(task, config, context, byId))
      .filter((item): item is LifeTaskRecommendation => item !== null)
      .sort(
        (a, b) =>
          b.score - a.score ||
          this._dateRank(a.task) - this._dateRank(b.task) ||
          a.task.title.localeCompare(b.task.title),
      )
      .slice(0, Math.max(0, limit));
  }

  isTaskBlocked(task: Task, tasks: Task[]): boolean {
    const byId = new Map(tasks.map((item) => [item.id, item]));
    return this._isBlocked(task, byId);
  }

  wouldCreateDependencyCycle(taskId: string, blockerId: string, tasks: Task[]): boolean {
    if (taskId === blockerId) return true;
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const seen = new Set<string>();
    const stack = [blockerId];

    while (stack.length) {
      const currentId = stack.pop()!;
      if (currentId === taskId) return true;
      if (seen.has(currentId)) continue;
      seen.add(currentId);
      const current = byId.get(currentId);
      if (!current) continue;
      for (const dependencyId of current.lifeBlockedByTaskIds || []) {
        stack.push(dependencyId);
      }
    }

    return false;
  }

  private _scoreTask(
    task: Task,
    config: LifeOsConfig,
    context: LifeCurrentContext,
    byId: Map<string, Task>,
  ): LifeTaskRecommendation | null {
    if (this._isBlocked(task, byId)) return null;

    const isWaiting = !!task.lifeWaitingFor?.trim();
    const followUpDays = task.lifeFollowUpDay
      ? this._daysBetween(context.day, task.lifeFollowUpDay)
      : null;
    const isFollowUpDue = isWaiting && followUpDays != null && followUpDays <= 0;
    if (isWaiting && !isFollowUpDue) return null;
    if (!this._matchesContext(task, context)) return null;

    let score = 0;
    const reasons: string[] = [];

    if (isFollowUpDue && followUpDays != null) {
      score += followUpDays < 0 ? 38 : 34;
      reasons.push(followUpDays < 0 ? 'Follow-up overdue' : 'Follow up today');
    }

    const priorityId = task.lifePriorityId || config.defaultPriorityId;
    const priorityIndex = config.priorityLevels.findIndex(
      (level) => level.id === priorityId,
    );
    if (priorityIndex >= 0) {
      score += Math.max(6, 36 - (priorityIndex * 10));
      reasons.push(config.priorityLevels[priorityIndex].label);
    }

    if (task.lifeIsNextAction && !isWaiting) {
      score += 18;
      reasons.push('Next action');
    }

    const deadlineDay =
      task.deadlineDay ||
      (task.deadlineWithTime ? this._dayForTimestamp(task.deadlineWithTime) : null);
    if (deadlineDay) {
      const days = this._daysBetween(context.day, deadlineDay);
      score += this._urgencyScore(days, true);
      reasons.push(this._urgencyLabel('Deadline', days));
    }

    if (task.lifeDueDay) {
      const days = this._daysBetween(context.day, task.lifeDueDay);
      score += this._urgencyScore(days, false);
      reasons.push(this._urgencyLabel('Due', days));
    }

    const scheduledDay =
      task.dueDay || (task.dueWithTime ? this._dayForTimestamp(task.dueWithTime) : null);
    if (scheduledDay) {
      const days = this._daysBetween(context.day, scheduledDay);
      if (days <= 0) {
        score += days < 0 ? 18 : 22;
        reasons.push(days < 0 ? 'Scheduled earlier' : 'Scheduled today');
      } else if (days === 1) {
        score += 5;
      }
    }

    score += this._capacityScore('Focus', task.lifeFocus, context.focus, reasons);
    score += this._capacityScore('Energy', task.lifeEnergy, context.energy, reasons);

    const estimateMinutes = Math.round((task.timeEstimate || 0) / 60000);
    if (context.availableMinutes != null && estimateMinutes > 0) {
      if (estimateMinutes <= context.availableMinutes) {
        score += estimateMinutes <= Math.max(15, context.availableMinutes / 2) ? 10 : 6;
        reasons.push(`Fits ${context.availableMinutes}m`);
      } else {
        const overflow = estimateMinutes - context.availableMinutes;
        score -= 16 + Math.min(24, Math.ceil(overflow / 15) * 4);
      }
    }

    if (
      !task.lifePriorityId &&
      !task.lifeIsNextAction &&
      !deadlineDay &&
      !task.lifeDueDay
    ) {
      score -= 8;
    }

    return {
      task,
      score,
      reasons: reasons.slice(0, 4),
    };
  }

  private _isBlocked(task: Task, byId: Map<string, Task>): boolean {
    return (task.lifeBlockedByTaskIds || []).some((id) => {
      const blocker = byId.get(id);
      return !!blocker && !blocker.isDone;
    });
  }

  private _matchesContext(task: Task, context: LifeCurrentContext): boolean {
    const taskLocations = task.lifeLocationIds?.length
      ? task.lifeLocationIds
      : ['anywhere'];
    if (
      context.locationIds.length &&
      !context.locationIds.includes('anywhere') &&
      !taskLocations.includes('anywhere') &&
      !taskLocations.some((id) => context.locationIds.includes(id))
    ) {
      return false;
    }

    const taskRequirements = task.lifeRequirementIds?.length
      ? task.lifeRequirementIds
      : ['any'];
    if (
      context.requirementIds.length &&
      !context.requirementIds.includes('any') &&
      !taskRequirements.includes('any') &&
      !taskRequirements.every((id) => context.requirementIds.includes(id))
    ) {
      return false;
    }

    return true;
  }

  private _capacityScore(
    label: string,
    requiredRaw: number | null | undefined,
    availableRaw: number | null,
    reasons: string[],
  ): number {
    if (availableRaw == null) return 0;
    const required = requiredRaw ?? 3;
    const available = Math.max(1, Math.min(5, availableRaw));
    if (required <= available) {
      const delta = available - required;
      const bonus = Math.max(2, 8 - (delta * 2));
      if (delta <= 1) reasons.push(`${label} fit`);
      return bonus;
    }
    return -(required - available) * 12;
  }

  private _urgencyScore(days: number, hard: boolean): number {
    if (days < 0) return hard ? 48 : 32;
    if (days === 0) return hard ? 40 : 26;
    if (days === 1) return hard ? 30 : 20;
    if (days <= 3) return hard ? 22 : 14;
    if (days <= 7) return hard ? 12 : 7;
    return 0;
  }

  private _urgencyLabel(prefix: string, days: number): string {
    if (days < 0) return `${prefix} overdue`;
    if (days === 0) return `${prefix} today`;
    if (days === 1) return `${prefix} tomorrow`;
    return `${prefix} in ${days}d`;
  }

  private _dateRank(task: Task): number {
    const day = task.lifeFollowUpDay || task.deadlineDay || task.lifeDueDay || task.dueDay;
    return day ? this._dateOrdinal(day) : Number.MAX_SAFE_INTEGER;
  }

  private _daysBetween(from: string, to: string): number {
    return this._dateOrdinal(to) - this._dateOrdinal(from);
  }

  private _dateOrdinal(day: string): number {
    const [year, month, date] = day.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, date) / 86400000);
  }

  private _dayForTimestamp(value: number): string {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
