import React, { useMemo, useState } from 'react';
import { Download, Eye, FileText, Image as ImageIcon, Pencil, Plus, Trash2, X } from 'lucide-react';
import { formatShortDate } from '../constants';
import { createTranslator } from '../i18n';
import { apiRequest } from '../lib/api';
import { AuthUser, Language, SchoolNotice } from '../types';

interface NoticesTabProps {
  user: AuthUser;
  lang: Language;
  notices: SchoolNotice[];
  onRefresh: () => Promise<void>;
}

export const NoticesTab: React.FC<NoticesTabProps> = ({ user, lang, notices, onRefresh }) => {
  const t = createTranslator(lang);
  const isStaff = user.role === 'super_owner' || user.role === 'admin';

  const [classFilter, setClassFilter] = useState<'all' | '9' | '10'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SchoolNotice | null>(null);
  const [previewNotice, setPreviewNotice] = useState<SchoolNotice | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [titleOr, setTitleOr] = useState('');
  const [content, setContent] = useState('');
  const [contentOr, setContentOr] = useState('');
  const [priority, setPriority] = useState<'general' | 'urgent' | 'exam'>('general');
  const [targetClass, setTargetClass] = useState<'all' | '9' | '10'>('all');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (classFilter === 'all') return notices;
    return notices.filter((n) => n.target_class === 'all' || n.target_class === classFilter);
  }, [notices, classFilter]);

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setTitleOr('');
    setContent('');
    setContentOr('');
    setPriority('general');
    setTargetClass('all');
    setFile(null);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (n: SchoolNotice) => {
    setEditing(n);
    setTitle(n.title);
    setTitleOr(n.title_or || '');
    setContent(n.content);
    setContentOr(n.content_or || '');
    setPriority(n.priority);
    setTargetClass(n.target_class);
    setFile(null);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      if (titleOr.trim()) fd.append('title_or', titleOr.trim());
      fd.append('content', content.trim());
      if (contentOr.trim()) fd.append('content_or', contentOr.trim());
      fd.append('priority', priority);
      fd.append('target_class', targetClass);
      if (file) fd.append('attachment', file);

      if (editing) {
        await apiRequest(`/api/notices/${editing.id}`, { method: 'PUT', body: fd, isFormData: true });
      } else {
        await apiRequest('/api/notices', { method: 'POST', body: fd, isFormData: true });
      }
      await onRefresh();
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notice');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await apiRequest(`/api/notices/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            {lang === 'or' ? 'ବିଦ୍ୟାଳୟ ବିଜ୍ଞପ୍ତି ଓ ଘୋଷଣା' : 'School Notices & Announcements'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {lang === 'or'
              ? 'ନବମ ଓ ଦଶମ ଶ୍ରେଣୀ ପାଇଁ ପ୍ରଧାନଶିକ୍ଷକ ଓ ଆଡମିନ୍‌ଙ୍କ ସରକାରୀ ବିଜ୍ଞପ୍ତି।'
              : 'Official school announcements, exam dates, and circulars for Class 9 & Class 10.'}
          </p>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={openAdd}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addNotice')}</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
        {(['all', '9', '10'] as const).map((cls) => (
          <button
            key={cls}
            type="button"
            onClick={() => setClassFilter(cls)}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              classFilter === cls ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {cls === 'all' ? t('allClasses') : cls === '9' ? t('class9') : t('class10')}
          </button>
        ))}
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-600">
            {t('noNotices')}
          </div>
        ) : (
          filtered.map((notice) => (
            <article key={notice.id} className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      notice.priority === 'urgent'
                        ? 'font-semibold text-red-700'
                        : notice.priority === 'exam'
                        ? 'font-semibold text-amber-700'
                        : 'font-semibold text-blue-900'
                    }
                  >
                    {notice.priority === 'urgent'
                      ? lang === 'or'
                        ? 'ଜରୁରୀ ବିଜ୍ଞପ୍ତି'
                        : 'Urgent Notice'
                      : notice.priority === 'exam'
                      ? lang === 'or'
                        ? 'ପରୀକ୍ଷା ସୂଚନା'
                        : 'Exam Schedule'
                      : lang === 'or'
                      ? 'ସାଧାରଣ ସୂଚନା'
                      : 'General Notice'}
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
                <span>{notice.posted_by_name}</span>
              </div>

              <h2 className="mt-2 font-display text-lg font-bold text-slate-900">
                {lang === 'or' && notice.title_or ? notice.title_or : notice.title}
              </h2>
              {lang === 'en' && notice.title_or && (
                <p className="text-xs text-slate-500 mt-0.5">{notice.title_or}</p>
              )}

              <p className="mt-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                {lang === 'or' && notice.content_or ? notice.content_or : notice.content}
              </p>

              {(notice.attachment_url || isStaff) && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {notice.attachment_url && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewNotice(notice)}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {notice.attachment_type === 'pdf' ? (
                            <FileText className="w-3.5 h-3.5" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5" />
                          )}
                          <span>{notice.attachment_type === 'pdf' ? t('viewPdf') : t('viewPhoto')}</span>
                        </button>
                        <a
                          href={`${notice.attachment_url}?download=1`}
                          download={notice.attachment_name || 'notice-attachment'}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('downloadPdf')}</span>
                        </a>
                      </>
                    )}
                  </div>

                  {isStaff && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(notice)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                        aria-label={t('edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {confirmDeleteId === notice.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(notice.id)}
                            className="min-h-[36px] px-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                          >
                            {t('delete')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[36px] px-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(notice.id)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          aria-label={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Attachment Preview Modal */}
      {previewNotice && previewNotice.attachment_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[82vh] bg-white rounded-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 truncate">
                {previewNotice.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewNotice(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-3 flex items-center justify-center overflow-auto">
              {previewNotice.attachment_type === 'pdf' ? (
                <iframe
                  src={previewNotice.attachment_url}
                  title={previewNotice.title}
                  className="w-full h-full rounded-xl bg-white"
                />
              ) : (
                <img
                  src={previewNotice.attachment_url}
                  alt={previewNotice.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Notice Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? t('editNotice') : t('addNotice')}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
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

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'general' | 'urgent' | 'exam')}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="general">General Notice</option>
                    <option value="exam">Exam Schedule</option>
                    <option value="urgent">Urgent Alert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Target Class</label>
                  <select
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value as 'all' | '9' | '10')}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="all">Class 9 &amp; Class 10</option>
                    <option value="9">Class 9 Only</option>
                    <option value="10">Class 10 Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notice Title (English)</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notice Title (Odia — Optional)</label>
                <input
                  type="text"
                  value={titleOr}
                  onChange={(e) => setTitleOr(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Details (English)</label>
                <textarea
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Details (Odia — Optional)</label>
                <textarea
                  rows={2}
                  value={contentOr}
                  onChange={(e) => setContentOr(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Optional PDF or Notice Photo Attachment
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
