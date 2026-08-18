import { type Locator, type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/supersync.fixture';
import {
  closeClient,
  createSimulatedClient,
  createTestUser,
  getSuperSyncConfig,
  type SimulatedE2EClient,
} from '../../utils/supersync-helpers';

const savePrompt = async (page: Page, value: string): Promise<void> => {
  const dialog = page.locator('mat-dialog-container');
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  await dialog.locator('input').first().fill(value);
  await dialog.locator('button[mat-flat-button]').click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
};

const goalCard = (page: Page, title: string): Locator =>
  page.locator('.goal-card').filter({ hasText: title }).first();

const setGoalDate = async (
  page: Page,
  title: string,
  inputIndex: number,
  value: string,
): Promise<void> => {
  const input = goalCard(page, title).locator('input[type="date"]').nth(inputIndex);
  await input.fill(value);
  await input.dispatchEvent('change');
  await expect(input).toHaveValue(value);
};

test.describe('@supersync native Goals v2', () => {
  test('hierarchy direct tasks dates and completion round-trip between two clients', async ({
    browser,
    baseURL,
    testRunId,
  }) => {
    let clientA: SimulatedE2EClient | null = null;
    let clientB: SimulatedE2EClient | null = null;

    const goalTitle = `Goal-${testRunId}`;
    const subgoalTitle = `Subgoal-${testRunId}`;
    const directTaskTitle = `DirectTask-${testRunId}`;
    const targetDay = '2030-06-15';
    const initialDeadline = '2030-06-30';
    const updatedDeadline = '2030-07-05';

    try {
      const user = await createTestUser(testRunId);
      const syncConfig = getSuperSyncConfig(user);

      clientA = await createSimulatedClient(browser, baseURL!, 'A', testRunId);
      await clientA.sync.setupSuperSync(syncConfig);
      await clientA.page.goto('/#/goals');
      await clientA.page.waitForLoadState('networkidle');

      await clientA.page.getByRole('button', { name: /New Goal/ }).click();
      await savePrompt(clientA.page, goalTitle);
      await expect(goalCard(clientA.page, goalTitle)).toBeVisible();

      await setGoalDate(clientA.page, goalTitle, 0, targetDay);
      await setGoalDate(clientA.page, goalTitle, 1, initialDeadline);

      await goalCard(clientA.page, goalTitle)
        .getByRole('button', { name: /Add Subgoal/ })
        .click();
      await savePrompt(clientA.page, subgoalTitle);
      await expect(goalCard(clientA.page, subgoalTitle)).toBeVisible();

      await goalCard(clientA.page, goalTitle)
        .getByRole('button', { name: /^Add Task$/ })
        .first()
        .click();
      await savePrompt(clientA.page, directTaskTitle);
      await expect(goalCard(clientA.page, goalTitle)).toContainText(directTaskTitle);

      await clientA.sync.syncAndWait();

      clientB = await createSimulatedClient(browser, baseURL!, 'B', testRunId);
      await clientB.sync.setupSuperSync(syncConfig);
      await clientB.sync.syncAndWait();
      await clientB.page.goto('/#/goals');
      await clientB.page.waitForLoadState('networkidle');

      await expect(goalCard(clientB.page, goalTitle)).toBeVisible();
      await expect(goalCard(clientB.page, subgoalTitle)).toBeVisible();
      await expect(goalCard(clientB.page, goalTitle)).toContainText(directTaskTitle);
      await expect(
        goalCard(clientB.page, goalTitle).locator('input[type="date"]').nth(0),
      ).toHaveValue(targetDay);
      await expect(
        goalCard(clientB.page, goalTitle).locator('input[type="date"]').nth(1),
      ).toHaveValue(initialDeadline);

      await setGoalDate(clientB.page, goalTitle, 1, updatedDeadline);
      await clientB.sync.syncAndWait();

      await clientA.sync.syncAndWait();
      await clientA.page.goto('/#/goals');
      await clientA.page.waitForLoadState('networkidle');

      await expect(
        goalCard(clientA.page, goalTitle).locator('input[type="date"]').nth(1),
      ).toHaveValue(updatedDeadline);
      await expect(goalCard(clientA.page, subgoalTitle)).toBeVisible();
      await expect(goalCard(clientA.page, goalTitle)).toContainText(directTaskTitle);

      await goalCard(clientA.page, goalTitle)
        .getByRole('button', { name: /^Complete$/ })
        .click();
      await clientA.sync.syncAndWait();

      await clientB.sync.syncAndWait();
      await clientB.page.goto('/#/goals');
      await clientB.page.waitForLoadState('networkidle');
      await expect(goalCard(clientB.page, goalTitle)).toContainText('Completed');

      await goalCard(clientB.page, goalTitle)
        .getByRole('button', { name: /^Reopen$/ })
        .click();
      await clientB.sync.syncAndWait();

      await clientA.sync.syncAndWait();
      await clientA.page.goto('/#/goals');
      await clientA.page.waitForLoadState('networkidle');
      await expect(
        goalCard(clientA.page, goalTitle).getByRole('button', { name: /^Complete$/ }),
      ).toBeVisible();
    } finally {
      if (clientA) await closeClient(clientA);
      if (clientB) await closeClient(clientB);
    }
  });
});
