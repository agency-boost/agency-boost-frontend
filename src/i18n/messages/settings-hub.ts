import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Pengaturan*, the hub** (`/kpm/settings`, P19.21-T2 AC-1, AC-2; ADR-0274 §6;
 * `revisions/2026-11-19/files/UI/mockups/data-upload-pengaturan-*-stopmotion-2026-11-19.html`, frames 11–12): the orange
 * bar while a setting has changes agents do not see, then the eleven settings in five groups, each row a name, one line
 * and a status only when the owner must act.
 *
 * The settings' names are their menu items, kept English (§A.1) — *Tampilan KPM* excepted, which is §B7's. The group
 * headings and the lines are the mockup's Indonesian, verbatim; a count is written as it was.
 *
 * @moved app/(tenant)/kpm/settings/page.tsx
 */
const en = {
  title: 'Settings',
  /** A screen reader's name for each group's list. */
  groups: {
    activity: 'Activity & leads',
    newAgents: 'New agents & training',
    events: 'Events & campaigns',
    products: 'Products & recruitment',
    kpm: kept('KPM'),
  },
  names: {
    activity_types: kept('Activity types'),
    lead_statuses: kept('Lead statuses'),
    activation_checklist: kept('Activation checklist'),
    training: kept('Training'),
    capability_mapping: kept('Capability Mapping'),
    events: kept('Events'),
    campaigns: kept('Campaigns'),
    products: kept('Products'),
    recruitment_pitch: kept('Recruitment pitch'),
    branch_info: kept('Branch info'),
    branding: 'KPM branding',
  },
  lines: {
    activityTypes: ({ activities, categories }: { activities: number; categories: number }) =>
      `${activities} activity types · ${categories} categories · ratio benchmarks`,
    leadStatuses: 'Sales and recruitment pipeline stages',
    activation: ({ days, version }: { days: number; version: number | null }) =>
      (version === null ? `${days} days for a new hire` : `${days} days for a new hire · version ${version}`),
    training: ({ categories, skills, modules }: { categories: number; skills: number; modules: number }) =>
      `${categories} categories · ${skills} skills · ${modules} modules`,
    capability: ({ stages, groups }: { stages: number; groups: number }) =>
      `Ladder ${stages} stages · skill tracker ${groups} groups`,
    events: 'KPM events and attendee feedback',
    campaigns: 'Structural & seasonal',
    products: ({ products, sold }: { products: number; sold: number }) => `${products} products · ${sold} sold by agents`,
    pitch: ({ n }: { n: number }) => `${n} recruitment presentation materials`,
    branchInfo: ({ code, month }: { code: string; month: string }) => `KPM code ${code} · book year from ${month}`,
    branding: 'System name, logo, colours, mascot',
  },
  status: {
    unpublished: 'Not published',
    waiting: ({ n }: { n: number }) => `${n} waiting`,
    missing: ({ n }: { n: number }) => `${n} missing`,
    noLogo: 'No logo yet',
  },
  /** The bar (AC-1): one setting named, or how many. */
  bar: {
    one: ({ name }: { name: string }) => `${name} has changes that are not published.`,
    several: ({ n }: { n: number }) => `${n} settings have changes that are not published.`,
    stillPrevious: 'Agents are still on the previous version.',
    publish: 'Publish',
    publishAll: 'Publish all',
    publishing: 'Publishing…',
  },
  cannotRead: 'Could not read your settings.',
  tryAgain: 'Try again',
  denied: 'Settings are for the KPM Owner, an Admin and core leaders.',
};

const id: MessagesOf<typeof en> = {
  title: 'Pengaturan',
  groups: {
    activity: `Aktivitas & ${kept('leads')}`,
    newAgents: `${kept('Agent')} baru & ${kept('Training')}`,
    events: `${kept('Event')} & ${kept('campaign')}`,
    products: 'Produk & rekrut',
    kpm: kept('KPM'),
  },
  names: {
    activity_types: kept('Activity types'),
    lead_statuses: kept('Lead statuses'),
    activation_checklist: kept('Activation checklist'),
    training: kept('Training'),
    capability_mapping: kept('Capability Mapping'),
    events: kept('Events'),
    campaigns: kept('Campaigns'),
    products: kept('Products'),
    recruitment_pitch: kept('Recruitment pitch'),
    branch_info: kept('Branch info'),
    branding: 'Tampilan KPM',
  },
  lines: {
    activityTypes: ({ activities, categories }) =>
      `${activities} jenis aktivitas · ${categories} kategori · ${kept('Ratio benchmarks')}`,
    leadStatuses: `Tahap ${kept('pipeline')} sales & rekrut`,
    activation: ({ days, version }) =>
      (version === null ? `${days} hari untuk ${kept('new hire')}` : `${days} hari untuk ${kept('new hire')} · versi ${version}`),
    training: ({ categories, skills, modules }) =>
      `${categories} kategori · ${skills} ${kept('skill')} · ${modules} modul`,
    capability: ({ stages, groups }) => `${kept('Ladder')} ${stages} tahap · ${kept('Skill tracker')} ${groups} kelompok`,
    events: `Acara ${kept('KPM')} dan masukan peserta`,
    campaigns: 'Struktural & musiman',
    products: ({ products, sold }) => `${products} produk · ${sold} dijual agent`,
    pitch: ({ n }) => `${n} materi presentasi rekrut`,
    branchInfo: ({ code, month }) => `Kode ${kept('KPM')} ${code} · tahun buku ${month}`,
    branding: 'Nama sistem, logo, warna, maskot',
  },
  status: {
    unpublished: 'Belum diterbitkan',
    waiting: ({ n }) => `${n} menunggu`,
    missing: ({ n }) => `${n} belum ada`,
    noLogo: 'Logo belum ada',
  },
  bar: {
    one: ({ name }) => `${name} punya perubahan yang belum diterbitkan.`,
    several: ({ n }) => `${n} pengaturan punya perubahan yang belum diterbitkan.`,
    stillPrevious: `${kept('Agent')} masih memakai versi sebelumnya.`,
    publish: 'Terbitkan',
    publishAll: 'Terbitkan semua',
    publishing: 'Menerbitkan…',
  },
  cannotRead: 'Tidak dapat membaca pengaturan Anda.',
  tryAgain: 'Coba lagi',
  denied: `Pengaturan untuk ${kept('KPM Owner')}, ${kept('Admin')}, dan core leader.`,
};

export const settingsHubMessages = defineMessages({ en, id });
