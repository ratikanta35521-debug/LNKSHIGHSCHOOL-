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
import { apiRequest, setAuthToken, setUnauthorizedHandler } from './lib/api';
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
} from './types';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');

  // Shared portal data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [notices, setNotices] = useState<SchoolNotice[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setActiveTab('overview');
    });
  }, []);

  const refreshPortalData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [sumRes, matRes, notRes, galRes, msgRes, quizRes] = await Promise.all([
        apiRequest<DashboardSummary>('/api/dashboard/summary'),
        apiRequest<{ materials: StudyMaterial[] }>('/api/materials'),
        apiRequest<{ notices: SchoolNotice[] }>('/api/notices'),
        apiRequest<{ photos: GalleryPhoto[] }>('/api/gallery'),
        apiRequest<{ messages: StudentMessage[] }>('/api/messages'),
        apiRequest<{ questions: QuizQuestion[]; attempts: QuizAttempt[] }>('/api/quizzes'),
      ]);
      setSummary(sumRes);
      setMaterials(matRes.materials);
      setNotices(notRes.notices);
      setPhotos(galRes.photos);
      setMessages(msgRes.messages);
      setQuestions(quizRes.questions);
      setAttempts(quizRes.attempts);
    } catch {
      // Unauthorized errors automatically reset user state via handler
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshPortalData();
    }
  }, [user, refreshPortalData]);

  const handleToggleLang = () => {
    setLang((prev) => (prev === 'en' ? 'or' : 'en'));
  };

  const handleSignOut = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      setUser(null);
      setActiveTab('overview');
    }
  };

  if (!user) {
    return (
      <>
        <AuthGate
          lang={lang}
          onToggleLang={handleToggleLang}
          onAuthenticated={(authedUser) => {
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
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onToggleLang={handleToggleLang}
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
              <StudentIdCardTab user={user} lang={lang} />
            )}

            {activeTab === 'owner' && user.role === 'super_owner' && (
              <OwnerConsoleTab
                user={user}
                lang={lang}
                onUserUpdated={(updated) => setUser(updated)}
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
