import React, { useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatShortDate, getSubjectLabel, SUBJECTS } from '../constants';
import { createTranslator } from '../i18n';
import { apiRequest } from '../lib/api';
import { AuthUser, Language, StudyMaterial } from '../types';

interface AcademicsTabProps {
  user: AuthUser;
  lang: Language;
  materials: StudyMaterial[];
  onRefresh: () => Promise<void>;
}

export const AcademicsTab: React.FC<AcademicsTabProps> = ({ user, lang, materials, onRefresh }) => {
  const t = createTranslator(lang);
  const isStaff = user.role === 'super_owner' || user.role === 'admin';

  const defaultClass = user.role === 'student' && user.student ? user.student.class_level : 'all';
  const [classFilter, setClassFilter] = useState<'all' | 9 | 10>(defaultClass);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Viewer modal state
  const [previewItem, setPreviewItem] = useState<StudyMaterial | null>(null);

  // Add/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StudyMaterial | null>(null);
  const [title, setTitle] = useState('');
  const [titleOr, setTitleOr] = useState('');
  const [description, setDescription] = useState('');
  const [classLevel, setClassLevel] = useState<9 | 10>(10);
  const [subjectId, setSubjectId] = useState('mathematics');
  const [resourceType, setResourceType] = useState<'pdf' | 'photo' | 'link'>('pdf');
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return materials.filter((m) => {
      if (classFilter !== 'all' && m.class_level !== classFilter) return false;
      if (subjectFilter !== 'all' && m.subject_id !== subjectFilter) return false;
      if (q) {
        const hay = `${m.title} ${m.title_or || ''} ${m.description || ''} ${m.subject_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [materials, classFilter, subjectFilter, searchQuery]);

  const openAddModal = () => {
    setEditing(null);
    setTitle('');
    setTitleOr('');
    setDescription('');
    setClassLevel(classFilter === 9 ? 9 : 10);
    setSubjectId(subjectFilter === 'all' ? 'mathematics' : subjectFilter);
    setResourceType('pdf');
    setExternalUrl('');
    setFile(null);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (mat: StudyMaterial) => {
    setEditing(mat);
    setTitle(mat.title);
    setTitleOr(mat.title_or || '');
    setDescription(mat.description || '');
    setClassLevel(mat.class_level);
    setSubjectId(mat.subject_id);
    setResourceType(mat.resource_type);
    setExternalUrl(mat.external_url || '');
    setFile(null);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      if (titleOr.trim()) fd.append('title_or', titleOr.trim());
      if (description.trim()) fd.append('description', description.trim());
      fd.append('class_level', String(classLevel));
      fd.append('subject_id', subjectId);
      fd.append('resource_type', resourceType);
      if (resourceType === 'link') {
        fd.append('external_url', externalUrl.trim());
      } else if (file) {
        fd.append('file', file);
      }

      if (editing) {
        await apiRequest(`/api/materials/${editing.id}`, {
          method: 'PUT',
          body: fd,
          isFormData: true,
        });
      } else {
        await apiRequest('/api/materials', {
          method: 'POST',
          body: fd,
          isFormData: true,
        });
      }

      await onRefresh();
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/materials/${id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            {lang === 'or' ? 'ପାଠପଢ଼ା — କେବଳ ନବମ ଓ ଦଶମ ଶ୍ରେଣୀ' : 'Academic Portal — Class 9 & Class 10'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {lang === 'or'
              ? 'ସମସ୍ତ ୮ଟି ବୋର୍ଡ ବିଷୟର PDF ନୋଟ୍ସ, ଡକ୍ୟୁମେଣ୍ଟ ଓ ଫଟୋ।'
              : 'PDF notes, document links, and study sheets across all 8 board subjects.'}
          </p>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addMaterial')}</span>
          </button>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Class 9 / Class 10 Segmented Control */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
            {(['all', 9, 10] as const).map((cls) => (
              <button
                key={String(cls)}
                type="button"
                onClick={() => setClassFilter(cls)}
                className={`flex-1 md:flex-none min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  classFilter === cls ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cls === 'all' ? t('allClasses') : cls === 9 ? t('class9') : t('class10')}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 md:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchMaterials')}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
            />
          </div>
        </div>

        {/* 8 Board Subjects Horizontal Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSubjectFilter('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              subjectFilter === 'all'
                ? 'bg-blue-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t('allSubjects')}
          </button>
          {SUBJECTS.map((subj) => (
            <button
              key={subj.id}
              type="button"
              onClick={() => setSubjectFilter(subj.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                subjectFilter === subj.id
                  ? 'bg-blue-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {lang === 'or' ? subj.or : subj.en}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
          <p className="text-sm text-slate-600">{t('noMaterials')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((mat) => (
            <article
              key={mat.id}
              className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-blue-900 whitespace-nowrap">
                      {mat.class_level === 9 ? t('class9') : t('class10')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{getSubjectLabel(mat.subject_id, lang)}</span>
                  </div>
                  <span className="font-mono-num shrink-0">{formatShortDate(mat.created_at)}</span>
                </div>

                <h2 className="mt-2 font-display text-base font-bold text-slate-900 leading-snug">
                  {lang === 'or' && mat.title_or ? mat.title_or : mat.title}
                </h2>
                {lang === 'en' && mat.title_or && (
                  <p className="mt-0.5 text-xs text-slate-500">{mat.title_or}</p>
                )}

                {mat.description && (
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{mat.description}</p>
                )}

                <p className="mt-3 text-xs text-slate-500">
                  {mat.resource_type === 'pdf'
                    ? 'PDF Document'
                    : mat.resource_type === 'photo'
                    ? 'Photo Sheet'
                    : 'External Link'}{' '}
                  · {mat.uploaded_by_name}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {mat.resource_type === 'pdf' && mat.file_url && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewItem(mat)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('viewPdf')}</span>
                      </button>
                      <a
                        href={`${mat.file_url}?download=1`}
                        download={mat.file_name || 'study-material.pdf'}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('downloadPdf')}</span>
                      </a>
                    </>
                  )}

                  {mat.resource_type === 'photo' && mat.file_url && (
                    <button
                      type="button"
                      onClick={() => setPreviewItem(mat)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{t('viewPhoto')}</span>
                    </button>
                  )}

                  {mat.resource_type === 'link' && mat.external_url && (
                    <a
                      href={mat.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t('openLink')}</span>
                    </a>
                  )}
                </div>

                {isStaff && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(mat)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                      aria-label={t('edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {confirmDeleteId === mat.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(mat.id)}
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
                        onClick={() => setConfirmDeleteId(mat.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                        aria-label={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Embedded PDF / Photo Preview Modal */}
      {previewItem && previewItem.file_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[85vh] bg-white rounded-2xl overflow-hidden flex flex-col border border-slate-200 shadow-2xl">
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 truncate">
                  {lang === 'or' && previewItem.title_or ? previewItem.title_or : previewItem.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Class {previewItem.class_level} · {getSubjectLabel(previewItem.subject_id, lang)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`${previewItem.file_url}?download=1`}
                  download={previewItem.file_name || 'material'}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('downloadPdf')}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-2 sm:p-4">
              {previewItem.resource_type === 'pdf' ? (
                <iframe
                  src={previewItem.file_url}
                  title={previewItem.title}
                  className="w-full h-full rounded-xl bg-white border border-slate-200"
                />
              ) : (
                <img
                  src={previewItem.file_url}
                  alt={previewItem.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Material Modal (Owner & 5 Admins) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? t('editMaterial') : t('addMaterial')}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t('classLabel')}</label>
                  <select
                    value={classLevel}
                    onChange={(e) => setClassLevel(Number(e.target.value) as 9 | 10)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value={9}>Class 9 (ନବମ)</option>
                    <option value={10}>Class 10 (ଦଶମ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.en} ({s.or})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Title (English)</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Chapter 4 Trigonometry Important Questions"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Title (Odia — Optional)</label>
                <input
                  type="text"
                  value={titleOr}
                  onChange={(e) => setTitleOr(e.target.value)}
                  placeholder="ଓଡ଼ିଆ ଶୀର୍ଷକ (ଇଚ୍ଛାଧୀନ)"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short note about chapters or exam topics covered..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Resource Type</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {(
                    [
                      { id: 'pdf', label: 'PDF File', icon: FileText },
                      { id: 'photo', label: 'Photo', icon: ImageIcon },
                      { id: 'link', label: 'Doc Link', icon: LinkIcon },
                    ] as const
                  ).map((rt) => {
                    const Icon = rt.icon;
                    return (
                      <button
                        key={rt.id}
                        type="button"
                        onClick={() => setResourceType(rt.id)}
                        className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                          resourceType === rt.id ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{rt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {resourceType === 'link' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Document URL (https://)</label>
                  <input
                    type="url"
                    required
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {resourceType === 'pdf' ? 'Upload PDF (max 10MB)' : 'Upload Image (JPG, PNG, WEBP)'}
                    {editing ? ' — leave empty to keep current file' : ''}
                  </label>
                  <input
                    type="file"
                    required={!editing}
                    accept={resourceType === 'pdf' ? 'application/pdf,.pdf' : 'image/jpeg,image/png,image/webp'}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-900 hover:file:bg-blue-100"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
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
