export interface SubjectItem {
  id: string;
  en: string;
  or: string;
  code: string;
}

export const SUBJECTS: SubjectItem[] = [
  { id: 'mathematics', en: 'Mathematics', or: 'ଗଣିତ', code: 'MTH' },
  { id: 'physical_science', en: 'Physical Science', or: 'ଭୌତିକ ବିଜ୍ଞାନ', code: 'PSC' },
  { id: 'life_science', en: 'Life Science', or: 'ଜୀବ ବିଜ୍ଞାନ', code: 'LSC' },
  { id: 'english', en: 'English', or: 'ଇଂରାଜୀ', code: 'ENG' },
  { id: 'mil_odia', en: 'MIL Odia', or: 'ସାହିତ୍ୟ', code: 'ODI' },
  { id: 'sanskrit', en: 'Sanskrit', or: 'ସଂସ୍କୃତ', code: 'SKT' },
  { id: 'history_polity', en: 'History & Political Science', or: 'ଇତିହାସ ଓ ରାଜନୀତି ବିଜ୍ଞାନ', code: 'HIS' },
  { id: 'geography', en: 'Geography', or: 'ଭୂଗୋଳ', code: 'GEO' },
];

export const GALLERY_CATEGORIES = [
  { id: 'all', en: 'All Photos', or: 'ସମସ୍ତ ଫଟୋ' },
  { id: 'tournament', en: 'Sports & Tournament', or: 'କ୍ରୀଡ଼ା ଓ ଟୁର୍ଣ୍ଣାମେଣ୍ଟ' },
  { id: 'event', en: 'School Events', or: 'ବିଦ୍ୟାଳୟ ଉତ୍ସବ' },
  { id: 'notice', en: 'Notice Board', or: 'ବିଜ୍ଞପ୍ତି ଫଳକ' },
  { id: 'campus', en: 'Campus Life', or: 'ବିଦ୍ୟାଳୟ ପରିସର' },
] as const;

export const ASSETS = {
  campusHero: '/src/assets/images/school_campus_hero_1795752362082.jpg',
  crest: '/src/assets/images/school_crest_emblem_1795752364851.jpg',
  sports: '/src/assets/images/gallery_sports_tournament_1795752362598.jpg',
  science: '/src/assets/images/gallery_science_exhibition_1795752365344.jpg',
  cultural: '/src/assets/images/gallery_cultural_event_1795752366108.jpg',
} as const;

export function getSubjectLabel(subjectId: string, lang: 'en' | 'or'): string {
  const found = SUBJECTS.find((s) => s.id === subjectId);
  if (!found) return subjectId;
  return lang === 'or' ? `${found.or} (${found.en})` : found.en;
}

export function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
