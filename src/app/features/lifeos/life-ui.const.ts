import { LifeContextOption, LifeOsConfig } from './life-os.model';

export interface LifePickerOption {
  id: string;
  label: string;
  icon?: string;
  color?: string;
}

const PRIORITY_COLORS = ['#ef5350', '#ff9800', '#42a5f5', '#ab47bc', '#26a69a'];
const CONTEXT_COLORS = [
  '#42a5f5',
  '#26a69a',
  '#7e57c2',
  '#ff9800',
  '#ec407a',
  '#66bb6a',
  '#5c6bc0',
];

export const LIFE_FOCUS_OPTIONS: LifePickerOption[] = [
  { id: '1', label: '1 / 5', icon: 'psychology', color: '#26a69a' },
  { id: '2', label: '2 / 5', icon: 'psychology', color: '#42a5f5' },
  { id: '3', label: '3 / 5', icon: 'psychology', color: '#7e57c2' },
  { id: '4', label: '4 / 5', icon: 'psychology', color: '#ab47bc' },
  { id: '5', label: '5 / 5', icon: 'psychology', color: '#ec407a' },
];

export const LIFE_ENERGY_OPTIONS: LifePickerOption[] = [
  { id: '1', label: '1 / 5', icon: 'battery_1_bar', color: '#78909c' },
  { id: '2', label: '2 / 5', icon: 'battery_2_bar', color: '#66bb6a' },
  { id: '3', label: '3 / 5', icon: 'battery_4_bar', color: '#fbc02d' },
  { id: '4', label: '4 / 5', icon: 'battery_5_bar', color: '#ff9800' },
  { id: '5', label: '5 / 5', icon: 'bolt', color: '#ef5350' },
];

export const lifePriorityPickerOptions = (config: LifeOsConfig): LifePickerOption[] =>
  config.priorityLevels.map((level, index) => ({
    id: level.id,
    label: level.label,
    icon: 'circle',
    color: PRIORITY_COLORS[index % PRIORITY_COLORS.length],
  }));

export const lifeContextPickerOptions = (
  options: LifeContextOption[],
  defaultIcon: string,
): LifePickerOption[] =>
  options.map((option, index) => ({
    id: option.id,
    label: option.label,
    icon: option.icon || defaultIcon,
    color: CONTEXT_COLORS[index % CONTEXT_COLORS.length],
  }));
