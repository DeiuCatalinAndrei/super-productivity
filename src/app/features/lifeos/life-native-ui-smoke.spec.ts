import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from './life-ui.const';
import { DEFAULT_LIFE_OS_CONFIG } from './life-os.const';

describe('LifeOS native UI options', () => {
  it('provides colored priority, focus, energy and context picker options', () => {
    const priorities = lifePriorityPickerOptions(DEFAULT_LIFE_OS_CONFIG);
    const requirements = lifeContextPickerOptions(
      DEFAULT_LIFE_OS_CONFIG.requirements,
      'build',
    );

    expect(priorities).toHaveSize(DEFAULT_LIFE_OS_CONFIG.priorityLevels.length);
    expect(priorities.every((option) => !!option.color)).toBeTrue();
    expect(LIFE_FOCUS_OPTIONS).toHaveSize(5);
    expect(
      LIFE_FOCUS_OPTIONS.every((option) => !!option.icon && !!option.color),
    ).toBeTrue();
    expect(LIFE_ENERGY_OPTIONS).toHaveSize(5);
    expect(
      LIFE_ENERGY_OPTIONS.every((option) => !!option.icon && !!option.color),
    ).toBeTrue();
    expect(requirements).toHaveSize(DEFAULT_LIFE_OS_CONFIG.requirements.length);
    expect(requirements.every((option) => !!option.icon && !!option.color)).toBeTrue();
  });
});
