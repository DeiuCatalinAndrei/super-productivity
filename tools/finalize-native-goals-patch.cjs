const fs = require('node:fs');

const pagePath = 'src/app/pages/goals-page/goals-page.component.ts';
let s = fs.readFileSync(pagePath, 'utf8');

const oldImport =
  "import { addProject, updateProject } from '../../features/project/store/project.actions';";
const newImport = `import {
  addProject,
  completeProject,
  reopenProject,
  updateProject,
} from '../../features/project/store/project.actions';`;
if (!s.includes(oldImport)) throw new Error('project action import marker not found');
s = s.replace(oldImport, newImport);

const actionMarker = `                <button
                  mat-button
                  (click)="rename(node.project)"
                >
                  <mat-icon>edit</mat-icon>
                  Redenumește
                </button>`;
const completionUi = `                @if (node.project.lifeType !== 'project') {
                  @if (node.project.isDone) {
                    <button
                      mat-button
                      (click)="reopen(node.project)"
                    >
                      <mat-icon>restart_alt</mat-icon>
                      Redeschide
                    </button>
                  } @else {
                    <button
                      mat-flat-button
                      color="primary"
                      (click)="complete(node.project)"
                    >
                      <mat-icon>verified</mat-icon>
                      Finalizează
                    </button>
                  }
                }
${actionMarker}`;
if (!s.includes(actionMarker)) throw new Error('goal actions marker not found');
s = s.replace(actionMarker, completionUi);

const methodMarker = `  rename(project: Project): void {
    void this._promptTitle('Nume', project.title).then((title) => {`;
const methods = `  complete(project: Project): void {
    this._store.dispatch(completeProject({ id: project.id, doneOn: Date.now() }));
  }

  reopen(project: Project): void {
    this._store.dispatch(reopenProject({ id: project.id }));
  }

${methodMarker}`;
if (!s.includes(methodMarker)) throw new Error('rename method marker not found');
s = s.replace(methodMarker, methods);
fs.writeFileSync(pagePath, s);

const e2ePath = 'e2e/tests/sync/supersync-goals.spec.ts';
let t = fs.readFileSync(e2ePath, 'utf8');
const endMarker = `      await expect(goalCard(clientA.page, subgoalTitle)).toBeVisible();
    } finally {`;
const completionTest = `      await expect(goalCard(clientA.page, subgoalTitle)).toBeVisible();

      await goalCard(clientA.page, goalTitle)
        .getByRole('button', { name: /Finalizează/ })
        .click();
      await clientA.sync.syncAndWait();

      await clientB.sync.syncAndWait();
      await clientB.page.goto('/#/goals');
      await clientB.page.waitForLoadState('networkidle');
      await expect(goalCard(clientB.page, goalTitle)).toContainText('Finalizat');

      await goalCard(clientB.page, goalTitle)
        .getByRole('button', { name: /Redeschide/ })
        .click();
      await clientB.sync.syncAndWait();

      await clientA.sync.syncAndWait();
      await clientA.page.goto('/#/goals');
      await clientA.page.waitForLoadState('networkidle');
      await expect(
        goalCard(clientA.page, goalTitle).getByRole('button', { name: /Finalizează/ }),
      ).toBeVisible();
    } finally {`;
if (!t.includes(endMarker)) throw new Error('supersync end marker not found');
t = t.replace(endMarker, completionTest);
fs.writeFileSync(e2ePath, t);
