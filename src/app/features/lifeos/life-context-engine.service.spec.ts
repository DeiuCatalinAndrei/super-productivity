import { TestBed } from '@angular/core/testing';
import { Task } from '../tasks/task.model';
import { DEFAULT_LIFE_OS_CONFIG } from './life-os.const';
import { LifeContextEngineService } from './life-context-engine.service';

const task = (overrides: Partial<Task>): Task =>
  ({
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? 'Task',
    isDone: false,
    projectId: 'INBOX',
    timeEstimate: 0,
    timeSpentOnDay: {},
    attachments: [],
    ...overrides,
  }) as Task;

describe('LifeContextEngineService', () => {
  let service: LifeContextEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LifeContextEngineService);
  });

  it('ranks urgent next actions above ordinary work', () => {
    const tasks = [
      task({ id: 'ordinary', title: 'Ordinary', lifePriorityId: 'p2' }),
      task({
        id: 'urgent',
        title: 'Urgent',
        lifePriorityId: 'p1',
        lifeIsNextAction: true,
        deadlineDay: '2026-08-20',
      }),
    ];

    const ranked = service.rankTasks(tasks, DEFAULT_LIFE_OS_CONFIG, {
      day: '2026-08-20',
      availableMinutes: 60,
      focus: 4,
      energy: 4,
      locationIds: [],
      requirementIds: [],
    });

    expect(ranked.map((item) => item.task.id)).toEqual(['urgent', 'ordinary']);
    expect(ranked[0].reasons).toContain('Next action');
    expect(ranked[0].reasons).toContain('Deadline today');
  });

  it('excludes waiting and actively blocked work', () => {
    const blocker = task({ id: 'blocker' });
    const blocked = task({ id: 'blocked', lifeBlockedByTaskIds: ['blocker'] });
    const waiting = task({ id: 'waiting', lifeWaitingFor: 'Reply from Alex' });
    const ready = task({ id: 'ready', lifeIsNextAction: true });

    const ranked = service.rankTasks(
      [blocker, blocked, waiting, ready],
      DEFAULT_LIFE_OS_CONFIG,
      {
        day: '2026-08-20',
        availableMinutes: null,
        focus: null,
        energy: null,
        locationIds: [],
        requirementIds: [],
      },
    );

    expect(ranked.map((item) => item.task.id)).not.toContain('blocked');
    expect(ranked.map((item) => item.task.id)).not.toContain('waiting');
  });

  it('filters tasks that cannot be done in the active location', () => {
    const home = task({ id: 'home', lifeLocationIds: ['home'] });
    const office = task({ id: 'office', lifeLocationIds: ['office'] });
    const anywhere = task({ id: 'anywhere', lifeLocationIds: ['anywhere'] });

    const ranked = service.rankTasks(
      [home, office, anywhere],
      DEFAULT_LIFE_OS_CONFIG,
      {
        day: '2026-08-20',
        availableMinutes: null,
        focus: null,
        energy: null,
        locationIds: ['office'],
        requirementIds: [],
      },
    );

    expect(ranked.map((item) => item.task.id)).toContain('office');
    expect(ranked.map((item) => item.task.id)).toContain('anywhere');
    expect(ranked.map((item) => item.task.id)).not.toContain('home');
  });

  it('detects direct and transitive dependency cycles', () => {
    const a = task({ id: 'a', lifeBlockedByTaskIds: ['b'] });
    const b = task({ id: 'b', lifeBlockedByTaskIds: ['c'] });
    const c = task({ id: 'c' });

    expect(service.wouldCreateDependencyCycle('a', 'a', [a, b, c])).toBeTrue();
    expect(service.wouldCreateDependencyCycle('c', 'a', [a, b, c])).toBeTrue();
    expect(service.wouldCreateDependencyCycle('a', 'c', [a, b, c])).toBeFalse();
  });
});