import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { getDbDateStr } from '../../util/get-db-date-str';
import {
  NETWORK_CADENCE_OPTIONS,
  NETWORK_CHANNEL_OPTIONS,
  NETWORK_IMPORTANCE_OPTIONS,
  NETWORK_RELATIONSHIP_OPTIONS,
  NetworkContact,
  NetworkContactCadence,
  NetworkImportance,
  NetworkInteractionChannel,
  NetworkRelationshipType,
} from '../../features/networking/networking.model';
import {
  NetworkContactInput,
  NetworkInteractionInput,
  NetworkingService,
} from '../../features/networking/networking.service';
import { addCalendarDays } from '../../features/networking/networking.util';

type NetworkingFilter = 'ALL' | 'DUE' | 'UPCOMING' | 'NO_REMINDER' | 'ARCHIVED';
type ProfileSection = 'OVERVIEW' | 'FOLLOW_UPS' | 'HISTORY';
type ContactEditorSection =
  | 'BASIC'
  | 'WORK'
  | 'CONTEXT'
  | 'RELATIONSHIP'
  | 'FOLLOW_UP'
  | 'NOTES';

interface ContactDraft {
  name: string;
  phone: string;
  email: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  city: string;
  region: string;
  country: string;
  occupation: string;
  role: string;
  company: string;
  industry: string;
  metThrough: string;
  introducedByContactId: string;
  metAt: string;
  metOn: string;
  relationshipType: NetworkRelationshipType;
  importance: NetworkImportance;
  tags: string;
  interests: string;
  canHelpWith: string;
  canHelpMeWith: string;
  notes: string;
  cadence: NetworkContactCadence;
  cadenceDays: string;
  nextContactDay: string;
  nextTopic: string;
}

interface InteractionDraft {
  at: string;
  channel: NetworkInteractionChannel;
  location: string;
  summary: string;
  learned: string;
  iPromised: string;
  theyPromised: string;
  nextStep: string;
  nextTopic: string;
  nextContactDay: string;
  followUpTitle: string;
  followUpDueDay: string;
}

@Component({
  selector: 'networking-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
  ],
  template: `
    <main class="networking-page">
      <header class="page-head">
        <div>
          <h1>🤝 Networking</h1>
          <p>
            O memorie simplă pentru oameni: cine sunt, ce ați vorbit și când merită să
            reiei legătura.
          </p>
        </div>
        <button
          mat-flat-button
          color="primary"
          (click)="startNewContact()"
        >
          <mat-icon>person_add</mat-icon>
          Persoană nouă
        </button>
      </header>

      <section class="summary-grid">
        <button
          class="summary-card"
          [class.active]="filter() === 'DUE'"
          (click)="filter.set('DUE')"
        >
          <mat-icon>notifications_active</mat-icon>
          <strong>{{ networking.dueContacts().length }}</strong>
          <span>De contactat</span>
        </button>
        <button
          class="summary-card"
          (click)="filter.set('DUE')"
        >
          <mat-icon>today</mat-icon>
          <strong>{{ networking.todayContacts().length }}</strong>
          <span>Astăzi</span>
        </button>
        <button
          class="summary-card"
          [class.active]="filter() === 'UPCOMING'"
          (click)="filter.set('UPCOMING')"
        >
          <mat-icon>event_upcoming</mat-icon>
          <strong>{{ networking.upcomingContacts().length }}</strong>
          <span>Următoarele 7 zile</span>
        </button>
        <button
          class="summary-card"
          [class.active]="filter() === 'ALL'"
          (click)="filter.set('ALL')"
        >
          <mat-icon>groups</mat-icon>
          <strong>{{ networking.contacts().length }}</strong>
          <span>Persoane active</span>
        </button>
      </section>

      <section class="workspace">
        <aside class="people-panel">
          <div class="people-panel-head">
            <div>
              <strong>👥 Persoane</strong>
              <small>Găsește rapid omul și contextul potrivit.</small>
            </div>
            <button
              mat-icon-button
              type="button"
              aria-label="Adaugă persoană"
              (click)="startNewContact()"
            >
              <mat-icon>person_add</mat-icon>
            </button>
          </div>

          <div class="search-row">
            <label class="search-box">
              <mat-icon>search</mat-icon>
              <input
                type="search"
                placeholder="Caută nume, oraș, companie, conversații..."
                [ngModel]="query()"
                (ngModelChange)="query.set($event)"
              />
            </label>
            <small class="search-help">
              Căutarea verifică și notițele și istoricul conversațiilor.
            </small>
          </div>

          <nav
            class="filters"
            aria-label="Filtre networking"
          >
            @for (item of filters; track item.id) {
              <button
                type="button"
                [class.active]="filter() === item.id"
                (click)="filter.set(item.id)"
              >
                {{ item.label }}
                <span>{{ filterCount(item.id) }}</span>
              </button>
            }
          </nav>

          <div class="people-list">
            @for (group of peopleGroups(); track group.id) {
              @if (group.contacts.length) {
                <section class="people-group">
                  <header class="people-group-head">
                    <span class="group-emoji">{{ group.emoji }}</span>
                    <strong>{{ group.label }}</strong>
                    <span>{{ group.contacts.length }}</span>
                  </header>

                  @for (contact of group.contacts; track contact.id) {
                    <button
                      class="person-row"
                      [class.selected]="selectedId() === contact.id"
                      [class.due]="isDue(contact)"
                      (click)="selectContact(contact.id)"
                    >
                      <span class="person-leading">
                        <mat-icon>person_outline</mat-icon>
                      </span>
                      <span class="person-main">
                        <span class="person-top">
                          <strong>{{ contact.name }}</strong>
                          @if (contact.nextContactDay && contact.nextContactDay < today) {
                            <span class="row-status overdue">Restant</span>
                          } @else if (contact.nextContactDay === today) {
                            <span class="row-status today">Azi</span>
                          }
                        </span>
                        <span class="person-meta">
                          @if (contact.occupation) {
                            <span>{{ contact.occupation }}</span>
                          }
                          @if (contact.company) {
                            <span> · {{ contact.company }}</span>
                          }
                          @if (contact.city) {
                            <span> · {{ contact.city }}</span>
                          }
                        </span>
                        @if (contact.nextTopic) {
                          <small class="person-topic">💬 {{ contact.nextTopic }}</small>
                        }
                        @if (contact.tags.length) {
                          <span class="chips">
                            @for (tag of contact.tags.slice(0, 3); track tag) {
                              <span class="chip">{{ tag }}</span>
                            }
                            @if (contact.tags.length > 3) {
                              <span class="chip">+{{ contact.tags.length - 3 }}</span>
                            }
                          </span>
                        }
                      </span>
                      <span class="person-trailing">
                        @if (contact.nextContactDay) {
                          <small
                            class="contact-date"
                            [class.overdue]="contact.nextContactDay < today"
                          >
                            {{ contact.nextContactDay }}
                          </small>
                        }
                        <mat-icon>chevron_right</mat-icon>
                      </span>
                    </button>
                  }
                </section>
              }
            }

            @if (!filteredContacts().length) {
              <div class="empty-list">
                <mat-icon>person_search</mat-icon>
                <strong>Nicio persoană aici</strong>
                <p>Schimbă filtrul sau adaugă un contact nou.</p>
              </div>
            }
          </div>
        </aside>

        <section class="detail-panel">
          @if (contactEditorOpen()) {
            <section class="editor-shell">
              <header class="editor-head">
                <div class="editor-title">
                  <span class="editor-title-icon">👤</span>
                  <div>
                    <h2>
                      {{ editingContactId() ? 'Editează persoana' : 'Persoană nouă' }}
                    </h2>
                    <p>
                      Completează doar ce îți este util. Poți reveni oricând la restul
                      informațiilor.
                    </p>
                  </div>
                </div>
                <button
                  mat-icon-button
                  type="button"
                  aria-label="Închide"
                  (click)="cancelContactEdit()"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </header>

              <nav
                class="editor-carousel"
                aria-label="Secțiuni persoană"
              >
                @for (section of contactSections; track section.id) {
                  <button
                    type="button"
                    [class.active]="contactEditorSection() === section.id"
                    [attr.aria-current]="
                      contactEditorSection() === section.id ? 'step' : null
                    "
                    (click)="contactEditorSection.set(section.id)"
                  >
                    <span class="section-emoji">{{ section.emoji }}</span>
                    <span>{{ section.label }}</span>
                  </button>
                }
              </nav>

              <form
                class="contact-form native-detail-form"
                (ngSubmit)="saveContact()"
              >
                @switch (contactEditorSection()) {
                  @case ('BASIC') {
                    <section class="editor-section">
                      <div class="editor-section-intro">
                        <span>👤</span>
                        <div>
                          <h3>Informații de bază</h3>
                          <p>
                            Datele pe care le folosești ca să recunoști și să contactezi
                            rapid persoana.
                          </p>
                        </div>
                      </div>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>badge</mat-icon>
                          <span>
                            <b>Nume *</b>
                            <small>Cum vrei să apară persoana în Networking.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="name"
                            required
                            placeholder="ex. Andrei Popescu"
                            [(ngModel)]="contactDraft.name"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>phone</mat-icon>
                          <span>
                            <b>Telefon</b>
                            <small>Numărul principal pentru apel sau WhatsApp.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="phone"
                            type="tel"
                            placeholder="+40..."
                            [(ngModel)]="contactDraft.phone"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>mail_outline</mat-icon>
                          <span>
                            <b>Email</b>
                            <small
                              >Adresa pe care o folosești cel mai des cu persoana.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="email"
                            type="email"
                            placeholder="nume@email.com"
                            [(ngModel)]="contactDraft.email"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>photo_camera</mat-icon>
                          <span>
                            <b>Instagram</b>
                            <small>Username sau link complet către profil.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="instagram"
                            placeholder="@username"
                            [(ngModel)]="contactDraft.instagram"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>public</mat-icon>
                          <span>
                            <b>Facebook</b>
                            <small>Profilul folosit pentru contact personal.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="facebook"
                            placeholder="profil sau link"
                            [(ngModel)]="contactDraft.facebook"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>business_center</mat-icon>
                          <span>
                            <b>LinkedIn</b>
                            <small>Profilul profesional al persoanei.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="linkedin"
                            placeholder="profil sau link"
                            [(ngModel)]="contactDraft.linkedin"
                          />
                        </span>
                      </label>
                    </section>
                  }

                  @case ('WORK') {
                    <section class="editor-section">
                      <div class="editor-section-intro">
                        <span>💼</span>
                        <div>
                          <h3>Profesie și organizație</h3>
                          <p>
                            Context profesional suficient cât să-ți amintești imediat cine
                            este și cu ce se ocupă.
                          </p>
                        </div>
                      </div>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>work_outline</mat-icon>
                          <span>
                            <b>Ocupație</b>
                            <small
                              >Rolul general: AI Engineer, avocat, contabil etc.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="occupation"
                            placeholder="ex. AI Engineer"
                            [(ngModel)]="contactDraft.occupation"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>military_tech</mat-icon>
                          <span>
                            <b>Funcție</b>
                            <small
                              >Titlul concret din organizație, dacă este relevant.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="role"
                            placeholder="ex. Senior Engineer"
                            [(ngModel)]="contactDraft.role"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>apartment</mat-icon>
                          <span>
                            <b>Companie / organizație</b>
                            <small>Unde lucrează sau organizația relevantă.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="company"
                            placeholder="ex. Company X"
                            [(ngModel)]="contactDraft.company"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>category</mat-icon>
                          <span>
                            <b>Domeniu</b>
                            <small
                              >AI, juridic, contabilitate, business, cercetare...</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="industry"
                            placeholder="AI, juridic, contabilitate..."
                            [(ngModel)]="contactDraft.industry"
                          />
                        </span>
                      </label>
                    </section>
                  }

                  @case ('CONTEXT') {
                    <section class="editor-section">
                      <div class="editor-section-intro">
                        <span>📍</span>
                        <div>
                          <h3>Loc și context</h3>
                          <p>Unde este persoana și cum a intrat în rețeaua ta.</p>
                        </div>
                      </div>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>location_city</mat-icon>
                          <span>
                            <b>Oraș</b>
                            <small>Util pentru întâlniri și networking local.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="city"
                            placeholder="ex. Timișoara"
                            [(ngModel)]="contactDraft.city"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>map</mat-icon>
                          <span>
                            <b>Județ / regiune</b>
                            <small>Opțional, pentru localizare mai precisă.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="region"
                            [(ngModel)]="contactDraft.region"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>language</mat-icon>
                          <span>
                            <b>Țară</b>
                            <small>Țara în care se află de obicei persoana.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="country"
                            [(ngModel)]="contactDraft.country"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>hub</mat-icon>
                          <span>
                            <b>De unde îl/o cunosc</b>
                            <small
                              >Facultate, master, conferință, LinkedIn, client etc.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="metThrough"
                            placeholder="ex. conferință AI"
                            [(ngModel)]="contactDraft.metThrough"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>place</mat-icon>
                          <span>
                            <b>Unde ne-am cunoscut</b>
                            <small>Evenimentul sau locul primei întâlniri.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="metAt"
                            placeholder="ex. AI Conference 2026"
                            [(ngModel)]="contactDraft.metAt"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>event</mat-icon>
                          <span>
                            <b>Data când ne-am cunoscut</b>
                            <small>Ajută la păstrarea cronologiei relației.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="metOn"
                            type="date"
                            [(ngModel)]="contactDraft.metOn"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>person_add_alt</mat-icon>
                          <span>
                            <b>Ne-a făcut cunoștință</b>
                            <small>Leagă persoana de contactul care v-a introdus.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <select
                            name="introducedBy"
                            [(ngModel)]="contactDraft.introducedByContactId"
                          >
                            <option value="">— Nimeni / necunoscut —</option>
                            @for (person of introductionOptions(); track person.id) {
                              <option [value]="person.id">{{ person.name }}</option>
                            }
                          </select>
                        </span>
                      </label>
                    </section>
                  }

                  @case ('RELATIONSHIP') {
                    <section class="editor-section">
                      <div class="editor-section-intro">
                        <span>🤝</span>
                        <div>
                          <h3>Relație și relevanță</h3>
                          <p>
                            Definește cum se încadrează persoana în rețeaua ta și ce
                            valoare puteți crea reciproc.
                          </p>
                        </div>
                      </div>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>group_work</mat-icon>
                          <span>
                            <b>Tip relație</b>
                            <small>Profesională, prieten, recruiter, mentor etc.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <select
                            name="relationshipType"
                            [(ngModel)]="contactDraft.relationshipType"
                          >
                            @for (item of relationshipOptions; track item.value) {
                              <option [value]="item.value">{{ item.label }}</option>
                            }
                          </select>
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>stars</mat-icon>
                          <span>
                            <b>Importanță relație</b>
                            <small
                              >Cât de activ vrei să investești în relația
                              respectivă.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <select
                            name="importance"
                            [(ngModel)]="contactDraft.importance"
                          >
                            @for (item of importanceOptions; track item.value) {
                              <option [value]="item.value">{{ item.label }}</option>
                            }
                          </select>
                        </span>
                      </label>

                      <label class="detail-field tall">
                        <span class="detail-field-title">
                          <mat-icon>label_outline</mat-icon>
                          <span>
                            <b>Tags</b>
                            <small
                              >Ex: AI, Timișoara, recruiter, facultate. Separate prin
                              virgulă.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="tags"
                            placeholder="AI, Timișoara, recruiter"
                            [(ngModel)]="contactDraft.tags"
                          />
                        </span>
                      </label>

                      <label class="detail-field tall">
                        <span class="detail-field-title">
                          <mat-icon>interests</mat-icon>
                          <span>
                            <b>Interese</b>
                            <small
                              >Subiecte despre care îi place să vorbească sau
                              lucrează.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <textarea
                            name="interests"
                            rows="3"
                            placeholder="AI, startup-uri, drept, sport..."
                            [(ngModel)]="contactDraft.interests"
                          ></textarea>
                        </span>
                      </label>

                      <label class="detail-field tall">
                        <span class="detail-field-title">
                          <mat-icon>volunteer_activism</mat-icon>
                          <span>
                            <b>Pot să îl/o ajut cu</b>
                            <small
                              >Idei, introduceri sau competențe pe care le poți
                              oferi.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <textarea
                            name="canHelpWith"
                            rows="3"
                            [(ngModel)]="contactDraft.canHelpWith"
                          ></textarea>
                        </span>
                      </label>

                      <label class="detail-field tall">
                        <span class="detail-field-title">
                          <mat-icon>handshake</mat-icon>
                          <span>
                            <b>Mă poate ajuta cu</b>
                            <small
                              >Context util pentru oportunități și colaborări
                              viitoare.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <textarea
                            name="canHelpMeWith"
                            rows="3"
                            [(ngModel)]="contactDraft.canHelpMeWith"
                          ></textarea>
                        </span>
                      </label>
                    </section>
                  }

                  @case ('FOLLOW_UP') {
                    <section class="editor-section">
                      <div class="editor-section-intro">
                        <span>🗓️</span>
                        <div>
                          <h3>Ținem legătura</h3>
                          <p>
                            Setează ritmul relației. Când vine data, persoana apare
                            automat în Today.
                          </p>
                        </div>
                      </div>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>repeat</mat-icon>
                          <span>
                            <b>Frecvență</b>
                            <small
                              >Cât de des vrei, în mod normal, să reluați legătura.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <select
                            name="cadence"
                            [(ngModel)]="contactDraft.cadence"
                          >
                            @for (item of cadenceOptions; track item.value) {
                              <option [value]="item.value">{{ item.label }}</option>
                            }
                          </select>
                        </span>
                      </label>

                      @if (contactDraft.cadence === 'CUSTOM') {
                        <label class="detail-field">
                          <span class="detail-field-title">
                            <mat-icon>date_range</mat-icon>
                            <span>
                              <b>La câte zile</b>
                              <small>Intervalul personalizat dintre contacte.</small>
                            </span>
                          </span>
                          <span class="detail-field-control">
                            <input
                              name="cadenceDays"
                              type="number"
                              min="1"
                              [(ngModel)]="contactDraft.cadenceDays"
                            />
                          </span>
                        </label>
                      }

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>event_available</mat-icon>
                          <span>
                            <b>Următorul contact</b>
                            <small
                              >Poți suprascrie manual data calculată din frecvență.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="nextContactDay"
                            type="date"
                            [(ngModel)]="contactDraft.nextContactDay"
                          />
                        </span>
                      </label>

                      <label class="detail-field tall">
                        <span class="detail-field-title">
                          <mat-icon>chat_bubble_outline</mat-icon>
                          <span>
                            <b>Subiect data viitoare</b>
                            <small
                              >Un reminder scurt ca să reintri natural în
                              conversație.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <textarea
                            name="nextTopic"
                            rows="3"
                            placeholder="ex. Întreabă-l cum a mers proiectul RAG"
                            [(ngModel)]="contactDraft.nextTopic"
                          ></textarea>
                        </span>
                      </label>

                      <div class="editor-tip">
                        <span>💡</span>
                        <p>
                          După ce înregistrezi o conversație, data următoare poate fi
                          recalculată automat din frecvența aleasă.
                        </p>
                      </div>
                    </section>
                  }

                  @case ('NOTES') {
                    <section class="editor-section">
                      <div class="editor-section-intro">
                        <span>📝</span>
                        <div>
                          <h3>Note permanente</h3>
                          <p>
                            Păstrează aici doar informații care rămân utile în timp.
                            Conversațiile individuale au propriul istoric separat.
                          </p>
                        </div>
                      </div>

                      <label class="detail-field tall notes-field">
                        <span class="detail-field-title">
                          <mat-icon>notes</mat-icon>
                          <span>
                            <b>Note</b>
                            <small>
                              Preferințe, context personal/profesional și lucruri pe care
                              nu vrei să le uiți.
                            </small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <textarea
                            name="notes"
                            rows="10"
                            placeholder="Scrie doar contextul permanent al relației..."
                            [(ngModel)]="contactDraft.notes"
                          ></textarea>
                        </span>
                      </label>
                    </section>
                  }
                }

                <footer class="editor-footer">
                  <div class="editor-progress">
                    <span>
                      {{ contactSectionIndex() + 1 }} / {{ contactSections.length }}
                    </span>
                    <span class="progress-track">
                      <span
                        class="progress-fill"
                        [style.width.%]="
                          ((contactSectionIndex() + 1) / contactSections.length) * 100
                        "
                      ></span>
                    </span>
                  </div>

                  <div class="form-actions">
                    @if (contactSectionIndex() > 0) {
                      <button
                        type="button"
                        mat-button
                        (click)="previousContactSection()"
                      >
                        <mat-icon>arrow_back</mat-icon>
                        Înapoi
                      </button>
                    }
                    <button
                      type="button"
                      mat-button
                      (click)="cancelContactEdit()"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      mat-flat-button
                      color="primary"
                      [disabled]="!contactDraft.name.trim()"
                    >
                      <mat-icon>save</mat-icon>
                      Salvează
                    </button>
                    @if (contactSectionIndex() < contactSections.length - 1) {
                      <button
                        type="button"
                        mat-button
                        (click)="nextContactSection()"
                      >
                        Următorul
                        <mat-icon>arrow_forward</mat-icon>
                      </button>
                    }
                  </div>
                </footer>
              </form>
            </section>
          } @else if (selectedContact(); as contact) {
            <section class="profile">
              <header class="profile-head">
                <div>
                  <div class="profile-title-line">
                    <h2>{{ contact.name }}</h2>
                    <span class="importance">
                      {{ importanceLabel(contact.importance) }}
                    </span>
                  </div>
                  <p>
                    @if (contact.occupation) {
                      {{ contact.occupation }}
                    }
                    @if (contact.role) {
                      · {{ contact.role }}
                    }
                    @if (contact.company) {
                      · {{ contact.company }}
                    }
                    @if (contact.city) {
                      · {{ contact.city }}
                    }
                  </p>
                </div>
                <div class="profile-actions">
                  @if (!contact.isArchived) {
                    <button
                      mat-flat-button
                      color="primary"
                      (click)="startInteraction()"
                    >
                      <mat-icon>forum</mat-icon>
                      Am vorbit
                    </button>
                  }
                  <button
                    mat-button
                    (click)="startEditContact(contact)"
                  >
                    <mat-icon>edit</mat-icon>
                    Editează
                  </button>
                </div>
              </header>

              <div class="contact-links">
                @if (contact.phone) {
                  <a [href]="'tel:' + contact.phone">
                    <mat-icon>phone</mat-icon>{{ contact.phone }}
                  </a>
                }
                @if (contact.email) {
                  <a [href]="'mailto:' + contact.email">
                    <mat-icon>mail</mat-icon>{{ contact.email }}
                  </a>
                }
                @if (contact.instagram) {
                  <a
                    [href]="socialUrl('instagram', contact.instagram)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <mat-icon>photo_camera</mat-icon>Instagram
                  </a>
                }
                @if (contact.facebook) {
                  <a
                    [href]="socialUrl('facebook', contact.facebook)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <mat-icon>public</mat-icon>Facebook
                  </a>
                }
                @if (contact.linkedin) {
                  <a
                    [href]="socialUrl('linkedin', contact.linkedin)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <mat-icon>business_center</mat-icon>LinkedIn
                  </a>
                }
              </div>

              <nav
                class="profile-carousel"
                aria-label="Detalii persoană"
              >
                @for (section of profileSections; track section.id) {
                  <button
                    type="button"
                    [class.active]="profileSection() === section.id"
                    [attr.aria-current]="
                      profileSection() === section.id ? 'page' : null
                    "
                    (click)="profileSection.set(section.id)"
                  >
                    <span>{{ section.emoji }}</span>
                    <span>{{ section.label }}</span>
                    @if (section.id === 'FOLLOW_UPS' && openFollowUps().length) {
                      <small>{{ openFollowUps().length }}</small>
                    }
                    @if (section.id === 'HISTORY' && interactions().length) {
                      <small>{{ interactions().length }}</small>
                    }
                  </button>
                }
              </nav>

              @if (profileSection() === 'OVERVIEW') {
              <section class="context-grid">
                <mat-card>
                  <mat-card-content>
                    <div class="mini-head">
                      <strong>🗓️ Ținem legătura</strong>
                      @if (contact.nextContactDay) {
                        <span
                          class="status-pill"
                          [class.overdue]="contact.nextContactDay < today"
                          [class.due-now]="contact.nextContactDay === today"
                        >
                          {{ contact.nextContactDay }}
                        </span>
                      }
                    </div>
                    <dl>
                      <div>
                        <dt>Ultimul contact</dt>
                        <dd>
                          {{
                            contact.lastContactAt ? dateLabel(contact.lastContactAt) : '—'
                          }}
                        </dd>
                      </div>
                      <div>
                        <dt>Frecvență</dt>
                        <dd>{{ cadenceLabel(contact.cadence, contact.cadenceDays) }}</dd>
                      </div>
                      <div>
                        <dt>Data viitoare</dt>
                        <dd>{{ contact.nextContactDay || '—' }}</dd>
                      </div>
                    </dl>
                    @if (contact.nextTopic) {
                      <div class="next-topic">
                        <small>Data viitoare</small>
                        <p>{{ contact.nextTopic }}</p>
                      </div>
                    }
                  </mat-card-content>
                </mat-card>

                <mat-card>
                  <mat-card-content>
                    <div class="mini-head">
                      <strong>🧠 Context rapid</strong>
                      <mat-icon>psychology_alt</mat-icon>
                    </div>
                    @if (latestInteraction(); as last) {
                      <p class="last-summary">{{ last.summary }}</p>
                      @if (last.learned) {
                        <div class="context-line">
                          <b>Am aflat:</b> {{ last.learned }}
                        </div>
                      }
                      @if (last.iPromised) {
                        <div class="context-line">
                          <b>Am promis:</b> {{ last.iPromised }}
                        </div>
                      }
                      @if (last.theyPromised) {
                        <div class="context-line">
                          <b>A promis:</b> {{ last.theyPromised }}
                        </div>
                      }
                    } @else {
                      <p class="muted">Nu există încă nicio conversație înregistrată.</p>
                    }
                  </mat-card-content>
                </mat-card>
              </section>

              }

              @if (profileSection() === 'HISTORY' && interactionEditorOpen()) {
                <section class="editor-shell conversation-editor">
                  <header class="editor-head">
                    <div class="editor-title">
                      <span class="editor-title-icon">💬</span>
                      <div>
                        <h3>Înregistrează conversația</h3>
                        <p>
                          Notează doar esențialul. Data viitoare vei avea contextul gata
                          înainte să scrii sau să vă vedeți.
                        </p>
                      </div>
                    </div>
                    <button
                      mat-icon-button
                      type="button"
                      (click)="interactionEditorOpen.set(false)"
                      aria-label="Închide"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  </header>

                  <form
                    class="interaction-form native-detail-form"
                    (ngSubmit)="saveInteraction(contact.id)"
                  >
                    <section class="editor-section conversation-section">
                      <div class="editor-section-intro">
                        <span>🧠</span>
                        <div>
                          <h3>Memoria conversației</h3>
                          <p>
                            Un rezumat bun îți permite să reiei relația natural chiar și
                            după câteva luni.
                          </p>
                        </div>
                      </div>

                      <label class="detail-field tall conversation-summary">
                        <span class="detail-field-title">
                          <mat-icon>forum</mat-icon>
                          <span>
                            <b>Ce am vorbit? *</b>
                            <small>
                              Rezumatul principal: subiecte, idei importante și context.
                            </small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <textarea
                            name="summary"
                            rows="5"
                            required
                            placeholder="Ex: am discutat despre joburi AI în Timișoara și proiectul lui RAG..."
                            [(ngModel)]="interactionDraft.summary"
                          ></textarea>
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>schedule</mat-icon>
                          <span>
                            <b>Data și ora</b>
                            <small>Când a avut loc conversația.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="interactionAt"
                            type="datetime-local"
                            [(ngModel)]="interactionDraft.at"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>connect_without_contact</mat-icon>
                          <span>
                            <b>Cum am vorbit</b>
                            <small>Întâlnire, telefon, WhatsApp, LinkedIn etc.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <select
                            name="channel"
                            [(ngModel)]="interactionDraft.channel"
                          >
                            @for (item of channelOptions; track item.value) {
                              <option [value]="item.value">{{ item.label }}</option>
                            }
                          </select>
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>place</mat-icon>
                          <span>
                            <b>Unde / context</b>
                            <small>Locul, evenimentul sau motivul conversației.</small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="interactionLocation"
                            placeholder="ex. cafea în Timișoara / LinkedIn"
                            [(ngModel)]="interactionDraft.location"
                          />
                        </span>
                      </label>

                      <label class="detail-field tall">
                        <span class="detail-field-title">
                          <mat-icon>lightbulb</mat-icon>
                          <span>
                            <b>Ce am aflat nou?</b>
                            <small>
                              Informații despre persoană, proiecte, planuri sau interese.
                            </small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <textarea
                            name="learned"
                            rows="3"
                            placeholder="Ex: echipa lui caută backend developer..."
                            [(ngModel)]="interactionDraft.learned"
                          ></textarea>
                        </span>
                      </label>

                      <div class="conversation-pair">
                        <label class="detail-field tall">
                          <span class="detail-field-title">
                            <mat-icon>assignment_turned_in</mat-icon>
                            <span>
                              <b>Ce am promis eu?</b>
                              <small>Lucrurile pentru care trebuie să revii tu.</small>
                            </span>
                          </span>
                          <span class="detail-field-control">
                            <textarea
                              name="iPromised"
                              rows="3"
                              placeholder="Ex: îi trimit GitHub-ul"
                              [(ngModel)]="interactionDraft.iPromised"
                            ></textarea>
                          </span>
                        </label>

                        <label class="detail-field tall">
                          <span class="detail-field-title">
                            <mat-icon>assignment_ind</mat-icon>
                            <span>
                              <b>Ce a promis persoana?</b>
                              <small>Ce ai putea urmări la următoarea discuție.</small>
                            </span>
                          </span>
                          <span class="detail-field-control">
                            <textarea
                              name="theyPromised"
                              rows="3"
                              placeholder="Ex: îmi trimite contactul recruiterului"
                              [(ngModel)]="interactionDraft.theyPromised"
                            ></textarea>
                          </span>
                        </label>
                      </div>

                      <div class="editor-section-intro next-step-intro">
                        <span>🔁</span>
                        <div>
                          <h3>Ce urmează</h3>
                          <p>
                            Transformă conversația în următorul pas concret și păstrează
                            relația vie.
                          </p>
                        </div>
                      </div>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>arrow_forward</mat-icon>
                          <span>
                            <b>Următorul pas</b>
                            <small
                              >Acțiunea simplă care trebuie făcută după discuție.</small
                            >
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="nextStep"
                            placeholder="ex. Trimite portofoliul"
                            [(ngModel)]="interactionDraft.nextStep"
                          />
                        </span>
                      </label>

                      <label class="detail-field tall">
                        <span class="detail-field-title">
                          <mat-icon>question_answer</mat-icon>
                          <span>
                            <b>Despre ce vorbesc data viitoare?</b>
                            <small>
                              Întrebarea sau tema care te ajută să reiei conversația
                              natural.
                            </small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <textarea
                            name="interactionNextTopic"
                            rows="3"
                            placeholder="Ex: întreabă-l cum a mers lansarea proiectului"
                            [(ngModel)]="interactionDraft.nextTopic"
                          ></textarea>
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>event_available</mat-icon>
                          <span>
                            <b>Următorul contact</b>
                            <small>
                              Lasă gol pentru calcul automat din frecvența persoanei.
                            </small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="interactionNextContactDay"
                            type="date"
                            [(ngModel)]="interactionDraft.nextContactDay"
                          />
                        </span>
                      </label>

                      <label class="detail-field">
                        <span class="detail-field-title">
                          <mat-icon>add_task</mat-icon>
                          <span>
                            <b>Follow-up de făcut</b>
                            <small>
                              Poate rămâne în Networking sau îl poți transforma ulterior
                              într-un task LifeOS.
                            </small>
                          </span>
                        </span>
                        <span class="detail-field-control">
                          <input
                            name="followUpTitle"
                            placeholder="ex. Trimite CV-ul"
                            [(ngModel)]="interactionDraft.followUpTitle"
                          />
                        </span>
                      </label>

                      @if (interactionDraft.followUpTitle.trim()) {
                        <label class="detail-field">
                          <span class="detail-field-title">
                            <mat-icon>flag</mat-icon>
                            <span>
                              <b>Termen follow-up</b>
                              <small>Data până la care vrei să închizi acțiunea.</small>
                            </span>
                          </span>
                          <span class="detail-field-control">
                            <input
                              name="followUpDueDay"
                              type="date"
                              [(ngModel)]="interactionDraft.followUpDueDay"
                            />
                          </span>
                        </label>
                      }

                      <div class="editor-tip">
                        <span>✨</span>
                        <p>
                          Nu trebuie să scrii mult. 3–5 idei clare sunt suficiente ca să
                          ai tot contextul data viitoare.
                        </p>
                      </div>
                    </section>

                    <footer class="editor-footer conversation-footer">
                      <span class="conversation-hint"
                        >💾 Conversația rămâne în istoric.</span
                      >
                      <div class="form-actions">
                        <button
                          type="button"
                          mat-button
                          (click)="interactionEditorOpen.set(false)"
                        >
                          Anulează
                        </button>
                        <button
                          type="submit"
                          mat-flat-button
                          color="primary"
                          [disabled]="!interactionDraft.summary.trim()"
                        >
                          <mat-icon>save</mat-icon>
                          Salvează conversația
                        </button>
                      </div>
                    </footer>
                  </form>
                </section>
              }

              @if (profileSection() === 'OVERVIEW') {
              <section class="profile-grid">
                <mat-card>
                  <mat-card-content>
                    <div class="mini-head">
                      <strong>👤 Despre persoană</strong>
                      <span>{{ relationshipLabel(contact.relationshipType) }}</span>
                    </div>
                    <dl>
                      @if (contact.city || contact.region || contact.country) {
                        <div>
                          <dt>Locație</dt>
                          <dd>{{ locationLabel(contact) }}</dd>
                        </div>
                      }
                      @if (contact.industry) {
                        <div>
                          <dt>Domeniu</dt>
                          <dd>{{ contact.industry }}</dd>
                        </div>
                      }
                      @if (contact.metThrough) {
                        <div>
                          <dt>De unde o cunosc</dt>
                          <dd>{{ contact.metThrough }}</dd>
                        </div>
                      }
                      @if (contact.metAt) {
                        <div>
                          <dt>Ne-am cunoscut la</dt>
                          <dd>{{ contact.metAt }}</dd>
                        </div>
                      }
                      @if (contact.metOn) {
                        <div>
                          <dt>Din</dt>
                          <dd>{{ contact.metOn }}</dd>
                        </div>
                      }
                      @if (introducedByName(contact)) {
                        <div>
                          <dt>Introducere prin</dt>
                          <dd>{{ introducedByName(contact) }}</dd>
                        </div>
                      }
                    </dl>
                    @if (contact.tags.length) {
                      <div class="chips roomy">
                        @for (tag of contact.tags; track tag) {
                          <span class="chip">{{ tag }}</span>
                        }
                      </div>
                    }
                    @if (contact.interests) {
                      <div class="text-block">
                        <small>Interese</small>
                        <p>{{ contact.interests }}</p>
                      </div>
                    }
                    @if (contact.notes) {
                      <div class="text-block">
                        <small>Note</small>
                        <p>{{ contact.notes }}</p>
                      </div>
                    }
                  </mat-card-content>
                </mat-card>

                <mat-card>
                  <mat-card-content>
                    <div class="mini-head">
                      <strong>Relație reciprocă</strong>
                      <mat-icon>handshake</mat-icon>
                    </div>
                    <div class="text-block">
                      <small>Pot să îl/o ajut cu</small>
                      <p>{{ contact.canHelpWith || '—' }}</p>
                    </div>
                    <div class="text-block">
                      <small>Mă poate ajuta cu</small>
                      <p>{{ contact.canHelpMeWith || '—' }}</p>
                    </div>
                  </mat-card-content>
                </mat-card>
              </section>

              }

              @if (profileSection() === 'FOLLOW_UPS') {
              <mat-card class="followup-card">
                <mat-card-content>
                  <div class="section-head">
                    <div>
                      <h3>Follow-ups & promisiuni</h3>
                      <p>Acțiuni concrete separate de simplul reminder de networking.</p>
                    </div>
                    <span>{{ openFollowUps().length }} deschise</span>
                  </div>

                  <div class="quick-followup">
                    <input
                      #followUpTitle
                      placeholder="Adaugă follow-up..."
                      (keydown.enter)="
                        addFollowUp(contact.id, followUpTitle.value, followUpDue.value);
                        followUpTitle.value = ''
                      "
                    />
                    <input
                      #followUpDue
                      type="date"
                    />
                    <button
                      mat-button
                      (click)="
                        addFollowUp(contact.id, followUpTitle.value, followUpDue.value);
                        followUpTitle.value = ''
                      "
                    >
                      <mat-icon>add</mat-icon>
                      Adaugă
                    </button>
                  </div>

                  @for (item of followUps(); track item.id) {
                    <div
                      class="followup-row"
                      [class.done]="item.status === 'DONE'"
                    >
                      <button
                        class="check"
                        type="button"
                        (click)="toggleFollowUp(item.id, item.status)"
                        [attr.aria-label]="
                          item.status === 'DONE' ? 'Redeschide' : 'Finalizat'
                        "
                      >
                        <mat-icon>{{
                          item.status === 'DONE'
                            ? 'check_circle'
                            : 'radio_button_unchecked'
                        }}</mat-icon>
                      </button>
                      <span class="grow">{{ item.title }}</span>
                      @if (item.dueDay) {
                        <span class="chip">{{ item.dueDay }}</span>
                      }
                      @if (item.taskId) {
                        <span class="chip linked">Task creat</span>
                      } @else if (item.status === 'OPEN') {
                        <button
                          mat-button
                          (click)="createTask(item.id)"
                        >
                          <mat-icon>add_task</mat-icon>
                          Task
                        </button>
                      }
                    </div>
                  }
                  @if (!followUps().length) {
                    <p class="muted">Nu există follow-up-uri pentru această persoană.</p>
                  }
                </mat-card-content>
              </mat-card>

              }

              @if (profileSection() === 'HISTORY') {
              <mat-card class="timeline-card">
                <mat-card-content>
                  <div class="section-head">
                    <div>
                      <h3>💬 Istoric conversații</h3>
                      <p>
                        Fiecare conversație rămâne în cronologie; nimic nu se suprascrie.
                      </p>
                    </div>
                    <span>{{ interactions().length }}</span>
                  </div>

                  <div class="timeline">
                    @for (item of interactions(); track item.id) {
                      <article class="interaction">
                        <div class="timeline-marker"></div>
                        <div class="interaction-body">
                          <header>
                            <div>
                              <strong>{{ dateTimeLabel(item.at) }}</strong>
                              <span class="channel">
                                {{ channelLabel(item.channel) }}
                              </span>
                            </div>
                            @if (item.location) {
                              <span class="muted">{{ item.location }}</span>
                            }
                          </header>
                          <p class="summary">{{ item.summary }}</p>

                          <div class="interaction-details">
                            @if (item.learned) {
                              <div>
                                <small>Ce am aflat</small>
                                <p>{{ item.learned }}</p>
                              </div>
                            }
                            @if (item.iPromised) {
                              <div>
                                <small>Am promis</small>
                                <p>{{ item.iPromised }}</p>
                              </div>
                            }
                            @if (item.theyPromised) {
                              <div>
                                <small>A promis</small>
                                <p>{{ item.theyPromised }}</p>
                              </div>
                            }
                            @if (item.nextStep) {
                              <div>
                                <small>Următorul pas</small>
                                <p>{{ item.nextStep }}</p>
                              </div>
                            }
                            @if (item.nextTopic) {
                              <div>
                                <small>Data viitoare</small>
                                <p>{{ item.nextTopic }}</p>
                              </div>
                            }
                          </div>
                        </div>
                      </article>
                    }

                    @if (!interactions().length) {
                      <div class="timeline-empty">
                        <mat-icon>forum</mat-icon>
                        <p>
                          Nu ai înregistrat încă o conversație. După următoarea discuție
                          apasă „Am vorbit”.
                        </p>
                      </div>
                    }
                  </div>
                </mat-card-content>
              </mat-card>

              }

              <footer class="danger-zone">
                @if (contact.isArchived) {
                  <button
                    mat-button
                    (click)="networking.archiveContact(contact.id, false)"
                  >
                    <mat-icon>unarchive</mat-icon>
                    Reactivează persoana
                  </button>
                } @else {
                  <button
                    mat-button
                    (click)="archiveSelected(contact.id)"
                  >
                    <mat-icon>archive</mat-icon>
                    Arhivează persoana
                  </button>
                }
              </footer>
            </section>
          } @else {
            <div class="empty-detail">
              <mat-icon>groups</mat-icon>
              <h2>Networking-ul tău începe aici</h2>
              <p>
                Adaugă o persoană sau selectează una din listă pentru a vedea contextul
                relației.
              </p>
              <button
                mat-flat-button
                color="primary"
                (click)="startNewContact()"
              >
                <mat-icon>person_add</mat-icon>
                Adaugă persoană
              </button>
            </div>
          }
        </section>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .networking-page {
        width: min(1440px, 100%);
        margin: 0 auto;
        padding: 18px 18px 96px;
        box-sizing: border-box;
      }

      .page-head,
      .section-head,
      .profile-head,
      .profile-title-line,
      .profile-actions,
      .mini-head,
      .person-top,
      .followup-row,
      .quick-followup {
        display: flex;
        align-items: center;
      }

      .page-head,
      .section-head,
      .profile-head,
      .mini-head,
      .person-top {
        justify-content: space-between;
      }

      .page-head {
        gap: 18px;
        margin-bottom: 14px;
      }

      h1,
      h2,
      h3,
      p {
        margin-top: 0;
      }

      .page-head h1 {
        margin-bottom: 3px;
        font-size: 1.5rem;
      }

      .page-head p,
      .section-head p,
      .profile-head p {
        margin-bottom: 0;
        color: var(--text-color-muted);
        font-size: 0.82rem;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }

      .summary-card {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-rows: auto auto;
        column-gap: 9px;
        align-items: center;
        min-height: 68px;
        padding: 10px 12px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .summary-card:hover,
      .summary-card.active {
        background: var(--state-hover);
      }

      .summary-card mat-icon {
        grid-row: 1 / 3;
      }

      .summary-card strong {
        font-size: 1.1rem;
      }

      .summary-card span {
        color: var(--text-color-muted);
        font-size: 0.74rem;
      }

      .workspace {
        display: grid;
        grid-template-columns: 330px minmax(0, 1fr);
        gap: 12px;
        min-height: 620px;
      }

      .people-panel,
      .detail-panel {
        min-width: 0;
      }

      .people-panel {
        overflow: hidden;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: color-mix(in srgb, var(--bg-lighter) 72%, transparent);
      }

      .search-row {
        padding: 10px;
        border-bottom: 1px solid var(--divider-color);
      }

      .search-box {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 7px 9px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
      }

      .search-box input {
        width: 100%;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: inherit;
      }

      .filters {
        display: flex;
        gap: 3px;
        overflow-x: auto;
        padding: 7px;
        border-bottom: 1px solid var(--divider-color);
      }

      .filters button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 8px;
        border: 0;
        border-radius: 99px;
        background: transparent;
        color: inherit;
        white-space: nowrap;
        cursor: pointer;
      }

      .filters button:hover,
      .filters button.active {
        background: var(--state-selected);
      }

      .filters span {
        opacity: 0.55;
        font-size: 0.72rem;
      }

      .people-list {
        max-height: calc(100vh - 275px);
        overflow: auto;
        padding: 5px;
      }

      .person-row {
        display: block;
        width: 100%;
        padding: 10px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .person-row:hover,
      .person-row.selected {
        background: var(--state-hover);
      }

      .person-row.due:not(.selected) {
        box-shadow: inset 3px 0 0 var(--c-accent);
      }

      .person-meta,
      .person-topic {
        display: block;
        margin-top: 3px;
        overflow: hidden;
        color: var(--text-color-muted);
        font-size: 0.75rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .contact-date {
        opacity: 0.65;
        font-size: 0.7rem;
      }

      .contact-date.overdue,
      .status-pill.overdue {
        font-weight: 700;
        color: var(--c-warn);
      }

      .status-pill.due-now {
        font-weight: 700;
        color: var(--c-accent);
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }

      .chips.roomy {
        margin-block: 10px;
      }

      .chip,
      .importance,
      .channel,
      .status-pill {
        display: inline-flex;
        padding: 2px 7px;
        border-radius: 99px;
        background: var(--state-hover);
        font-size: 0.68rem;
      }

      .detail-panel {
        min-height: 600px;
      }

      .editor-card,
      .interaction-editor,
      .profile-grid,
      .context-grid,
      .followup-card,
      .timeline-card {
        margin-bottom: 10px;
      }

      .profile {
        display: block;
      }

      .profile-head {
        gap: 12px;
        margin-bottom: 9px;
      }

      .profile-title-line {
        gap: 8px;
      }

      .profile-title-line h2 {
        margin-bottom: 0;
      }

      .profile-actions {
        gap: 4px;
      }

      .contact-links {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
      }

      .contact-links a {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 32px;
        padding: 3px 8px;
        border: 1px solid var(--divider-color);
        border-radius: 7px;
        color: inherit;
        text-decoration: none;
      }

      .contact-links mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
      }

      .context-grid,
      .profile-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .mini-head {
        gap: 8px;
        margin-bottom: 7px;
      }

      .mini-head > span {
        color: var(--text-color-muted);
        font-size: 0.75rem;
      }

      dl {
        margin: 0;
      }

      dl > div {
        display: grid;
        grid-template-columns: minmax(105px, 0.4fr) 1fr;
        gap: 8px;
        padding: 5px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--divider-color) 60%, transparent);
      }

      dt,
      .text-block small,
      .next-topic small,
      .interaction-details small {
        color: var(--text-color-muted);
        font-size: 0.72rem;
      }

      dd {
        margin: 0;
      }

      .next-topic,
      .text-block {
        margin-top: 9px;
      }

      .next-topic p,
      .text-block p {
        margin: 3px 0 0;
        white-space: pre-wrap;
      }

      .last-summary {
        margin-bottom: 8px;
        white-space: pre-wrap;
      }

      .context-line {
        margin-top: 5px;
        font-size: 0.82rem;
      }

      .contact-form,
      .interaction-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .contact-form label,
      .interaction-form label {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 4px;
      }

      label > span {
        color: var(--text-color-muted);
        font-size: 0.73rem;
      }

      label > small {
        color: var(--text-color-muted);
        font-size: 0.65rem;
      }

      input,
      textarea,
      select {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 9px;
        border: 1px solid var(--divider-color);
        border-radius: 7px;
        outline: 0;
        background: var(--bg);
        color: inherit;
        font: inherit;
      }

      textarea {
        resize: vertical;
      }

      .wide {
        grid-column: 1 / -1;
      }

      .form-divider {
        margin-top: 5px;
        padding-top: 9px;
        border-top: 1px solid var(--divider-color);
        font-weight: 700;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }

      .quick-followup {
        gap: 6px;
        margin: 8px 0;
      }

      .quick-followup input:first-child {
        flex: 1;
      }

      .quick-followup input[type='date'] {
        width: auto;
      }

      .followup-row {
        min-height: 38px;
        gap: 7px;
        border-top: 1px solid color-mix(in srgb, var(--divider-color) 65%, transparent);
      }

      .followup-row.done {
        opacity: 0.55;
      }

      .followup-row.done .grow {
        text-decoration: line-through;
      }

      .check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }

      .linked {
        opacity: 0.7;
      }

      .grow {
        flex: 1;
        min-width: 0;
      }

      .timeline {
        position: relative;
      }

      .interaction {
        position: relative;
        display: grid;
        grid-template-columns: 20px 1fr;
        gap: 8px;
        padding-bottom: 16px;
      }

      .interaction:not(:last-child)::before {
        position: absolute;
        top: 18px;
        bottom: -2px;
        left: 7px;
        width: 1px;
        background: var(--divider-color);
        content: '';
      }

      .timeline-marker {
        z-index: 1;
        width: 9px;
        height: 9px;
        margin-top: 5px;
        margin-left: 3px;
        border: 2px solid var(--c-accent);
        border-radius: 50%;
        background: var(--bg);
      }

      .interaction-body header {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .interaction-body header > div {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .summary {
        margin: 6px 0;
        white-space: pre-wrap;
      }

      .interaction-details {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .interaction-details > div {
        padding: 6px 8px;
        border-radius: 7px;
        background: var(--state-hover);
      }

      .interaction-details p {
        margin: 3px 0 0;
        white-space: pre-wrap;
      }

      .danger-zone {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
        opacity: 0.8;
      }

      .muted {
        color: var(--text-color-muted);
      }

      .empty-list,
      .empty-detail,
      .timeline-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 28px 16px;
        color: var(--text-color-muted);
        text-align: center;
      }

      .empty-detail {
        min-height: 440px;
      }

      .empty-detail mat-icon,
      .timeline-empty mat-icon {
        width: 40px;
        height: 40px;
        font-size: 40px;
      }

      /* Networking UX refresh — intentionally scoped to this page only. */
      .people-panel-head,
      .editor-head,
      .editor-title,
      .editor-section-intro,
      .detail-field-title,
      .editor-footer,
      .editor-progress,
      .people-group-head,
      .person-leading,
      .person-trailing {
        display: flex;
        align-items: center;
      }

      .people-panel-head {
        min-height: 54px;
        justify-content: space-between;
        gap: 10px;
        padding: 7px 8px 7px 12px;
        border-bottom: 1px solid var(--divider-color);
      }

      .people-panel-head > div {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 2px;
      }

      .people-panel-head small,
      .search-help {
        color: var(--text-color-muted);
        font-size: 0.68rem;
      }

      .search-help {
        display: block;
        padding: 5px 2px 0;
        line-height: 1.35;
      }

      .people-list {
        padding: 6px 7px 10px;
      }

      .people-group + .people-group {
        margin-top: 8px;
      }

      .people-group-head {
        position: sticky;
        z-index: 2;
        top: 0;
        gap: 6px;
        min-height: 28px;
        padding: 3px 6px;
        background: color-mix(in srgb, var(--bg-lighter) 92%, transparent);
        color: var(--text-color-muted);
        font-size: 0.7rem;
      }

      .people-group-head strong {
        flex: 1;
        color: var(--text-color);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .people-group-head > span:last-child {
        opacity: 0.58;
      }

      .group-emoji {
        font-size: 0.82rem;
      }

      .person-row {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr) auto;
        gap: 7px;
        align-items: center;
        min-height: 58px;
        margin: 2px 0;
        padding: 7px 6px;
        border: 1px solid transparent;
        border-radius: var(--card-border-radius);
      }

      .person-row:hover {
        border-color: var(--divider-color);
        background: var(--task-detail-bg-hover, var(--state-hover));
      }

      .person-row.selected {
        border-color: color-mix(in srgb, var(--c-primary) 48%, var(--divider-color));
        background: var(--task-detail-bg-hover, var(--state-hover));
      }

      .person-row.due:not(.selected) {
        box-shadow: none;
        border-left-color: var(--c-accent);
      }

      .person-leading {
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--state-hover);
        color: var(--text-color-muted);
      }

      .person-leading mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }

      .person-main {
        min-width: 0;
      }

      .person-top {
        gap: 6px;
        min-width: 0;
      }

      .person-top strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .row-status {
        flex: 0 0 auto;
        padding: 1px 5px;
        border-radius: 999px;
        background: var(--state-hover);
        font-size: 0.62rem;
        font-weight: 700;
      }

      .row-status.overdue {
        color: var(--c-warn);
      }

      .row-status.today {
        color: var(--c-accent);
      }

      .person-trailing {
        align-self: stretch;
        justify-content: center;
        flex-direction: column;
        gap: 1px;
        color: var(--text-color-muted);
      }

      .person-trailing mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
        opacity: 0.45;
      }

      .person-trailing .contact-date {
        max-width: 84px;
        font-size: 0.62rem;
      }

      .editor-shell {
        overflow: hidden;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg, var(--bg-lighter));
      }

      .editor-head {
        min-height: 70px;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 10px 10px 14px;
        border-bottom: 1px solid var(--divider-color);
      }

      .editor-title {
        min-width: 0;
        gap: 10px;
      }

      .editor-title-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
        border-radius: 50%;
        background: var(--state-hover);
        font-size: 20px;
      }

      .editor-title h2 {
        margin: 0 0 2px;
        font-size: 1.08rem;
      }

      .editor-title p {
        margin: 0;
        color: var(--text-color-muted);
        font-size: 0.74rem;
      }

      .editor-carousel {
        display: flex;
        gap: 3px;
        overflow-x: auto;
        padding: 7px;
        border-bottom: 1px solid var(--divider-color);
        scrollbar-width: thin;
      }

      .editor-carousel button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 34px;
        padding: 5px 9px;
        border: 1px solid transparent;
        border-radius: 999px;
        background: transparent;
        color: var(--text-color-muted);
        font: inherit;
        font-size: 0.72rem;
        white-space: nowrap;
        cursor: pointer;
        transition: var(--transition-standard);
      }

      .editor-carousel button:hover {
        background: var(--task-detail-bg-hover, var(--state-hover));
        color: var(--text-color);
      }

      .editor-carousel button.active {
        border-color: var(--divider-color);
        background: var(--state-selected);
        color: var(--text-color);
        font-weight: 700;
      }

      .section-emoji {
        font-size: 0.8rem;
      }

      .native-detail-form {
        display: block;
      }

      .editor-section {
        max-width: 820px;
        margin: 0 auto;
        padding: 11px 8px 6px;
      }

      .editor-section-intro {
        gap: 9px;
        padding: 4px 7px 10px;
      }

      .editor-section-intro > span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border-radius: 50%;
        background: var(--state-hover);
        font-size: 17px;
      }

      .editor-section-intro h3 {
        margin: 0 0 2px;
        font-size: 0.9rem;
      }

      .editor-section-intro p {
        margin: 0;
        color: var(--text-color-muted);
        font-size: 0.7rem;
        line-height: 1.35;
      }

      .detail-field {
        display: grid !important;
        grid-template-columns: minmax(190px, 44%) minmax(0, 56%);
        align-items: center;
        gap: 8px;
        min-height: 54px;
        margin: 7px 0;
        padding: 5px 8px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg, var(--bg-lighter));
        transition: var(--transition-standard);
      }

      .detail-field:hover,
      .detail-field:focus-within {
        background: var(--task-detail-bg-hover, var(--state-hover));
      }

      .detail-field:focus-within {
        border-color: var(--palette-primary-400, var(--c-primary));
      }

      .detail-field-title {
        min-width: 0;
        gap: 8px;
      }

      .detail-field-title > mat-icon {
        flex: 0 0 20px;
        width: 20px;
        height: 20px;
        color: var(--text-color-muted);
        font-size: 20px;
      }

      .detail-field-title > span {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 1px;
      }

      .detail-field-title b {
        color: var(--text-color);
        font-size: 0.78rem;
        font-weight: 650;
      }

      .detail-field-title small {
        color: var(--text-color-muted);
        font-size: 0.63rem;
        line-height: 1.3;
      }

      .detail-field-control {
        min-width: 0;
      }

      .detail-field-control input,
      .detail-field-control select,
      .detail-field-control textarea {
        width: 100%;
        min-height: 38px;
        padding: 6px 8px;
        border: 1px solid color-mix(in srgb, var(--divider-color) 85%, transparent);
        border-radius: 7px;
        outline: 0;
        background: var(--bg);
        color: var(--text-color);
        font: inherit;
        font-size: 0.78rem;
      }

      .detail-field-control textarea {
        min-height: 72px;
        resize: vertical;
      }

      .detail-field-control input:focus,
      .detail-field-control select:focus,
      .detail-field-control textarea:focus {
        border-color: var(--c-primary);
      }

      .detail-field.tall {
        align-items: flex-start;
        padding-block: 8px;
      }

      .detail-field.tall .detail-field-title {
        padding-top: 7px;
      }

      .notes-field .detail-field-control textarea {
        min-height: 220px;
      }

      .editor-tip {
        display: flex;
        gap: 8px;
        margin: 8px 2px;
        padding: 9px 10px;
        border: 1px dashed var(--divider-color);
        border-radius: var(--card-border-radius);
        color: var(--text-color-muted);
        font-size: 0.7rem;
      }

      .editor-tip p {
        margin: 0;
      }

      .editor-footer {
        justify-content: space-between;
        gap: 10px;
        min-height: 56px;
        padding: 7px 10px;
        border-top: 1px solid var(--divider-color);
      }

      .editor-progress {
        min-width: 140px;
        gap: 7px;
        color: var(--text-color-muted);
        font-size: 0.68rem;
      }

      .progress-track {
        display: block;
        width: 90px;
        height: 3px;
        overflow: hidden;
        border-radius: 99px;
        background: var(--divider-color);
      }

      .progress-fill {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--c-primary);
        transition: width 180ms ease;
      }

      .conversation-editor {
        margin-bottom: 10px;
      }

      .conversation-section {
        max-width: 900px;
      }

      .conversation-summary .detail-field-control textarea {
        min-height: 130px;
      }

      .conversation-pair {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .conversation-pair .detail-field {
        grid-template-columns: 1fr;
        align-content: start;
        margin: 0;
      }

      .conversation-pair .detail-field-title {
        padding-top: 0;
      }

      .next-step-intro {
        margin-top: 10px;
        padding-top: 11px;
        border-top: 1px solid var(--divider-color);
      }

      .conversation-footer {
        min-height: 58px;
      }

      .conversation-hint {
        color: var(--text-color-muted);
        font-size: 0.68rem;
      }

      .profile .context-grid mat-card,
      .profile .profile-grid mat-card,
      .profile .followup-card,
      .profile .timeline-card {
        box-shadow: none;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg, var(--bg-lighter));
      }

      .profile .mini-head strong,
      .profile .section-head h3 {
        font-size: 0.86rem;
      }

      .profile .timeline-card .interaction-details > div {
        border: 1px solid color-mix(in srgb, var(--divider-color) 72%, transparent);
        background: var(--task-detail-bg-hover, var(--state-hover));
      }


      .profile-carousel {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        margin-bottom: 10px;
        padding: 5px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg, var(--bg-lighter));
      }

      .profile-carousel button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 5px 10px;
        border: 1px solid transparent;
        border-radius: 999px;
        background: transparent;
        color: var(--text-color-muted);
        font: inherit;
        font-size: 0.73rem;
        cursor: pointer;
        white-space: nowrap;
        transition: var(--transition-standard);
      }

      .profile-carousel button:hover {
        background: var(--task-detail-bg-hover, var(--state-hover));
        color: var(--text-color);
      }

      .profile-carousel button.active {
        border-color: var(--divider-color);
        background: var(--state-selected);
        color: var(--text-color);
        font-weight: 700;
      }

      .profile-carousel small {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding-inline: 4px;
        border-radius: 999px;
        background: var(--state-hover);
        font-size: 0.62rem;
      }

      @media (max-width: 900px) {
        .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .workspace {
          grid-template-columns: 270px minmax(0, 1fr);
        }

        .context-grid,
        .profile-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 700px) {
        .networking-page {
          padding: 12px 9px 96px;
        }

        .page-head,
        .profile-head {
          align-items: stretch;
          flex-direction: column;
        }

        .workspace {
          display: block;
        }

        .people-panel {
          margin-bottom: 10px;
        }

        .people-list {
          max-height: 310px;
        }

        .contact-form,
        .interaction-form,
        .interaction-details {
          grid-template-columns: 1fr;
        }

        .wide {
          grid-column: auto;
        }

        .profile-actions {
          flex-wrap: wrap;
        }

        .quick-followup {
          align-items: stretch;
          flex-direction: column;
        }

        .quick-followup input[type='date'] {
          width: 100%;
        }

        input,
        select {
          min-height: 44px;
        }
      }

      @media (max-width: 700px) {
        .people-panel-head {
          min-height: 50px;
        }

        .person-row {
          grid-template-columns: 32px minmax(0, 1fr) auto;
          min-height: 54px;
          padding-inline: 5px;
        }

        .editor-head {
          min-height: 62px;
        }

        .editor-title p {
          display: none;
        }

        .editor-carousel {
          padding-inline: 6px;
        }

        .editor-carousel button {
          min-height: 38px;
        }

        .detail-field {
          grid-template-columns: 1fr;
          gap: 5px;
          padding: 8px;
        }

        .detail-field-title small {
          font-size: 0.66rem;
        }

        .detail-field.tall .detail-field-title {
          padding-top: 0;
        }

        .editor-footer {
          align-items: stretch;
          flex-direction: column;
        }

        .editor-progress {
          width: 100%;
        }

        .progress-track {
          flex: 1;
          width: auto;
        }

        .editor-footer .form-actions {
          flex-wrap: wrap;
        }
      }

      @media (max-width: 700px) {
        .conversation-pair {
          grid-template-columns: 1fr;
        }

        .conversation-hint {
          display: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkingPageComponent {
  readonly networking = inject(NetworkingService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _dateTimeFormat = inject(DateTimeFormatService);
  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  readonly today = getDbDateStr();
  readonly query = signal('');
  readonly filter = signal<NetworkingFilter>('ALL');
  readonly selectedId = signal<string | null>(null);
  readonly contactEditorOpen = signal(false);
  readonly editingContactId = signal<string | null>(null);
  readonly interactionEditorOpen = signal(false);
  readonly contactEditorSection = signal<ContactEditorSection>('BASIC');
  readonly profileSection = signal<ProfileSection>('OVERVIEW');

  readonly cadenceOptions = NETWORK_CADENCE_OPTIONS;
  readonly relationshipOptions = NETWORK_RELATIONSHIP_OPTIONS;
  readonly importanceOptions = NETWORK_IMPORTANCE_OPTIONS;
  readonly channelOptions = NETWORK_CHANNEL_OPTIONS;

  readonly contactSections: ReadonlyArray<{
    id: ContactEditorSection;
    label: string;
    emoji: string;
  }> = [
    { id: 'BASIC', label: 'Basic', emoji: '👤' },
    { id: 'WORK', label: 'Work', emoji: '💼' },
    { id: 'CONTEXT', label: 'Context', emoji: '📍' },
    { id: 'RELATIONSHIP', label: 'Relație', emoji: '🤝' },
    { id: 'FOLLOW_UP', label: 'Follow-up', emoji: '🗓️' },
    { id: 'NOTES', label: 'Note', emoji: '📝' },
  ];

  readonly profileSections: ReadonlyArray<{
    id: ProfileSection;
    label: string;
    emoji: string;
  }> = [
    { id: 'OVERVIEW', label: 'Overview', emoji: '✨' },
    { id: 'FOLLOW_UPS', label: 'Follow-up', emoji: '✅' },
    { id: 'HISTORY', label: 'Conversații', emoji: '💬' },
  ];

  readonly filters: ReadonlyArray<{ id: NetworkingFilter; label: string }> = [
    { id: 'ALL', label: 'Toate' },
    { id: 'DUE', label: 'De contactat' },
    { id: 'UPCOMING', label: 'Urmează' },
    { id: 'NO_REMINDER', label: 'Fără reminder' },
    { id: 'ARCHIVED', label: 'Arhivate' },
  ];

  contactDraft: ContactDraft = this._emptyContactDraft();
  interactionDraft: InteractionDraft = this._emptyInteractionDraft();

  readonly filteredContacts = computed(() => {
    const source =
      this.filter() === 'ARCHIVED'
        ? this.networking.archivedContacts()
        : this.networking.search(this.query());

    const query = this.query().trim();
    const data =
      this.filter() === 'ARCHIVED' && query
        ? source.filter((contact) =>
            this.networking
              .search(query, true)
              .some((candidate) => candidate.id === contact.id),
          )
        : source;

    switch (this.filter()) {
      case 'DUE':
        return data.filter((contact) => this.isDue(contact));
      case 'UPCOMING':
        return data.filter(
          (contact) =>
            !!contact.nextContactDay &&
            contact.nextContactDay > this.today &&
            contact.nextContactDay <= addCalendarDays(this.today, 7),
        );
      case 'NO_REMINDER':
        return data.filter((contact) => !contact.nextContactDay);
      case 'ARCHIVED':
      case 'ALL':
      default:
        return data;
    }
  });

  readonly peopleGroups = computed(() => {
    const contacts = this.filteredContacts();

    if (this.filter() !== 'ALL') {
      const meta: Record<NetworkingFilter, { label: string; emoji: string }> = {
        ALL: { label: 'Toate persoanele', emoji: '👥' },
        DUE: { label: 'De contactat', emoji: '⏰' },
        UPCOMING: { label: 'Urmează', emoji: '📅' },
        NO_REMINDER: { label: 'Fără reminder', emoji: '💤' },
        ARCHIVED: { label: 'Arhivate', emoji: '🗃️' },
      };
      return [
        {
          id: this.filter(),
          label: meta[this.filter()].label,
          emoji: meta[this.filter()].emoji,
          contacts,
        },
      ];
    }

    const sevenDays = addCalendarDays(this.today, 7);
    return [
      {
        id: 'OVERDUE',
        label: 'Restante',
        emoji: '⏰',
        contacts: contacts.filter(
          (contact) => !!contact.nextContactDay && contact.nextContactDay < this.today,
        ),
      },
      {
        id: 'TODAY',
        label: 'Astăzi',
        emoji: '☀️',
        contacts: contacts.filter((contact) => contact.nextContactDay === this.today),
      },
      {
        id: 'UPCOMING',
        label: 'Următoarele 7 zile',
        emoji: '📅',
        contacts: contacts.filter(
          (contact) =>
            !!contact.nextContactDay &&
            contact.nextContactDay > this.today &&
            contact.nextContactDay <= sevenDays,
        ),
      },
      {
        id: 'LATER',
        label: 'Mai târziu',
        emoji: '🌱',
        contacts: contacts.filter(
          (contact) => !!contact.nextContactDay && contact.nextContactDay > sevenDays,
        ),
      },
      {
        id: 'NO_REMINDER',
        label: 'Fără reminder',
        emoji: '💤',
        contacts: contacts.filter((contact) => !contact.nextContactDay),
      },
    ];
  });

  readonly selectedContact = computed(() => this.networking.contact(this.selectedId()));

  readonly interactions = computed(() => {
    const id = this.selectedId();
    return id ? this.networking.interactionsForContact(id) : [];
  });

  readonly latestInteraction = computed(() => this.interactions()[0]);

  readonly followUps = computed(() => {
    const id = this.selectedId();
    return id ? this.networking.followUpsForContact(id) : [];
  });

  readonly openFollowUps = computed(() =>
    this.followUps().filter((item) => item.status === 'OPEN'),
  );

  constructor() {
    effect(() => {
      const queryContact = this._queryParams().get('contact');
      if (queryContact && this.networking.contact(queryContact)) {
        this.selectedId.set(queryContact);
        this.filter.set('ALL');
        return;
      }

      const selected = this.selectedId();
      if (selected && this.networking.contact(selected)) return;

      const first = this.filteredContacts()[0];
      this.selectedId.set(first?.id ?? null);
    });
  }

  filterCount(filter: NetworkingFilter): number {
    switch (filter) {
      case 'DUE':
        return this.networking.dueContacts().length;
      case 'UPCOMING':
        return this.networking.upcomingContacts().length;
      case 'NO_REMINDER':
        return this.networking.contacts().filter((contact) => !contact.nextContactDay)
          .length;
      case 'ARCHIVED':
        return this.networking.archivedContacts().length;
      case 'ALL':
      default:
        return this.networking.contacts().length;
    }
  }

  isDue(contact: NetworkContact): boolean {
    return !!contact.nextContactDay && contact.nextContactDay <= this.today;
  }

  selectContact(id: string): void {
    this.profileSection.set('OVERVIEW');
    this.selectedId.set(id);
    this.contactEditorOpen.set(false);
    this.interactionEditorOpen.set(false);
  }

  startNewContact(): void {
    this.contactEditorSection.set('BASIC');
    this.editingContactId.set(null);
    this.contactDraft = this._emptyContactDraft();
    this.contactEditorOpen.set(true);
    this.interactionEditorOpen.set(false);
  }

  startEditContact(contact: NetworkContact): void {
    this.contactEditorSection.set('BASIC');
    this.editingContactId.set(contact.id);
    this.contactDraft = {
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      instagram: contact.instagram || '',
      facebook: contact.facebook || '',
      linkedin: contact.linkedin || '',
      city: contact.city || '',
      region: contact.region || '',
      country: contact.country || '',
      occupation: contact.occupation || '',
      role: contact.role || '',
      company: contact.company || '',
      industry: contact.industry || '',
      metThrough: contact.metThrough || '',
      introducedByContactId: contact.introducedByContactId || '',
      metAt: contact.metAt || '',
      metOn: contact.metOn || '',
      relationshipType: contact.relationshipType,
      importance: contact.importance,
      tags: contact.tags.join(', '),
      interests: contact.interests || '',
      canHelpWith: contact.canHelpWith || '',
      canHelpMeWith: contact.canHelpMeWith || '',
      notes: contact.notes || '',
      cadence: contact.cadence,
      cadenceDays: contact.cadenceDays ? String(contact.cadenceDays) : '',
      nextContactDay: contact.nextContactDay || '',
      nextTopic: contact.nextTopic || '',
    };
    this.contactEditorOpen.set(true);
    this.interactionEditorOpen.set(false);
  }

  contactSectionIndex(): number {
    const index = this.contactSections.findIndex(
      (section) => section.id === this.contactEditorSection(),
    );
    return index < 0 ? 0 : index;
  }

  previousContactSection(): void {
    const index = this.contactSectionIndex();
    if (index > 0) {
      this.contactEditorSection.set(this.contactSections[index - 1].id);
    }
  }

  nextContactSection(): void {
    const index = this.contactSectionIndex();
    if (index < this.contactSections.length - 1) {
      this.contactEditorSection.set(this.contactSections[index + 1].id);
    }
  }

  cancelContactEdit(): void {
    this.contactEditorOpen.set(false);
    this.editingContactId.set(null);
  }

  saveContact(): void {
    const name = this.contactDraft.name.trim();
    if (!name) return;

    const input: NetworkContactInput = {
      name,
      phone: this._clean(this.contactDraft.phone),
      email: this._clean(this.contactDraft.email),
      instagram: this._clean(this.contactDraft.instagram),
      facebook: this._clean(this.contactDraft.facebook),
      linkedin: this._clean(this.contactDraft.linkedin),
      city: this._clean(this.contactDraft.city),
      region: this._clean(this.contactDraft.region),
      country: this._clean(this.contactDraft.country),
      occupation: this._clean(this.contactDraft.occupation),
      role: this._clean(this.contactDraft.role),
      company: this._clean(this.contactDraft.company),
      industry: this._clean(this.contactDraft.industry),
      metThrough: this._clean(this.contactDraft.metThrough),
      introducedByContactId: this.contactDraft.introducedByContactId || null,
      metAt: this._clean(this.contactDraft.metAt),
      metOn: this.contactDraft.metOn || null,
      relationshipType: this.contactDraft.relationshipType,
      importance: this.contactDraft.importance,
      tags: this._tags(this.contactDraft.tags),
      interests: this._clean(this.contactDraft.interests),
      canHelpWith: this._clean(this.contactDraft.canHelpWith),
      canHelpMeWith: this._clean(this.contactDraft.canHelpMeWith),
      notes: this._clean(this.contactDraft.notes),
      cadence: this.contactDraft.cadence,
      cadenceDays: this.contactDraft.cadenceDays
        ? Math.max(1, Number(this.contactDraft.cadenceDays))
        : null,
      nextContactDay: this.contactDraft.nextContactDay || null,
      nextTopic: this._clean(this.contactDraft.nextTopic),
    };

    const editingId = this.editingContactId();
    if (editingId) {
      this.networking.updateContact(editingId, input);
      this.selectedId.set(editingId);
    } else {
      this.selectedId.set(this.networking.addContact(input));
    }

    this.contactEditorOpen.set(false);
    this.editingContactId.set(null);
    this.filter.set('ALL');
  }

  startInteraction(): void {
    this.profileSection.set('HISTORY');
    this.interactionDraft = this._emptyInteractionDraft();
    this.interactionEditorOpen.set(true);
  }

  saveInteraction(contactId: string): void {
    if (!this.interactionDraft.summary.trim()) return;
    const at = new Date(this.interactionDraft.at).getTime();
    const safeAt = Number.isFinite(at) ? at : Date.now();

    const input: NetworkInteractionInput = {
      at: safeAt,
      channel: this.interactionDraft.channel,
      location: this._clean(this.interactionDraft.location),
      summary: this.interactionDraft.summary.trim(),
      learned: this._clean(this.interactionDraft.learned),
      iPromised: this._clean(this.interactionDraft.iPromised),
      theyPromised: this._clean(this.interactionDraft.theyPromised),
      nextStep: this._clean(this.interactionDraft.nextStep),
      nextTopic: this._clean(this.interactionDraft.nextTopic),
      nextContactDay: this.interactionDraft.nextContactDay || undefined,
      followUpTitle: this._clean(this.interactionDraft.followUpTitle),
      followUpDueDay: this.interactionDraft.followUpDueDay || null,
    };

    this.networking.logInteraction(contactId, input);
    this.interactionEditorOpen.set(false);
    this.interactionDraft = this._emptyInteractionDraft();
  }

  addFollowUp(contactId: string, title: string, dueDay: string): void {
    if (!title.trim()) return;
    this.networking.addFollowUp(contactId, title, dueDay || null);
  }

  toggleFollowUp(id: string, current: string): void {
    this.networking.setFollowUpStatus(id, current === 'DONE' ? 'OPEN' : 'DONE');
  }

  createTask(id: string): void {
    this.networking.createTaskForFollowUp(id);
  }

  archiveSelected(id: string): void {
    this.networking.archiveContact(id, true);
    this.filter.set('ALL');
    this.selectedId.set(this.networking.contacts()[0]?.id ?? null);
  }

  introductionOptions(): NetworkContact[] {
    const editingId = this.editingContactId();
    return this.networking.contacts().filter((contact) => contact.id !== editingId);
  }

  introducedByName(contact: NetworkContact): string {
    return this.networking.contact(contact.introducedByContactId)?.name || '';
  }

  locationLabel(contact: NetworkContact): string {
    return [contact.city, contact.region, contact.country].filter(Boolean).join(', ');
  }

  relationshipLabel(value: NetworkRelationshipType): string {
    return this.relationshipOptions.find((item) => item.value === value)?.label ?? value;
  }

  importanceLabel(value: NetworkImportance): string {
    return this.importanceOptions.find((item) => item.value === value)?.label ?? value;
  }

  cadenceLabel(value: NetworkContactCadence, cadenceDays?: number | null): string {
    if (value === 'CUSTOM' && cadenceDays) return `Every ${cadenceDays} days`;
    return this.cadenceOptions.find((item) => item.value === value)?.label ?? value;
  }

  channelLabel(value: NetworkInteractionChannel): string {
    return this.channelOptions.find((item) => item.value === value)?.label ?? value;
  }

  dateLabel(timestamp: number): string {
    return new Intl.DateTimeFormat(this._dateTimeFormat.textLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(timestamp));
  }

  dateTimeLabel(timestamp: number): string {
    return new Intl.DateTimeFormat(this._dateTimeFormat.textLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  socialUrl(type: 'instagram' | 'facebook' | 'linkedin', raw: string): string {
    const value = raw.trim();
    if (/^https?:\/\//i.test(value)) return value;
    const clean = value.replace(/^@/, '').replace(/^\/+/, '');
    if (type === 'instagram') return `https://instagram.com/${clean}`;
    if (type === 'facebook') return `https://facebook.com/${clean}`;
    return clean.includes('linkedin.com')
      ? `https://${clean}`
      : `https://linkedin.com/in/${clean}`;
  }

  private _emptyContactDraft(): ContactDraft {
    return {
      name: '',
      phone: '',
      email: '',
      instagram: '',
      facebook: '',
      linkedin: '',
      city: '',
      region: '',
      country: 'România',
      occupation: '',
      role: '',
      company: '',
      industry: '',
      metThrough: '',
      introducedByContactId: '',
      metAt: '',
      metOn: '',
      relationshipType: 'PROFESSIONAL',
      importance: 'NORMAL',
      tags: '',
      interests: '',
      canHelpWith: '',
      canHelpMeWith: '',
      notes: '',
      cadence: 'MONTHLY',
      cadenceDays: '',
      nextContactDay: '',
      nextTopic: '',
    };
  }

  private _emptyInteractionDraft(): InteractionDraft {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localIso = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    return {
      at: localIso,
      channel: 'MEETING',
      location: '',
      summary: '',
      learned: '',
      iPromised: '',
      theyPromised: '',
      nextStep: '',
      nextTopic: '',
      nextContactDay: '',
      followUpTitle: '',
      followUpDueDay: '',
    };
  }

  private _clean(value: string): string | undefined {
    const clean = value.trim();
    return clean || undefined;
  }

  private _tags(raw: string): string[] {
    return raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
}
