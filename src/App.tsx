import { useCallback, useEffect, useState } from 'react';
import { AcademicsTab } from './components/AcademicsTab';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { GalleryTab } from './components/GalleryTab';
import { MessagesTab } from './components/MessagesTab';
import { NoticesTab } from './components/NoticesTab';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OverviewTab } from './components/OverviewTab';
import { OwnerConsoleTab } from './components/OwnerConsoleTab';
import { QuizTab } from './components/QuizTab';
import { StudentIdCardTab } from './components/StudentIdCardTab';
import { TeachersTab } from './components/TeachersTab';
import { ASSETS } from './constants';
import {
  ApiError,
  apiRequest,
  clearCachedUserProfile,
  loadCachedUserProfile,
  saveCachedUserProfile,
  setAuthToken,
  setUnauthorizedHandler,
} from './lib/api';
import {
  AuthUser,
  DashboardSummary,
  GalleryPhoto,
  Language,
  PortalTab,
  QuizAttempt,
  QuizQuestion,
  SchoolNotice,
  StudentMessage,
  StudyMaterial,
  TeacherContact,
} from './types';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      return localStorage.getItem('lnks_lang') === 'or' ? 'or' : 'en';
    } catch {
      return 'en';
    }
  });
  const [user, setUser] = useState<AuthUser | null>(() => loadCachedUserProfile());
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [logoUrl, setLogoUrl] = useState<string>(ASSETS.crest);

  // Shared portal data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [notices, setNotices] = useState<SchoolNotice[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [teachers, setTeachers] = useState<TeacherContact[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Keep browser tab favicon & touch icon synced whenever icon loads or updates
  useEffect(() => {
    if (!logoUrl) return;

    const inferredType = logoUrl.startsWith('data:image/png')
      ? 'image/png'
      : logoUrl.startsWith('data:image/webp')
      ? 'image/webp'
      : logoUrl.startsWith('data:image/jpeg') || logoUrl.startsWith('data:image/jpg')
      ? 'image/jpeg'
      : '';

    const updateLink = (rel: string) => {
      let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      if (inferredType) {
        link.type = inferredType;
      } else {
        link.removeAttribute('type');
      }
      link.href = logoUrl;
    };

    updateLink('icon');
    updateLink('shortcut icon');
    updateLink('apple-touch-icon');
  }, [logoUrl]);

  // Always fetch latest icon from GET /api/icon & verify persisted backend session on load/refresh
  useEffect(() => {
    let active = true;

    apiRequest<{ icon?: string; logoUrl?: string }>(`/api/icon?t=${Date.now()}`, {
      skipUnauthorizedHandler: true,
    })
      .then((res) => {
        const latestIcon = res.icon || res.logoUrl;
        if (active && latestIcon) setLogoUrl(latestIcon);
      })
      .catch(() => {});

    const verifySession = async (attempt = 0): Promise<void> => {
      try {
        const res = await apiRequest<{ user: AuthUser; token?: string }>('/api/auth/me', {
          skipUnauthorizedHandler: true,
        });
        if (!active) return;
        if (res.token) setAuthToken(res.token);
        saveCachedUserProfile(res.user);
        setUser(res.user);
      } catch (err) {
        if (!active) return;
        const isAuthRejection = err instanceof ApiError && (err.status === 401 || err.status === 403);
        if (!isAuthRejection && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (active) return verifySession(attempt + 1);
          return;
        }
        if (isAuthRejection || !loadCachedUserProfile()) {
          setAuthToken(null);
          clearCachedUserProfile();
          setUser(null);
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    };

    verifySession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearCachedUserProfile();
      setUser(null);
      setActiveTab('overview');
    });
  }, []);

  const refreshPortalData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [sumRes, matRes, notRes, galRes, msgRes, quizRes, teachRes] = await Promise.all([
        apiRequest<DashboardSummary>('/api/dashboard/summary'),
        apiRequest<{ materials: StudyMaterial[] }>('/api/materials'),
        apiRequest<{ notices: SchoolNotice[] }>('/api/notices'),
        apiRequest<{ photos: GalleryPhoto[] }>('/api/gallery'),
        apiRequest<{ messages: StudentMessage[] }>('/api/messages'),
        apiRequest<{ questions: QuizQuestion[]; attempts: QuizAttempt[] }>('/api/quizzes'),
        apiRequest<{ teachers: TeacherContact[] }>('/api/teachers'),
      ]);
      setSummary(sumRes);
      setMaterials(matRes.materials);
      setNotices(notRes.notices);
      setPhotos(galRes.photos);
      setMessages(msgRes.messages);
      setQuestions(quizRes.questions);
      setAttempts(quizRes.attempts);
      setTeachers(teachRes.teachers);
    } catch {
      // Unauthorized errors reset user state via handler
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user && !checkingSession) {
      refreshPortalData();
    }
  }, [user, checkingSession, refreshPortalData]);

  const handleToggleLang = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'or' : 'en';
      try {
        localStorage.setItem('lnks_lang', next);
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', skipUnauthorizedHandler: true });
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      clearCachedUserProfile();
      setUser(null);
      setActiveTab('overview');
    }
  };

  if (checkingSession && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-base font-bold text-blue-950">L.N.K.S HIGH SCHOOL</p>
          <p className="text-xs text-slate-500">
            {lang === 'or' ? 'ସେସନ୍ ଯାଞ୍ଚ ହେଉଛି...' : 'Restoring your session...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthGate
          lang={lang}
          logoUrl={logoUrl}
          onToggleLang={handleToggleLang}
          onAuthenticated={(authedUser) => {
            saveCachedUserProfile(authedUser);
            setUser(authedUser);
            setActiveTab('overview');
          }}
        />
        <OfflineIndicator />
      </>
    );
  }

  return (
    <>
      <AppShell
        user={user}
        lang={lang}
        logoUrl={logoUrl}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onToggleLang={handleToggleLang}
        onLogoUpdated={setLogoUrl}
        onSignOut={handleSignOut}
      >
        {loadingData && !summary ? (
          <div className="py-16 text-center text-sm text-slate-500">
            {lang === 'or' ? 'ବିଦ୍ୟାଳୟ ପୋର୍ଟାଲ୍ ଲୋଡ୍ ହେଉଛି...' : 'Loading L.N.K.S High School Portal...'}
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                user={user}
                lang={lang}
                summary={summary}
                notices={notices}
                materials={materials}
                teachersCount={teachers.length}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'academics' && (
              <AcademicsTab
                user={user}
                lang={lang}
                materials={materials}
                onRefresh={refreshPortalData}
              />
            )}

            {activeTab === 'notices' && (
              <NoticesTab
                user={user}
                lang={lang}
                notices={notices}
                onRefresh={refreshPortalData}
              />
            )}

            {activeTab === 'messages' && (
              <MessagesTab
                user={user}
                lang={lang}
                messages={messages}
                onRefresh={refreshPortalData}
              />
            )}

            {activeTab === 'teachers' && (
              <TeachersTab
                user={user}
                lang={lang}
                teachers={teachers}
                onRefresh={refreshPortalData}
              />
            )}

            {activeTab === 'gallery' && (
              <GalleryTab
                user={user}
                lang={lang}
                photos={photos}
                onRefresh={refreshPortalData}
              />
            )}

            {activeTab === 'quiz' && (
              <QuizTab
                user={user}
                lang={lang}
                questions={questions}
                attempts={attempts}
                onRefresh={refreshPortalData}
              />
            )}

            {activeTab === 'idcard' && user.role === 'student' && (
              <StudentIdCardTab user={user} lang={lang} logoUrl={logoUrl} />
            )}

            {activeTab === 'owner' && user.role === 'super_owner' && (
              <OwnerConsoleTab
                user={user}
                lang={lang}
                onUserUpdated={(updated) => {
                  saveCachedUserProfile(updated);
                  setUser(updated);
                }}
                onRefreshAll={refreshPortalData}
              />
            )}
          </>
        )}
      </AppShell>
      <OfflineIndicator />
    </>
  );
}
