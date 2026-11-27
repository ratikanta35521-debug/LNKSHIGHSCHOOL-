import React, { useState } from 'react';
import {
  Bell,
  BookOpen,
  ClipboardCheck,
  Globe,
  Home,
  IdCard,
  Images,
  LogOut,
  Menu,
  MessageSquare,
  Shield,
  X,
} from 'lucide-react';
import { ASSETS } from '../constants';
import { createTranslator } from '../i18n';
import { AuthUser, Language, PortalTab } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface AppShellProps {
  user: AuthUser;
  lang: Language;
  activeTab: PortalTab;
  onSelectTab: (tab: PortalTab) => void;
  onToggleLang: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  lang,
  activeTab,
  onSelectTab,
  onToggleLang,
  onSignOut,
  children,
}) => {
  const t = createTranslator(lang);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems: Array<{ id: PortalTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: t('navOverview'), icon: Home },
    { id: 'academics', label: t('navAcademics'), icon: BookOpen },
    { id: 'notices', label: t('navNotices'), icon: Bell },
    { id: 'messages', label: t('navMessages'), icon: MessageSquare },
    { id: 'gallery', label: t('navGallery'), icon: Images },
    { id: 'quiz', label: t('navQuiz'), icon: ClipboardCheck },
  ];

  if (user.role === 'student') {
    navItems.push({ id: 'idcard', label: t('navIdCard'), icon: IdCard });
  }
  if (user.role === 'super_owner') {
    navItems.push({ id: 'owner', label: t('navOwner'), icon: Shield });
  }

  const primaryMobileTabs: PortalTab[] = ['overview', 'academics', 'notices', 'messages'];

  const roleSubtitle =
    user.role === 'super_owner'
      ? t('roleSuperOwner')
      : user.role === 'admin'
      ? `${t('roleAdmin')} · Slot ${user.slotNumber}`
      : `${user.student?.class_level === 9 ? 'Class 9' : 'Class 10'} · Roll ${user.student?.roll_number}`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30 no-print">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <img
            src={ASSETS.crest}
            alt="L.N.K.S High School Crest"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-blue-950 truncate">{t('schoolName')}</p>
            <p className="text-[11px] text-slate-500 truncate">Class 9 &amp; Class 10</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Portal Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onToggleLang}
              className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-blue-900" />
              <span>{lang === 'en' ? 'ଓଡ଼ିଆ' : 'English'}</span>
            </button>
          </div>

          <PWAInstallButton label={t('installApp')} />

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{roleSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors shrink-0 cursor-pointer"
              title={t('signOut')}
              aria-label={t('signOut')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE STICKY TOP APP BAR (52px) */}
      <header className="lg:hidden sticky top-0 z-30 h-[52px] bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 flex items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={ASSETS.crest}
            alt="L.N.K.S Crest"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
          />
          <span className="font-display text-sm font-bold text-blue-950 truncate">{t('schoolName')}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleLang}
            className="min-h-[38px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-blue-900" />
            <span>{lang === 'en' ? 'ଓଡ଼ିଆ' : 'EN'}</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-5 sm:py-7">{children}</div>
      </main>

      {/* MOBILE FIXED BOTTOM TAB BAR (60px — Thumb Zone) */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
      >
        <div className="grid grid-cols-5 h-[60px] items-center">
          {primaryMobileTabs.map((tabId) => {
            const item = navItems.find((n) => n.id === tabId)!;
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setDrawerOpen(false);
                }}
                className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active ? 'text-blue-900' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold tracking-tight truncate max-w-[64px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              drawerOpen || !primaryMobileTabs.includes(activeTab) ? 'text-blue-900' : 'text-slate-500'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight">{t('navMore')}</span>
          </button>
        </div>
      </nav>

      {/* MOBILE BOTTOM SHEET DRAWER */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end no-print"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-5 pb-8 space-y-4 shadow-2xl max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-slate-900 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{roleSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {navItems
                .filter((i) => !primaryMobileTabs.includes(i.id))
                .map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        setDrawerOpen(false);
                      }}
                      className={`min-h-[52px] px-4 rounded-2xl border text-left flex items-center gap-3 text-sm font-semibold cursor-pointer ${
                        active
                          ? 'bg-blue-900 border-blue-900 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <PWAInstallButton label={t('installApp')} />
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  onSignOut();
                }}
                className="w-full min-h-[46px] rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
