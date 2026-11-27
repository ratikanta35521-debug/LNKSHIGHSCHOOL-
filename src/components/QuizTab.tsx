import React, { useMemo, useState } from 'react';
import { CheckCircle2, Play, Plus, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import { formatShortDate, getSubjectLabel, SUBJECTS } from '../constants';
import { createTranslator } from '../i18n';
import { apiRequest } from '../lib/api';
import { AuthUser, Language, QuizAttempt, QuizQuestion } from '../types';

interface QuizTabProps {
  user: AuthUser;
  lang: Language;
  questions: QuizQuestion[];
  attempts: QuizAttempt[];
  onRefresh: () => Promise<void>;
}

export const QuizTab: React.FC<QuizTabProps> = ({ user, lang, questions, attempts, onRefresh }) => {
  const t = createTranslator(lang);
  const isStaff = user.role === 'super_owner' || user.role === 'admin';

  const defaultClass: 9 | 10 = user.role === 'student' && user.student ? user.student.class_level : 10;
  const [classLevel, setClassLevel] = useState<9 | 10>(defaultClass);
  const [subjectId, setSubjectId] = useState<string>('all');

  // Quiz runner state
  const [inProgress, setInProgress] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  // Add Question modal state (Staff)
  const [showAdd, setShowAdd] = useState(false);
  const [qClass, setQClass] = useState<9 | 10>(10);
  const [qSubject, setQSubject] = useState('mathematics');
  const [qText, setQText] = useState('');
  const [qTextOr, setQTextOr] = useState('');
  const [opt0, setOpt0] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');
  const [correctIdx, setCorrectIdx] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.class_level !== classLevel) return false;
      if (subjectId !== 'all' && q.subject_id !== subjectId) return false;
      return true;
    });
  }, [questions, classLevel, subjectId]);

  const score = useMemo(() => {
    return filteredQuestions.reduce((acc, q) => {
      return acc + (answers[q.id] === q.correct_index ? 1 : 0);
    }, 0);
  }, [filteredQuestions, answers]);

  const handleStart = () => {
    setAnswers({});
    setSubmitted(false);
    setInProgress(true);
  };

  const handleSubmitQuiz = async () => {
    setSubmitted(true);
    if (user.role === 'student' && filteredQuestions.length > 0) {
      await apiRequest('/api/quizzes/attempts', {
        method: 'POST',
        body: {
          class_level: classLevel,
          subject_id: subjectId,
          score,
          total: filteredQuestions.length,
        },
      }).catch(() => {});
      await onRefresh();
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/api/quizzes', {
        method: 'POST',
        body: {
          class_level: qClass,
          subject_id: qSubject,
          question: qText.trim(),
          question_or: qTextOr.trim() || null,
          options: [opt0.trim(), opt1.trim(), opt2.trim(), opt3.trim()],
          correct_index: correctIdx,
          explanation: explanation.trim() || null,
        },
      });
      setQText('');
      setQTextOr('');
      setOpt0('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setExplanation('');
      setShowAdd(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    await apiRequest(`/api/quizzes/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            {lang === 'or' ? 'ଅନଲାଇନ୍ ଅଭ୍ୟାସ ପରୀକ୍ଷା (MCQ)' : 'Online Exam & MCQ Practice Quiz'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {lang === 'or'
              ? 'ନବମ ଓ ଦଶମ ଶ୍ରେଣୀ ବୋର୍ଡ ପରୀକ୍ଷା ପ୍ରସ୍ତୁତି ପାଇଁ ବହୁବିକଳ୍ପ ପ୍ରଶ୍ନ।'
              : 'Quick chapter-wise practice tests tailored for Class 9 and Class 10 board exams.'}
          </p>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={() => {
              setQClass(classLevel);
              setError(null);
              setShowAdd(true);
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addQuestion')}</span>
          </button>
        )}
      </div>

      {/* Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {([9, 10] as const).map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => {
                setClassLevel(cls);
                setInProgress(false);
                setSubmitted(false);
              }}
              className={`min-h-[40px] px-4 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer ${
                classLevel === cls ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              {cls === 9 ? t('class9') : t('class10')}
            </button>
          ))}
        </div>

        <select
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setInProgress(false);
            setSubmitted(false);
          }}
          className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800"
        >
          <option value="all">{t('allSubjects')}</option>
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {lang === 'or' ? `${s.or} (${s.en})` : s.en}
            </option>
          ))}
        </select>
      </div>

      {/* Quiz Start Banner or Active Runner */}
      {!inProgress ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-6 flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-semibold text-blue-900">
                {classLevel === 9 ? t('class9') : t('class10')} ·{' '}
                {subjectId === 'all' ? t('allSubjects') : getSubjectLabel(subjectId, lang)}
              </p>
              <h2 className="mt-2 font-display text-xl font-bold text-slate-900">
                <span className="font-mono-num">{filteredQuestions.length}</span>{' '}
                {lang === 'or' ? 'ଟି ଅଭ୍ୟାସ ପ୍ରଶ୍ନ ପ୍ରସ୍ତୁତ ଅଛି' : 'Practice Questions Ready'}
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {lang === 'or'
                  ? 'ସବୁ ପ୍ରଶ୍ନର ଉତ୍ତର ବାଛି ଦାଖଲ କରନ୍ତୁ। ତୁରନ୍ତ ସଠିକ୍ ଉତ୍ତର ଓ ବ୍ୟାଖ୍ୟା ଦେଖିପାରିବେ।'
                  : 'Select your answers and submit to receive instant scoring and step-by-step explanations.'}
              </p>
            </div>

            <div>
              <button
                type="button"
                disabled={filteredQuestions.length === 0}
                onClick={handleStart}
                className="min-h-[48px] px-6 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>{t('startQuiz')}</span>
              </button>
            </div>
          </section>

          {/* Recent Attempts (Students) or Question Bank Manager (Staff) */}
          <section className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-6">
            {user.role === 'student' ? (
              <>
                <h3 className="font-display text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
                  {lang === 'or' ? 'ଆପଣଙ୍କ ପୂର୍ବ ପରୀକ୍ଷା ଫଳାଫଳ' : 'Your Recent Practice Scores'}
                </h3>
                {attempts.length === 0 ? (
                  <p className="py-6 text-sm text-slate-500">
                    {lang === 'or' ? 'ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ପରୀକ୍ଷା ଦେଇନାହାନ୍ତି।' : 'Complete a quiz to track your scores here.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 mt-1">
                    {attempts.slice(0, 6).map((a) => (
                      <div key={a.id} className="py-3 flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            Class {a.class_level} · {a.subject_id === 'all' ? t('allSubjects') : getSubjectLabel(a.subject_id, lang)}
                          </p>
                          <p className="text-xs text-slate-500 font-mono-num">{formatShortDate(a.created_at)}</p>
                        </div>
                        <span className="font-mono-num font-bold text-blue-950 shrink-0">
                          {a.score} / {a.total}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="font-display text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
                  {lang === 'or' ? 'ପ୍ରଶ୍ନ ବ୍ୟାଙ୍କ ପରିଚାଳନା' : 'Question Bank'} ({filteredQuestions.length})
                </h3>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto mt-1">
                  {filteredQuestions.map((q, idx) => (
                    <div key={q.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-blue-900">
                          Q{idx + 1} · {getSubjectLabel(q.subject_id, lang)}
                        </p>
                        <p className="text-xs text-slate-800 line-clamp-2 mt-0.5">
                          {lang === 'or' && q.question_or ? q.question_or : q.question}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 shrink-0 cursor-pointer"
                        aria-label={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          {submitted && (
            <div className="rounded-2xl bg-blue-950 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-amber-300">{t('scoreSummary')}</p>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-bold font-mono-num">
                  {score} / {filteredQuestions.length}{' '}
                  <span className="text-base font-normal text-slate-300">
                    ({Math.round((score / Math.max(1, filteredQuestions.length)) * 100)}%)
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleStart}
                className="min-h-[44px] px-4 rounded-xl bg-white text-blue-950 text-sm font-semibold hover:bg-slate-100 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('retakeQuiz')}</span>
              </button>
            </div>
          )}

          {filteredQuestions.map((q, index) => {
            const chosen = answers[q.id];
            return (
              <article key={q.id} className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                <div>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono-num font-semibold text-blue-900">Q{index + 1}</span> ·{' '}
                    {getSubjectLabel(q.subject_id, lang)}
                  </p>
                  <h3 className="mt-1 font-display text-base font-bold text-slate-900 leading-snug">
                    {lang === 'or' && q.question_or ? q.question_or : q.question}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = chosen === optIdx;
                    const isCorrect = q.correct_index === optIdx;
                    let cls =
                      'border-slate-200 bg-white text-slate-800 hover:border-blue-900/40 hover:bg-slate-50';
                    if (submitted) {
                      if (isCorrect) cls = 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold';
                      else if (isSelected && !isCorrect) cls = 'border-red-500 bg-red-50 text-red-900';
                    } else if (isSelected) {
                      cls = 'border-blue-900 bg-blue-50 text-blue-950 font-semibold';
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                        className={`min-h-[46px] px-4 py-2.5 rounded-xl border text-left text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:cursor-default ${cls}`}
                      >
                        <span>
                          <span className="font-mono-num mr-2 text-xs text-slate-500">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </span>
                        {submitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {submitted && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {submitted && q.explanation && (
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                    <strong className="text-slate-900">Explanation:</strong> {q.explanation}
                  </p>
                )}
              </article>
            );
          })}

          {!submitted && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInProgress(false)}
                className="min-h-[46px] px-5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmitQuiz}
                className="min-h-[46px] px-6 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 cursor-pointer"
              >
                {t('submitQuiz')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Staff Add Question Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">{t('addQuestion')}</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleAddQuestion} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Class</label>
                  <select
                    value={qClass}
                    onChange={(e) => setQClass(Number(e.target.value) as 9 | 10)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value={9}>Class 9</option>
                    <option value={10}>Class 10</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                  <select
                    value={qSubject}
                    onChange={(e) => setQSubject(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Question (English)</label>
                <input
                  type="text"
                  required
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Question (Odia — Optional)</label>
                <input
                  type="text"
                  value={qTextOr}
                  onChange={(e) => setQTextOr(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Option A', val: opt0, set: setOpt0 },
                  { label: 'Option B', val: opt1, set: setOpt1 },
                  { label: 'Option C', val: opt2, set: setOpt2 },
                  { label: 'Option D', val: opt3, set: setOpt3 },
                ].map((o, i) => (
                  <div key={i}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{o.label}</label>
                    <input
                      type="text"
                      required
                      value={o.val}
                      onChange={(e) => o.set(e.target.value)}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Correct Option</label>
                <select
                  value={correctIdx}
                  onChange={(e) => setCorrectIdx(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value={0}>Option A</option>
                  <option value={1}>Option B</option>
                  <option value={2}>Option C</option>
                  <option value={3}>Option D</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Short Explanation (Optional)</label>
                <input
                  type="text"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 rounded-xl bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
