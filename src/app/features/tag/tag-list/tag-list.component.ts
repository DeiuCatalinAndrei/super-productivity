import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { standardListAnimation } from '../../../ui/animations/standard-list.ani';
import { Tag, TagState } from '../tag.model';
import { ProjectState } from '../../project/project.model';
import { Task } from '../../tasks/task.model';
import { WorkContextService } from '../../work-context/work-context.service';
import { WorkContextType } from '../../work-context/work-context.model';
import { expandFadeAnimation } from '../../../ui/animations/expand.ani';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { selectTagFeatureState } from '../store/tag.reducer';
import { selectProjectFeatureState } from '../../project/store/project.selectors';
import { TagComponent, TagComponentTag } from '../tag/tag.component';
import { DEFAULT_PROJECT_COLOR } from '../../work-context/work-context.const';
import { DEFAULT_PROJECT_ICON } from '../../project/project.const';
import {
  ISSUE_PROVIDER_ICON_MAP,
  ISSUE_PROVIDER_HUMANIZED,
} from '../../issue/issue.const';
import { BuiltInIssueProviderKey } from '../../issue/issue.model';
import { PluginIssueProviderRegistryService } from '../../../plugins/issue-provider/plugin-issue-provider-registry.service';
import { selectTaskRepeatCfgFeatureState } from '../../task-repeat-cfg/store/task-repeat-cfg.selectors';
import { TaskRepeatCfgState } from '../../task-repeat-cfg/task-repeat-cfg.model';
import { getTaskRepeatInfoText } from '../../tasks/task-detail-panel/get-task-repeat-info-text.util';
import { TranslateService } from '@ngx-translate/core';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { TaskService } from '../../tasks/task.service';
import { LifeOsConfigService } from '../../lifeos/life-os-config.service';
import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  LifePickerOption,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from '../../lifeos/life-ui.const';
import { of } from 'rxjs';

@Component({
  selector: 'tag-list',
  templateUrl: './tag-list.component.html',
  styleUrls: ['./tag-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [standardListAnimation, expandFadeAnimation],
  imports: [TagComponent],
})
export class TagListComponent {
  private readonly _store = inject(Store);
  private readonly _workContextService = inject(WorkContextService);
  private readonly _pluginRegistry = inject(PluginIssueProviderRegistryService);
  private readonly _translateService = inject(TranslateService);
  private readonly _dateTimeFormatService = inject(DateTimeFormatService);
  private readonly _taskService = inject(TaskService);
  private readonly _lifeConfig = inject(LifeOsConfigService);

  task = input.required<Task>();

  tagsToHide = input<string[]>();

  isShowCurrentContextTag = input(false);
  isShowProjectTagAlways = input(false);
  isShowProjectTagNever = input(false);

  workContext = toSignal(this._workContextService.activeWorkContextTypeAndId$);

  tagState = toSignal(this._store.select(selectTagFeatureState), {
    initialValue: { ids: [], entities: {} } as TagState,
  });
  projectState = toSignal(this._store.select(selectProjectFeatureState), {
    initialValue: { ids: [], entities: {} } as ProjectState,
  });
  repeatCfgState = toSignal(this._store.select(selectTaskRepeatCfgFeatureState), {
    initialValue: { ids: [], entities: {} } as TaskRepeatCfgState,
  });
  private readonly _allTasks = toSignal(this._taskService.allTasks$ ?? of([] as Task[]), {
    initialValue: [] as Task[],
  });

  tagIds = computed<string[]>(() => this.task().tagIds || []);

  tags = computed<Tag[]>(() => {
    const tagsToHide = this.tagsToHide();
    const tagIdsFiltered: string[] = !!tagsToHide
      ? tagsToHide.length > 0
        ? this.tagIds().filter((id) => !tagsToHide.includes(id))
        : this.tagIds()
      : this.tagIds().filter((id) => id !== this.workContext()?.activeId);

    // sort alphabetically by title
    const tagsI = tagIdsFiltered
      .map((id) => this.tagState()?.entities[id])
      .filter((tag): tag is Tag => !!tag)
      .sort((a, b) => a.title.localeCompare(b.title));

    const projectId = this.projectId();
    const project = projectId && this.projectState()?.entities[projectId];

    if (project && project.id) {
      const projectTag: Tag = {
        ...project,
        color: project.theme?.primary || DEFAULT_PROJECT_COLOR,
        created: 0,
        icon: project.icon || DEFAULT_PROJECT_ICON,
      };
      // project tag first then sorted tags
      return [projectTag, ...tagsI];
    }

    return tagsI;
  });

  projectId = computed<string | undefined>(() => {
    if (this.isShowProjectTagNever()) {
      return undefined;
    } else if (
      this.isShowProjectTagAlways() ||
      this.workContext()?.activeType === WorkContextType.TAG
    ) {
      return this.task().projectId;
    }
    return undefined;
  });

  indicatorChips = computed<TagComponentTag[]>(() => {
    // Read registration version to re-evaluate when plugins register
    this._pluginRegistry.registrationVersion();
    const t = this.task();
    const chips: TagComponentTag[] = [];

    if (t.issueId && t.issueType) {
      const builtInIcon = ISSUE_PROVIDER_ICON_MAP[t.issueType as BuiltInIssueProviderKey];
      const builtInLabel =
        ISSUE_PROVIDER_HUMANIZED[t.issueType as BuiltInIssueProviderKey];

      let icon: string | undefined;
      let label: string | undefined;

      if (builtInIcon && builtInLabel) {
        icon = builtInIcon;
        label = builtInLabel;
      } else if (this._pluginRegistry.hasProvider(t.issueType)) {
        const pluginIcon = this._pluginRegistry.getIcon(t.issueType);
        icon = pluginIcon !== 'extension' ? pluginIcon : undefined;
        label = this._pluginRegistry.getHumanReadableName(t.issueType);
      }

      if (label) {
        chips.push({
          title: t.issuePoints ? `${label} (${t.issuePoints})` : label,
          svgIcon: icon,
        });
      }
    }

    if (t.repeatCfgId) {
      const repeatCfg = this.repeatCfgState()?.entities[t.repeatCfgId];
      if (repeatCfg) {
        const [key, params] = getTaskRepeatInfoText(
          repeatCfg,
          this._dateTimeFormatService.currentLocale(),
          this._dateTimeFormatService,
          this._translateService,
        );
        chips.push({
          title: this._translateService.instant(key, params),
          icon: 'repeat',
        });
      }
    }

    return chips;
  });

  lifeIndicatorChips = computed<TagComponentTag[]>(() => {
    const t = this.task();
    const cfg = this._lifeConfig.config();
    const chips: TagComponentTag[] = [];

    if (t.lifePriorityId) {
      const label = this._singleLabel(
        lifePriorityPickerOptions(cfg),
        t.lifePriorityId,
        t.lifePriorityId,
      );
      chips.push({ title: `Priority: ${label}`, icon: 'priority_high' });
    }

    if (t.lifeEnergy != null) {
      const label = this._singleLabel(
        LIFE_ENERGY_OPTIONS,
        String(t.lifeEnergy),
        String(t.lifeEnergy),
      );
      chips.push({ title: `Energy: ${label}`, icon: 'bolt' });
    }

    if (t.lifeFocus != null) {
      const label = this._singleLabel(
        LIFE_FOCUS_OPTIONS,
        String(t.lifeFocus),
        String(t.lifeFocus),
      );
      chips.push({ title: `Focus: ${label}`, icon: 'psychology' });
    }

    if (t.lifeRequirementIds?.length) {
      const label = this._multiLabel(
        lifeContextPickerOptions(cfg.requirements, 'build'),
        t.lifeRequirementIds,
      );
      if (label) chips.push({ title: `Requires: ${label}`, icon: 'build' });
    }

    if (t.lifeLocationIds?.length) {
      const label = this._multiLabel(
        lifeContextPickerOptions(cfg.locations, 'place'),
        t.lifeLocationIds,
      );
      if (label) chips.push({ title: `Location: ${label}`, icon: 'place' });
    }

    if (t.lifeDueDay) {
      chips.push({ title: `Due: ${t.lifeDueDay}`, icon: 'event' });
    }

    if (t.lifeFollowUpDay) {
      chips.push({ title: `Follow-up: ${t.lifeFollowUpDay}`, icon: 'notification_important' });
    }

    if (t.lifeReviewDay) {
      chips.push({ title: `Review: ${t.lifeReviewDay}`, icon: 'rate_review' });
    }

    if (t.lifeBlockedByTaskIds?.length) {
      const selected = new Set(t.lifeBlockedByTaskIds);
      const titles = this._allTasks()
        .filter((candidate) => selected.has(candidate.id))
        .map((candidate) => candidate.title);
      chips.push({
        title: `Blocked by: ${titles.length ? titles.join(', ') : t.lifeBlockedByTaskIds.length}`,
        icon: 'account_tree',
      });
    }

    return chips;
  });

  private _singleLabel(
    options: LifePickerOption[],
    value: string,
    fallback: string,
  ): string {
    return options.find((option) => option.id === value)?.label || fallback;
  }

  private _multiLabel(options: LifePickerOption[], values: string[]): string {
    const selected = new Set(values);
    return options
      .filter((option) => selected.has(option.id))
      .map((option) => option.label)
      .join(', ');
  }
}
