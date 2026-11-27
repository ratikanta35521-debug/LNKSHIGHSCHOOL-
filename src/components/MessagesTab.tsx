import React, { useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { formatDateTime, getSubjectLabel, SUBJECTS } from '../constants';
import { createTranslator } from '../i18n';
import { apiRequest } from '../lib/api';
import { AuthUser, Language, StudentMessage } from '../types';

interface MessagesTabProps {
  user: AuthUser;
  lang: Language;
  messages: StudentMessage[];
  onRefresh: () => Promise<void>;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({ user, lang, messages, onRefresh }) => {
  const t = createTranslator(lang);
  const isStaff = user.role === 'super_owner' || user.role === 'admin';

  // Filters
  const [genderFilter, setGenderFilter] = useState<'all' | 'Boy' | 'Girl'>('all');
  const [classFilter, setClassFilter] = useState<'all' | 9 | 10>('all');
  const [mineOnly, setMineOnly] = useState(false);

  // Student compose state
  const [content, setContent] = useState('');
  const [subjectTag, setSubjectTag] = useState('');
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staff reply state keyed by message id
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [replyFiles, setReplyFiles] = useState<Record<number, File | null>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);

  // Attachment preview modal
  const [preview, setPreview] = useState<{ url: string; type: 'pdf' | 'photo'; name: string } | null>(null);

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (user.role === 'student' && mineOnly && m.student_id !== user.id) return false;
      if (genderFilter !== 'all' && m.student_gender !== genderFilter) return false;
      if (classFilter !== 'all' && m.student_class !== classFilter) return false;
      return true;
    });
  }, [messages, genderFilter, classFilter, mineOnly, user]);

  const handleSendStudentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('content', content.trim());
      if (subjectTag) fd.append('subject_tag', subjectTag);
      if (studentFile) fd.append('attachment', studentFile);
      await apiRequest('/api/messages', { method: 'POST', body: fd, isFormData: true });
      setContent('');
      setSubjectTag('');
      setStudentFile(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent, messageId: number) => {
    e.preventDefault();
    const text = (replyText[messageId] || '').trim();
    const file = replyFiles[messageId] || null;
    if (!text && !file) return;
    setReplyingId(messageId);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('content', text);
      if (file) fd.append('attachment', file);
      await apiRequest(`/api/messages/${messageId}/replies`, { method: 'POST', body: fd, isFormData: true });
      setReplyText((prev) => ({ ...prev, [messageId]: '' }));
      setReplyFiles((prev) => ({ ...prev, [messageId]: null }));
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply failed');
    } finally {
      setReplyingId(null);
    }
  };

  const handleDeleteMessage = async (id: number) => {
    await apiRequest(`/api/messages/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleDeleteReply = async (replyId: number) => {
    await apiRequest(`/api/messages/replies/${replyId}`, { method: 'DELETE' });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
          {lang === 'or' ? 'ଛାତ୍ର ଓ ଛାତ୍ରୀ ବାର୍ତ୍ତା ବୋର୍ଡ' : 'Boys & Girls Interactive Message Board'}
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          {isStaff
            ? lang === 'or'
              ? 'ସମସ୍ତ ଛାତ୍ର ଓ ଛାତ୍ରୀଙ୍କ ବାର୍ତ୍ତା ଦେଖନ୍ତୁ ଏବଂ ସିଧାସଳଖ ଉତ୍ତର, PDF କିମ୍ବା ଫଟୋ ପଠାନ୍ତୁ।'
              : 'View all Boys and Girls doubts, reply with notes/PDFs/photos, and moderate messages.'
            : lang === 'or'
            ? 'ପାଠ୍ୟ ସନ୍ଦେହ କିମ୍ବା ପ୍ରଶ୍ନ ଶିକ୍ଷକ ଓ ଆଡମିନ୍‌ଙ୍କୁ ପଠାନ୍ତୁ।'
            : 'Ask study doubts or message L.N.K.S teachers & admins directly.'}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* Student Composer Card */}
      {user.role === 'student' && (
        <section className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="font-display text-sm font-bold text-slate-900">{t('askDoubtTitle')}</h2>
          <form onSubmit={handleSendStudentMessage} className="mt-3 space-y-3">
            <textarea
              rows={3}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('askDoubtPlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/15"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={subjectTag}
                  onChange={(e) => setSubjectTag(e.target.value)}
                  className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
                >
                  <option value="">{lang === 'or' ? 'ବିଷୟ ବାଛନ୍ତୁ (ଇଚ୍ଛାଧୀନ)' : 'Subject (Optional)'}</option>
                  {SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {lang === 'or' ? s.or : s.en}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-1.5 min-h-[42px] px-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[160px]">
                    {studentFile ? studentFile.name : lang === 'or' ? 'ଫଟୋ / PDF ଯୋଡ଼ନ୍ତୁ' : 'Attach Photo / PDF'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setStudentFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="min-h-[44px] px-5 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? t('loading') : t('sendMessage')}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {isStaff ? (
          <>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
              {(['all', 'Boy', 'Girl'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenderFilter(g)}
                  className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    genderFilter === g ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {g === 'all' ? t('allGenders') : g === 'Boy' ? t('boysOnly') : t('girlsOnly')}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
              {(['all', 9, 10] as const).map((c) => (
                <button
                  key={String(c)}
                  type="button"
                  onClick={() => setClassFilter(c)}
                  className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    classFilter === c ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {c === 'all' ? t('allClasses') : c === 9 ? t('class9') : t('class10')}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setMineOnly(false)}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold cursor-pointer ${
                !mineOnly ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t('allBoard')}
            </button>
            <button
              type="button"
              onClick={() => setMineOnly(true)}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold cursor-pointer ${
                mineOnly ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t('myMessages')}
            </button>
          </div>
        )}
      </div>

      {/* Messages Feed */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-600">
            {t('noMessages')}
          </div>
        ) : (
          filtered.map((msg) => {
            const canDelete = isStaff || (user.role === 'student' && msg.student_id === user.id);
            return (
              <article key={msg.id} className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-display text-sm font-bold text-slate-900">{msg.student_name}</span>
                      <span className="text-xs text-slate-500">
                        {msg.student_gender === 'Boy' ? t('boy') : t('girl')} · Class {msg.student_class} · Roll{' '}
                        <span className="font-mono-num">{msg.student_roll}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      {msg.subject_tag && (
                        <>
                          <span className="font-medium text-blue-900">
                            {getSubjectLabel(msg.subject_tag, lang)}
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="font-mono-num">{formatDateTime(msg.created_at)}</span>
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 shrink-0 cursor-pointer"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{msg.content}</p>

                {msg.attachment_url && msg.attachment_type !== 'none' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreview({
                          url: msg.attachment_url!,
                          type: msg.attachment_type as 'pdf' | 'photo',
                          name: msg.attachment_name || 'Attachment',
                        })
                      }
                      className="min-h-[38px] px-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-blue-950 inline-flex items-center gap-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      {msg.attachment_type === 'pdf' ? (
                        <FileText className="w-3.5 h-3.5" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5" />
                      )}
                      <span className="truncate max-w-[200px]">{msg.attachment_name || 'View Attachment'}</span>
                    </button>
                  </div>
                )}

                {/* Replies Section */}
                {msg.replies.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    {msg.replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-slate-600">
                            <span className="font-semibold text-blue-950">{rep.sender_name}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {rep.sender_role === 'super_owner' ? t('roleSuperOwner') : t('roleAdmin')}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num">{formatDateTime(rep.created_at)}</span>
                          </div>
                          {isStaff && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReply(rep.id)}
                              className="text-red-600 hover:underline text-xs cursor-pointer"
                            >
                              {t('delete')}
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-slate-800 whitespace-pre-line">{rep.content}</p>
                        {rep.attachment_url && rep.attachment_type !== 'none' && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setPreview({
                                  url: rep.attachment_url!,
                                  type: rep.attachment_type as 'pdf' | 'photo',
                                  name: rep.attachment_name || 'Teacher Attachment',
                                })
                              }
                              className="min-h-[36px] px-3 rounded-lg bg-blue-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              {rep.attachment_type === 'pdf' ? (
                                <FileText className="w-3.5 h-3.5" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5" />
                              )}
                              <span className="truncate max-w-[180px]">
                                {rep.attachment_name || (rep.attachment_type === 'pdf' ? t('viewPdf') : t('viewPhoto'))}
                              </span>
                            </button>
                            <a
                              href={`${rep.attachment_url}?download=1`}
                              download={rep.attachment_name || 'attachment'}
                              className="min-h-[36px] px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{t('downloadPdf')}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Staff Reply Composer (Owner & 5 Admins) */}
                {isStaff && (
                  <form
                    onSubmit={(e) => handleSendReply(e, msg.id)}
                    className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="text"
                      value={replyText[msg.id] || ''}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [msg.id]: e.target.value }))}
                      placeholder={t('replyPlaceholder')}
                      className="flex-1 min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm focus:border-blue-900 focus:outline-none"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 min-h-[42px] px-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span className="max-w-[90px] truncate">
                          {replyFiles[msg.id]?.name || 'PDF / Photo'}
                        </span>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) =>
                            setReplyFiles((prev) => ({ ...prev, [msg.id]: e.target.files?.[0] || null }))
                          }
                          className="hidden"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={replyingId === msg.id}
                        className="min-h-[42px] px-4 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{t('sendReply')}</span>
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[82vh] bg-white rounded-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-900 truncate">{preview.name}</h3>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-3 flex items-center justify-center overflow-auto">
              {preview.type === 'pdf' ? (
                <iframe src={preview.url} title={preview.name} className="w-full h-full rounded-xl bg-white" />
              ) : (
                <img
                  src={preview.url}
                  alt={preview.name}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
