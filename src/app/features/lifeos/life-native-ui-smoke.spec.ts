import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from './life-ui.const';
import { DEFAULT_LIFE_OS_CONFIG } from './life-os.const';

describe('LifeOS native UI options', () => {
  it('provides colored priority, focus, energy and context picker options', () => {
    expect(lifePriorityPickerOptions(DEFAULT_LIFE_OS_CONFIG)).toHaveSize(3);
    expect(
      lifePriorityPickerOptions(DEFAULT_LIFE_OS_CONFIG).every((o) => !!o.color),
    ).toBeTrue();
    expect(LIFE_FOCUS_OPTIONS).toHaveSize(5);
    expect(LIFE_FOCUS_OPTIONS.every((o) => !!o.icon && !!o.color)).toBeTrue();
    expect(LIFE_ENERGY_OPTIONS).toHaveSize(5);
    expect(LIFE_ENERGY_OPTIONS.every((o) => !!o.icon && !!o.color)).toBeTrue();
    expect(
      lifeContextPickerOptions(DEFAULT_LIFE_OS_CONFIG.requirements, 'build').every(
        (o) => !!o.icon && !!o.color,
      ),
    ).toBeTrue();
  });
});
