import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Bell,
  MessageSquare,
  Images,
  ClipboardCheck,
  IdCard,
  Shield,
  FileText,
  Phone,
} from 'lucide-react';
import { ASSETS, formatShortDate, getSubjectLabel } from '../constants';
import { createTranslator } from '../i18n';
import {
  AuthUser,
  DashboardSummary,
  Language,
  PortalTab,
  SchoolNotice,
  StudyMaterial,
} from '../types';

interface OverviewTabProps {
  user: AuthUser;
  lang: Language;
  summary: DashboardSummary | null;
  notices: SchoolNotice[];
  materials: StudyMaterial[];
  teachersCount: number;
  onNavigate: (tab: PortalTab) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  user,
  lang,
  summary,
  notices,
  materials,
  teachersCount,
  onNavigate,
}) => {
  const t = createTranslator(lang);
  const isStaff = user.role === 'super_owner' || user.role === 'admin';

  const roleText =
    user.role === 'super_owner'
      ? t('roleSuperOwner')
      : user.role === 'admin'
      ? `${t('roleAdmin')} · Slot ${user.slotNumber}`
      : `${t('roleStudent')} · ${user.student?.class_level === 9 ? t('class9') : t('class10')} · Roll ${user.student?.roll_number}`;

  return (
    <div className="space-y-6">
      {/* Institutional Welcome Banner */}
      <section className="relative rounded-2xl overflow-hidden bg-blue-950 text-white border border-blue-900">
        <img
          src={ASSETS.campusHero}
          alt="L.N.K.S High School Campus"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-amber-300">
              {t('academicSession')} · {roleText}
            </p>
            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
              {t('welcomeBack')}, {user.name}
            </h1>
            <p className="mt-1.5 text-sm text-slate-200 leading-relaxed">
              {t('schoolName')} — {t('schoolOdiaSub')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('academics')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-blue-950 text-sm font-semibold hover:bg-slate-100 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t('navAcademics')}</span>
            </button>
            {user.role === 'student' && (
              <button
                type="button"
                onClick={() => onNavigate('idcard')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-900/90 border border-white/25 text-white text-sm font-semibold hover:bg-blue-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <IdCard className="w-4 h-4" />
                <span>{t('navIdCard')}</span>
              </button>
            )}
            {user.role === 'super_owner' && (
              <button
                type="button"
                onClick={() => onNavigate('owner')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span>{t('navOwner')}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Key Metrics Strip (Tabular Numerals) */}
      <section aria-label={t('quickStats')} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">{t('studyMaterials')}</p>
          <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold text-slate-900">
            {summary?.materialsCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t('class9')} · {t('class10')}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">{t('activeNotices')}</p>
          <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold text-slate-900">
            {summary?.noticesCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {lang === 'or' ? 'ସର୍ବଶେଷ ଘୋଷଣା' : 'Official updates'}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">{t('practiceQuestions')}</p>
          <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold text-slate-900">
            {summary?.quizzesCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {lang === 'or' ? 'ଅଭ୍ୟାସ ପରୀକ୍ଷା' : 'Board MCQ bank'}
          </p>
        </div>

        {isStaff ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-500">{t('registeredStudents')}</p>
            <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold text-blue-950">
              {summary?.studentsTotal ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-mono-num">
              {summary?.boysCount ?? 0} {t('boysOnly')} · {summary?.girlsCount ?? 0} {t('girlsOnly')}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-500">{t('studentMessages')}</p>
            <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold text-slate-900">
              {summary?.messagesCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {lang === 'or' ? 'ଶିକ୍ଷକଙ୍କ ସହ ଆଲୋଚନା' : 'Teacher doubt board'}
            </p>
          </div>
        )}
      </section>

      {/* Quick Action Shortcuts */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { tab: 'notices' as PortalTab, icon: Bell, label: t('navNotices'), count: summary?.noticesCount ?? 0 },
          { tab: 'messages' as PortalTab, icon: MessageSquare, label: t('navMessages'), count: summary?.messagesCount ?? 0 },
          { tab: 'teachers' as PortalTab, icon: Phone, label: t('navTeachers'), count: teachersCount },
          { tab: 'gallery' as PortalTab, icon: Images, label: t('navGallery'), count: summary?.galleryCount ?? 0 },
          { tab: 'quiz' as PortalTab, icon: ClipboardCheck, label: t('navQuiz'), count: summary?.quizzesCount ?? 0 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3.5 text-left hover:border-blue-900/40 hover:bg-blue-50/30 transition-colors min-h-[60px] cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-blue-900 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.label}</p>
                  <p className="text-xs text-slate-500 font-mono-num">{item.count}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          );
        })}
      </section>

      {/* 2-Column Recent Feed: Notices + Study Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Notices */}
        <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <h2 className="font-display text-base font-bold text-slate-900">{t('latestNotices')}</h2>
            <button
              type="button"
              onClick={() => onNavigate('notices')}
              className="text-xs font-semibold text-blue-900 hover:underline whitespace-nowrap cursor-pointer min-h-[36px] px-2"
            >
              {t('viewAll')}
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {notices.slice(0, 4).map((notice) => (
              <div key={notice.id} className="py-3.5 first:pt-4 last:pb-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span
                    className={
                      notice.priority === 'urgent'
                        ? 'font-semibold text-red-700'
                        : notice.priority === 'exam'
                        ? 'font-semibold text-amber-700'
                        : 'font-medium text-blue-900'
                    }
                  >
                    {notice.priority === 'urgent'
                      ? lang === 'or'
                        ? 'ଜରୁରୀ'
                        : 'Urgent'
                      : notice.priority === 'exam'
                      ? lang === 'or'
                        ? 'ପରୀକ୍ଷା'
                        : 'Exam'
                      : lang === 'or'
                      ? 'ସାଧାରଣ'
                      : 'Notice'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {notice.target_class === 'all'
                      ? t('allClasses')
                      : notice.target_class === '9'
                      ? t('class9')
                      : t('class10')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{formatShortDate(notice.created_at)}</span>
                </div>
                <h3 className="mt-1 text-sm font-semibold text-slate-900 leading-snug">
                  {lang === 'or' && notice.title_or ? notice.title_or : notice.title}
                </h3>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {lang === 'or' && notice.content_or ? notice.content_or : notice.content}
                </p>
              </div>
            ))}
            {notices.length === 0 && (
              <p className="py-6 text-sm text-slate-500">{t('noNotices')}</p>
            )}
          </div>
        </section>

        {/* Recent Study Materials */}
        <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <h2 className="font-display text-base font-bold text-slate-900">{t('recentMaterials')}</h2>
            <button
              type="button"
              onClick={() => onNavigate('academics')}
              className="text-xs font-semibold text-blue-900 hover:underline whitespace-nowrap cursor-pointer min-h-[36px] px-2"
            >
              {t('viewAll')}
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {materials.slice(0, 4).map((mat) => (
              <div key={mat.id} className="py-3.5 first:pt-4 last:pb-0 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-blue-900">Class {mat.class_level}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{getSubjectLabel(mat.subject_id, lang)}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900 truncate">
                    {lang === 'or' && mat.title_or ? mat.title_or : mat.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {mat.resource_type.toUpperCase()} · {formatShortDate(mat.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('academics')}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-slate-100 text-blue-900 hover:bg-blue-900 hover:text-white transition-colors shrink-0 cursor-pointer"
                  aria-label="Open in Study Portal"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            ))}
            {materials.length === 0 && (
              <p className="py-6 text-sm text-slate-500">{t('noMaterials')}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
