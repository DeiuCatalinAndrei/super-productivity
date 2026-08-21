# LifeOS native UI contract

LifeOS surfaces should reuse Super Productivity UI primitives rather than browser-native form controls.

- Date-only fields use `date-picker-input`.
- Date/time scheduling continues to use the native scheduling/datetime picker flow.
- Choice fields use `life-field-picker`, which is built on Material menus and `select-option-row`, matching Project/Tag/Estimate interactions.
- Task-name multi-selection such as Blocked By uses `chip-list-input` autocomplete.
- Text and numeric fields use Material form-field/input controls.
- Priority, focus, energy, location and requirement options carry consistent icons/colors from `life-ui.const.ts`.
