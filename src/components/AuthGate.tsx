import React, { useState } from 'react';
import { Eye, EyeOff, Globe, Lock, ShieldCheck, UserPlus, LogIn } from 'lucide-react';
import { ASSETS } from '../constants';
import { createTranslator } from '../i18n';
import { apiRequest, setAuthToken } from '../lib/api';
import { AuthUser, Language } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthGateProps {
  lang: Language;
  onToggleLang: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ lang, onToggleLang, onAuthenticated }) => {
  const t = createTranslator(lang);
  const [portalTab, setPortalTab] = useState<'student' | 'staff'>('student');
  const [studentMode, setStudentMode] = useState<'login' | 'register'>('login');

  // Student Login state
  const [studentMobile, setStudentMobile] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  // Student Registration state
  const [regName, setRegName] = useState('');
  const [regGender, setRegGender] = useState<'Boy' | 'Girl'>('Boy');
  const [regClass, setRegClass] = useState<9 | 10>(10);
  const [regRoll, setRegRoll] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  // Staff (Owner / Admin) Login state
  const [staffId, setStaffId] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/student/login', {
        method: 'POST',
        body: { mobile: studentMobile.trim(), password: studentPassword },
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (regPassword !== regConfirm) {
      setError(lang === 'or' ? 'ପାସୱାର୍ଡ ଦୁଇଟି ସମାନ ନୁହେଁ।' : 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/student/register', {
        method: 'POST',
        body: {
          full_name: regName.trim(),
          gender: regGender,
          class_level: regClass,
          roll_number: regRoll.trim(),
          mobile: regMobile.trim(),
          password: regPassword,
        },
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/staff/login', {
        method: 'POST',
        body: { identifier: staffId.trim(), password: staffPassword },
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Compact Top Utility Strip */}
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={ASSETS.crest}
              alt="L.N.K.S High School Crest"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
            />
            <span className="font-display text-base sm:text-lg font-bold tracking-tight text-blue-950 truncate">
              {t('schoolName')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton label={t('installApp')} compact />
            <button
              type="button"
              onClick={onToggleLang}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-blue-900 shrink-0" />
              <span>{lang === 'en' ? 'ଓଡ଼ିଆ' : 'English'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Institutional Hero Panel */}
          <section className="lg:col-span-6 flex flex-col justify-between rounded-3xl overflow-hidden bg-blue-950 text-white border border-blue-900/40 relative">
            <div className="relative h-56 sm:h-72 lg:h-full min-h-[260px] w-full">
              <img
                src={ASSETS.campusHero}
                alt="L.N.K.S High School Campus"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-950 via-blue-950/65 to-blue-950/20" />
              <div className="absolute inset-0 p-6 sm:p-8 lg:p-10 flex flex-col justify-end">
                <p className="text-xs font-medium text-amber-300 tracking-wide">
                  {t('academicSession')} · {t('class9')} &amp; {t('class10')}
                </p>
                <h1 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                  {t('schoolName')}
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
                  {t('schoolOdiaSub')}
                </p>
                <div className="mt-6 pt-5 border-t border-white/15 grid grid-cols-3 gap-4 text-left">
                  <div>
                    <p className="font-mono-num text-lg sm:text-xl font-semibold text-white">9 &amp; 10</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {lang === 'or' ? 'ଶ୍ରେଣୀ କେନ୍ଦ୍ରିତ' : 'Dedicated Classes'}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono-num text-lg sm:text-xl font-semibold text-white">8</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {lang === 'or' ? 'ବୋର୍ଡ ବିଷୟ' : 'Board Subjects'}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono-num text-lg sm:text-xl font-semibold text-white">3-Tier</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {lang === 'or' ? 'ସୁରକ୍ଷିତ ପ୍ରବେଶ' : 'Role Access'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Right Authentication Gate Card */}
          <section className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-center">
            {/* Primary Portal Role Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={portalTab === 'student'}
                onClick={() => {
                  setPortalTab('student');
                  setError(null);
                }}
                className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  portalTab === 'student'
                    ? 'bg-white text-blue-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('studentPortalTab')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={portalTab === 'staff'}
                onClick={() => {
                  setPortalTab('staff');
                  setError(null);
                }}
                className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  portalTab === 'staff'
                    ? 'bg-white text-blue-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('staffPortalTab')}
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            {/* STUDENT PORTAL (LOGIN / REGISTER) */}
            {portalTab === 'student' ? (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentMode('login');
                      setError(null);
                    }}
                    className={`min-h-[40px] text-sm font-semibold pb-2 -mb-3.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                      studentMode === 'login'
                        ? 'border-blue-900 text-blue-950'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t('studentLogin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentMode('register');
                      setError(null);
                    }}
                    className={`min-h-[40px] text-sm font-semibold pb-2 -mb-3.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                      studentMode === 'register'
                        ? 'border-blue-900 text-blue-950'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t('studentRegister')}
                  </button>
                </div>

                {studentMode === 'login' ? (
                  <form onSubmit={handleStudentLogin} className="mt-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('mobileNumber')}
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        value={studentMobile}
                        onChange={(e) => setStudentMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('password')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          required
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
                          aria-label={showPass ? 'Hide password' : 'Show password'}
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full min-h-[48px] rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{loading ? t('loading') : t('signIn')}</span>
                    </button>

                    <p className="text-center text-xs text-slate-500 pt-2">
                      {lang === 'or' ? 'ନୂତନ ଛାତ୍ରଛାତ୍ରୀ କି?' : 'New Class 9 or Class 10 student?'}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setStudentMode('register');
                          setError(null);
                        }}
                        className="font-semibold text-blue-900 hover:underline cursor-pointer"
                      >
                        {t('studentRegister')}
                      </button>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleStudentRegister} className="mt-5 space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('fullName')}
                      </label>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder={lang === 'or' ? 'ଛାତ୍ର/ଛାତ୍ରୀଙ୍କ ସମ୍ପୂର୍ଣ୍ଣ ନାମ' : 'e.g., Subham Mohanty'}
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {t('gender')}
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setRegGender('Boy')}
                            className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                              regGender === 'Boy' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                            }`}
                          >
                            {t('boy')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegGender('Girl')}
                            className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                              regGender === 'Girl' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                            }`}
                          >
                            {t('girl')}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {t('classLabel')}
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setRegClass(9)}
                            className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                              regClass === 9 ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                            }`}
                          >
                            {lang === 'or' ? 'ନବମ (9)' : 'Class 9'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegClass(10)}
                            className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                              regClass === 10 ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                            }`}
                          >
                            {lang === 'or' ? 'ଦଶମ (10)' : 'Class 10'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {t('rollNumber')}
                        </label>
                        <input
                          type="text"
                          required
                          value={regRoll}
                          onChange={(e) => setRegRoll(e.target.value)}
                          placeholder="e.g., 14"
                          className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {t('mobileNumber')}
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          required
                          value={regMobile}
                          onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile"
                          className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {t('password')}
                        </label>
                        <input
                          type="password"
                          minLength={6}
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Min 6 chars"
                          className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {t('confirmPassword')}
                        </label>
                        <input
                          type="password"
                          minLength={6}
                          required
                          value={regConfirm}
                          onChange={(e) => setRegConfirm(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full min-h-[48px] rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{loading ? t('loading') : t('createAccount')}</span>
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* OWNER / ADMIN DIRECT LOGIN */
              <div className="mt-6">
                <div className="flex items-start gap-3 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {lang === 'or' ? 'ସୁପର ମାଲିକ ଓ ୫ ଆଡମିନ୍ ପ୍ରବେଶ' : 'Super Owner & 5 Admin Direct Login'}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {lang === 'or'
                        ? 'ସୁପର ମାଲିକ କିମ୍ବା ନିଯୁକ୍ତ ଆଡମିନ୍ (Admin 1–5) ସିଧାସଳଖ ନିଜ ଆଇଡି ଓ ପାସୱାର୍ଡ ଦେଇ ପ୍ରବେଶ କରନ୍ତୁ।'
                        : 'Sign in directly using your exclusive Super Owner ID/Mobile or assigned Admin (1–5) credentials.'}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleStaffLogin} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('loginIdOrMobile')}
                    </label>
                    <input
                      type="text"
                      required
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      placeholder="owner@lnksschool or 9999999999"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{loading ? t('loading') : t('signIn')}</span>
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        L.N.K.S HIGH SCHOOL · {t('schoolTagline')}
      </footer>
    </div>
  );
};
