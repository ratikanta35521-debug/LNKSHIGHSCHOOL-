import React, { useState } from 'react';
import { Check, Pencil, Phone, Plus, Trash2, X } from 'lucide-react';
import { createTranslator } from '../i18n';
import { apiRequest } from '../lib/api';
import { AuthUser, Language, TeacherContact } from '../types';

interface TeachersTabProps {
  user: AuthUser;
  lang: Language;
  teachers: TeacherContact[];
  onRefresh: () => Promise<void>;
}

export const TeachersTab: React.FC<TeachersTabProps> = ({ user, lang, teachers, onRefresh }) => {
  const t = createTranslator(lang);
  const isStaff = user.role === 'super_owner' || user.role === 'admin';

  // Inline edit state for any teacher row
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Add new teacher modal (Staff only)
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesignation, setNewDesignation] = useState('Assistant Teacher');
  const [newSubject, setNewSubject] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const startEdit = (teacher: TeacherContact) => {
    setEditingId(teacher.id);
    setEditName(teacher.name);
    setEditDesignation(teacher.designation);
    setEditSubject(teacher.subject);
    setEditPhone(teacher.phone);
    setFeedback(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFeedback(null);
  };

  const handleSaveEdit = async (e: React.FormEvent, teacherId: number) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await apiRequest(`/api/teachers/${teacherId}`, {
        method: 'PUT',
        body: {
          name: editName.trim(),
          designation: editDesignation.trim(),
          subject: editSubject.trim(),
          phone: editPhone.trim(),
        },
      });
      setEditingId(null);
      await onRefresh();
      setFeedback({
        type: 'success',
        text: lang === 'or' ? 'ଶିକ୍ଷକଙ୍କ ଯୋଗାଯୋଗ ନମ୍ବର ସଂରକ୍ଷିତ ହୋଇଛି।' : 'Teacher contact saved successfully.',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update contact' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await apiRequest('/api/teachers', {
        method: 'POST',
        body: {
          name: newName.trim(),
          designation: newDesignation.trim(),
          subject: newSubject.trim(),
          class_assigned: 'Class 9 & 10',
          phone: newPhone.trim(),
        },
      });
      setNewName('');
      setNewDesignation('Assistant Teacher');
      setNewSubject('');
      setNewPhone('');
      setShowAdd(false);
      await onRefresh();
      setFeedback({
        type: 'success',
        text: lang === 'or' ? 'ନୂତନ ଶିକ୍ଷକ ତାଲିକାରେ ଯୋଡ଼ାଗଲା।' : 'Teacher added to the directory.',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add teacher' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = async (id: number) => {
    await apiRequest(`/api/teachers/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">{t('teachersTitle')}</h1>
          <p className="text-sm text-slate-600 mt-0.5">{t('teachersSubtitle')}</p>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setShowAdd(true);
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addTeacher')}</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Teachers List */}
      <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
        {teachers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No teachers listed yet.</div>
        ) : (
          teachers.map((teacher) => {
            const isEditing = editingId === teacher.id;

            if (isEditing && isStaff) {
              return (
                <form
                  key={teacher.id}
                  onSubmit={(e) => handleSaveEdit(e, teacher.id)}
                  className="p-5 bg-blue-50/40 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Teacher Name</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
                      <input
                        type="text"
                        required
                        value={editDesignation}
                        onChange={(e) => setEditDesignation(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                      <input
                        type="text"
                        required
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{t('contactNumber')}</label>
                      <input
                        type="tel"
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="e.g., 9437000001"
                        className="w-full min-h-[42px] rounded-xl border border-blue-900 bg-white px-3 text-sm font-mono-num"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="min-h-[40px] px-4 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="min-h-[40px] px-4 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{saving ? t('loading') : t('save')}</span>
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={teacher.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span className="font-semibold text-blue-900">{teacher.designation}</span>
                    <span aria-hidden="true">·</span>
                    <span>{teacher.class_assigned}</span>
                  </div>
                  <h2 className="mt-1 font-display text-base font-bold text-slate-900">{teacher.name}</h2>
                  <p className="text-xs text-slate-600 mt-0.5">{teacher.subject}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={`tel:${teacher.phone.replace(/\s+/g, '')}`}
                    className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs sm:text-sm font-mono-num font-semibold hover:bg-slate-100 inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                    <span>{teacher.phone}</span>
                  </a>

                  {isStaff && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(teacher)}
                        className="min-h-[42px] px-3.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{t('edit')}</span>
                      </button>

                      {confirmDeleteId === teacher.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteTeacher(teacher.id)}
                            className="min-h-[38px] px-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                          >
                            {t('delete')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[38px] px-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(teacher.id)}
                          className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                          aria-label={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Teacher Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">{t('addTeacher')}</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTeacher} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Teacher Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g., Mathematics (ଗଣିତ)"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('contactNumber')}</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm font-mono-num"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
                  className="min-h-[44px] px-5 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
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
