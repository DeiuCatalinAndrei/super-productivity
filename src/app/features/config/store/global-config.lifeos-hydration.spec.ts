import { AppDataComplete } from '../../../op-log/model/model-config';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { DEFAULT_GLOBAL_CONFIG } from '../default-global-config.const';
import {
  globalConfigReducer,
  initialGlobalConfigState,
} from './global-config.reducer';

describe('LifeOS global config hydration', () => {
  const createLegacyConfigWithoutLifeOs = () => {
    const legacyTasks = { ...initialGlobalConfigState.tasks };
    delete legacyTasks.lifeOs;

    return {
      ...initialGlobalConfigState,
      tasks: legacyTasks,
    };
  };

  it('backfills LifeOS defaults for snapshots created before LifeOS existed', () => {
    const legacyConfig = createLegacyConfigWithoutLifeOs();

    const result = globalConfigReducer(
      initialGlobalConfigState,
      loadAllData({
        appDataComplete: { globalConfig: legacyConfig } as AppDataComplete,
      }),
    );

    expect(legacyConfig.tasks.lifeOs).toBeUndefined();
    expect(result.tasks.lifeOs).toEqual(DEFAULT_GLOBAL_CONFIG.tasks.lifeOs);
  });

  it('is idempotent when the same legacy snapshot is hydrated more than once', () => {
    const legacyConfig = createLegacyConfigWithoutLifeOs();
    const action = loadAllData({
      appDataComplete: { globalConfig: legacyConfig } as AppDataComplete,
    });

    const firstHydration = globalConfigReducer(initialGlobalConfigState, action);
    const secondHydration = globalConfigReducer(firstHydration, action);

    expect(secondHydration.tasks).toEqual(firstHydration.tasks);
    expect(secondHydration.tasks.lifeOs).toEqual(DEFAULT_GLOBAL_CONFIG.tasks.lifeOs);
  });
});
