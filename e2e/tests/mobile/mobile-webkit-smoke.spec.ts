import { expect, test } from '../../fixtures/test.fixture';

test.describe('Mobile WebKit smoke', () => {
  test('supports touch navigation and task creation', async ({ page, testPrefix }) => {
    const mobileNav = page.locator('mobile-bottom-nav');
    await expect(mobileNav).toBeVisible();

    await mobileNav.getByRole('button', { name: 'Goals', exact: true }).tap();
    await expect(page).toHaveURL(/\/#\/goals/);
    await expect(page.locator('goals-page')).toBeVisible();

    await mobileNav.getByRole('button', { name: 'Today', exact: true }).tap();
    await expect(page).toHaveURL(/\/#\/life-today/);
    await expect(page.locator('life-today-page')).toBeVisible();

    await mobileNav.getByRole('button', { name: 'Add new task', exact: true }).tap();
    const taskTitle = `${testPrefix}-MobileWebKit`;
    const addTaskInput = page.locator('add-task-bar.global .main-input');
    await expect(addTaskInput).toBeVisible();
    await addTaskInput.fill(taskTitle);
    await page.locator('.e2e-add-task-submit').tap();

    await expect(page.getByText(taskTitle, { exact: true }).first()).toBeVisible();
  });
});
