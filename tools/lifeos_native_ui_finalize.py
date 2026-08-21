from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

today_path = ROOT / 'src/app/pages/life-today-page/life-today-page.component.ts'
today = today_path.read_text(encoding='utf-8')
old = '''            </div>
            </div>
          </div>

          <div class="recommendations-list">'''
new = '''            </div>
          </div>

          <div class="recommendations-list">'''
if old not in today:
    raise RuntimeError('Expected duplicated Today closing tag was not found')
today_path.write_text(today.replace(old, new, 1), encoding='utf-8')

settings_path = ROOT / 'src/app/pages/life-settings-page/life-settings-page.component.ts'
settings = settings_path.read_text(encoding='utf-8')
unused_weekdays = '''  readonly weekDays = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];
'''
settings_path.write_text(settings.replace(unused_weekdays, '', 1), encoding='utf-8')

for rel in [
    'src/app/features/lifeos/life-task-meta.component.ts',
    'src/app/features/tasks/add-task-bar/add-task-bar.component.html',
    'src/app/pages/goals-page/goals-page.component.ts',
    'src/app/pages/life-today-page/life-today-page.component.ts',
    'src/app/pages/life-settings-page/life-settings-page.component.ts',
]:
    content = (ROOT / rel).read_text(encoding='utf-8')
    if re.search(r'<select(?:\s|>)', content):
        raise RuntimeError(f'Browser-native select still present in {rel}')
    if 'type="date"' in content:
        raise RuntimeError(f'Browser-native date input still present in {rel}')

print('LifeOS native UI finalizer passed')
