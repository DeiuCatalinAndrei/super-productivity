import { LifeOsConfig } from './life-os.model';

export const DEFAULT_LIFE_OS_CONFIG: LifeOsConfig = {
  priorityLevels: [
    { id: 'p1', label: 'P1' },
    { id: 'p2', label: 'P2' },
    { id: 'p3', label: 'P3' },
  ],
  defaultPriorityId: 'p2',
  locations: [
    { id: 'anywhere', label: 'Anywhere', icon: 'public' },
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'office', label: 'Office', icon: 'business' },
    { id: 'errands', label: 'Errands', icon: 'shopping_bag' },
    { id: 'gym', label: 'Gym', icon: 'fitness_center' },
  ],
  requirements: [
    { id: 'any', label: 'Any', icon: 'apps' },
    { id: 'phone', label: 'Phone', icon: 'smartphone' },
    { id: 'computer', label: 'Computer', icon: 'computer' },
    { id: 'tablet', label: 'Tablet', icon: 'tablet' },
    { id: 'offline', label: 'Offline', icon: 'cloud_off' },
  ],
  smartViews: [
    {
      id: 'on-the-go',
      label: 'On the Go',
      icon: 'directions_walk',
      locationIds: ['anywhere', 'errands'],
      requirementIds: ['any', 'phone'],
      maxEstimateMinutes: 30,
      maxFocus: 3,
      maxEnergy: 3,
    },
    {
      id: 'office',
      label: 'Office',
      icon: 'business',
      locationIds: ['office', 'anywhere'],
    },
    {
      id: 'home',
      label: 'Home',
      icon: 'home',
      locationIds: ['home', 'anywhere'],
    },
    {
      id: 'quick-wins',
      label: 'Quick Wins',
      icon: 'bolt',
      maxEstimateMinutes: 15,
      maxFocus: 2,
      maxEnergy: 2,
    },
    {
      id: 'deep-work',
      label: 'Deep Work',
      icon: 'psychology',
      minFocus: 4,
    },
    {
      id: 'low-energy',
      label: 'Low Energy',
      icon: 'battery_2_bar',
      maxEnergy: 2,
    },
  ],
  weeklyReviewDay: 0,
  lastWeeklyReviewAt: null,
};
