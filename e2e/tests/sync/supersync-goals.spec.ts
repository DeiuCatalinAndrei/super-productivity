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

const taskRow = (page: Page, goalTitle: string, taskTitle: string): Locator =>
  goalCard(page, goalTitle).locator('.task-row').filter({ hasText: taskTitle }).first();

const openTaskMeta = async (
  page: Page,
  goalTitle: string,
  taskTitle: string,
): Promise<Locator> => {
  await taskRow(page, goalTitle, taskTitle).click();
  const meta = page.locator('life-task-meta').first();
  await expect(meta).toBeVisible();
  return meta;
};

const setDateField = async (field: Locator, value: string): Promise<void> => {
  // Dispatch the native input/change sequence in one DOM operation. Angular may
  // recreate the selected-task panel after a task update, so a second locator
  // action against the pre-update field can otherwise race with that rerender.
  await field.evaluate((input, nextValue) => {
    const element = input as HTMLInputElement;
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

const setTextField = async (field: Locator, value: string): Promise<void> => {
  await field.evaluate((input, nextValue) => {
    const element = input as HTMLInputElement;
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

const setGoalDate = async (
  page: Page,
  title: string,
  inputIndex: number,
  value: string,
): Promise<void> => {
  const input = goalCard(page, title).locator('input[type="date"]').nth(inputIndex);
  await setDateField(input, value);
};

test.describe('@supersync native Goals v2', () => {
  test('hierarchy task intelligence dates and completion round-trip between two clients', async ({
    browser,
    baseURL,
    testRunId,
  }) => {
    let clientA: SimulatedE2EClient | null = null;
    let clientB: SimulatedE2EClient | null = null;

    const goalTitle = `Goal-${testRunId}`;
    const subgoalTitle = `Subgoal-${testRunId}`;
    const blockerTitle = `Blocker-${testRunId}`;
    const directTaskTitle = `DirectTask-${testRunId}`;
    const targetDay = '2030-06-15';
    const initialDeadline = '2030-06-30';
    const updatedDeadline = '2030-07-05';
    const softDueDay = '2030-06-20';
    const reviewDay = '2030-06-10';
    const followUpDay = '2030-06-11';
    const updatedFollowUpDay = '2030-06-12';
    const waitingA = `Approval-${testRunId}`;
    const waitingB = `Vendor-${testRunId}`;

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
      await savePrompt(clientA.page, blockerTitle);
      await expect(goalCard(clientA.page, goalTitle)).toContainText(blockerTitle);

      await goalCard(clientA.page, goalTitle)
        .getByRole('button', { name: /^Add Task$/ })
        .first()
        .click();
      await savePrompt(clientA.page, directTaskTitle);
      await expect(goalCard(clientA.page, goalTitle)).toContainText(directTaskTitle);

      const metaA = await openTaskMeta(clientA.page, goalTitle, directTaskTitle);
      await metaA.getByLabel('Priority').selectOption('p1');
      await metaA.getByLabel('Focus').selectOption('4');
      await metaA.getByLabel('Energy').selectOption('2');
      await setDateField(metaA.getByLabel('Due date'), softDueDay);

      // Metadata updates keep the selected task open. Keep editing through the same
      // locator so this test also guards against regressions that close/reset the panel.
      await expect(metaA.getByLabel('Priority')).toHaveValue('p1');
      await expect(metaA.getByLabel('Focus')).toHaveValue('4');
      await expect(metaA.getByLabel('Energy')).toHaveValue('2');
      await expect(metaA.getByLabel('Due date')).toHaveValue(softDueDay);
      await metaA.getByLabel('Location').selectOption(['home']);
      await metaA.getByLabel('Requires').selectOption(['computer']);
      await metaA.getByRole('checkbox', { name: /Next action/ }).check();
      await setTextField(metaA.getByLabel('Waiting for'), waitingA);
      await setDateField(metaA.getByLabel('Follow up'), followUpDay);
      await metaA.getByLabel('Blocked by').selectOption({ label: blockerTitle });
      await setDateField(metaA.getByLabel('Review date'), reviewDay);

      await expect(taskRow(clientA.page, goalTitle, directTaskTitle)).toContainText('P1');
      await expect(taskRow(clientA.page, goalTitle, directTaskTitle)).toContainText('F4');
      await expect(taskRow(clientA.page, goalTitle, directTaskTitle)).toContainText('E2');
      await expect(taskRow(clientA.page, goalTitle, directTaskTitle)).toContainText(
        'Next',
      );

      await clientA.sync.syncAndWait();

      clientB = await createSimulatedClient(browser, baseURL!, 'B', testRunId);
      await clientB.sync.setupSuperSync(syncConfig);
      await clientB.sync.syncAndWait();
      await clientB.page.goto('/#/goals');
      await clientB.page.waitForLoadState('networkidle');

      // Rehydrate the second client from persisted local state before asserting.
      // This catches fields that appear immediately after sync but fail to survive
      // an application reload/restart.
      await clientB.page.reload();
      await clientB.page.waitForLoadState('networkidle');

      await expect(goalCard(clientB.page, goalTitle)).toBeVisible();
      await expect(goalCard(clientB.page, subgoalTitle)).toBeVisible();
      await expect(goalCard(clientB.page, goalTitle)).toContainText(blockerTitle);
      await expect(goalCard(clientB.page, goalTitle)).toContainText(directTaskTitle);
      await expect(
        goalCard(clientB.page, goalTitle).locator('input[type="date"]').nth(0),
      ).toHaveValue(targetDay);
      await expect(
        goalCard(clientB.page, goalTitle).locator('input[type="date"]').nth(1),
      ).toHaveValue(initialDeadline);

      const metaB = await openTaskMeta(clientB.page, goalTitle, directTaskTitle);
      await expect(metaB.getByLabel('Priority')).toHaveValue('p1');
      await expect(metaB.getByLabel('Focus')).toHaveValue('4');
      await expect(metaB.getByLabel('Energy')).toHaveValue('2');
      await expect(metaB.getByLabel('Due date')).toHaveValue(softDueDay);
      await expect(metaB.getByLabel('Location')).toHaveValues(['home']);
      await expect(metaB.getByLabel('Requires')).toHaveValues(['computer']);
      await expect(metaB.getByRole('checkbox', { name: /Next action/ })).toBeChecked();
      await expect(metaB.getByLabel('Waiting for')).toHaveValue(waitingA);
      await expect(metaB.getByLabel('Follow up')).toHaveValue(followUpDay);
      await expect(metaB.getByLabel('Blocked by').locator('option:checked')).toHaveText(
        blockerTitle,
      );
      await expect(metaB.getByLabel('Review date')).toHaveValue(reviewDay);

      await metaB.getByLabel('Focus').selectOption('5');
      await metaB.getByLabel('Energy').selectOption('3');
      await setTextField(metaB.getByLabel('Waiting for'), waitingB);
      await setDateField(metaB.getByLabel('Follow up'), updatedFollowUpDay);
      await setGoalDate(clientB.page, goalTitle, 1, updatedDeadline);
      await clientB.sync.syncAndWait();

      await clientA.sync.syncAndWait();
      await clientA.page.goto('/#/goals');
      await clientA.page.waitForLoadState('networkidle');

      await expect(
        goalCard(clientA.page, goalTitle).locator('input[type="date"]').nth(1),
      ).toHaveValue(updatedDeadline);
      const roundTripMetaA = await openTaskMeta(clientA.page, goalTitle, directTaskTitle);
      await expect(roundTripMetaA.getByLabel('Priority')).toHaveValue('p1');
      await expect(roundTripMetaA.getByLabel('Focus')).toHaveValue('5');
      await expect(roundTripMetaA.getByLabel('Energy')).toHaveValue('3');
      await expect(roundTripMetaA.getByLabel('Waiting for')).toHaveValue(waitingB);
      await expect(roundTripMetaA.getByLabel('Follow up')).toHaveValue(updatedFollowUpDay);
      await expect(roundTripMetaA.getByLabel('Due date')).toHaveValue(softDueDay);
      await expect(roundTripMetaA.getByLabel('Review date')).toHaveValue(reviewDay);

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
