import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  KeyRound,
  Pencil,
  Power,
  Search,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { formatShortDate } from '../constants';
import { createTranslator } from '../i18n';
import { apiRequest, downloadAuthenticatedFile, setAuthToken } from '../lib/api';
import { AdminSlot, AuthUser, Language, StudentProfile } from '../types';

interface OwnerConsoleTabProps {
  user: AuthUser;
  lang: Language;
  onUserUpdated: (user: AuthUser) => void;
  onRefreshAll: () => Promise<void>;
}

export const OwnerConsoleTab: React.FC<OwnerConsoleTabProps> = ({
  user,
  lang,
  onUserUpdated,
  onRefreshAll,
}) => {
  const t = createTranslator(lang);
  const [subTab, setSubTab] = useState<'admins' | 'students' | 'transfer' | 'backup'>('admins');

  // 5 Admin Slots
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [editingSlot, setEditingSlot] = useState<AdminSlot | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminActive, setAdminActive] = useState(true);

  // Students Directory
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [stuGender, setStuGender] = useState<'all' | 'Boy' | 'Girl'>('all');
  const [stuClass, setStuClass] = useState<'all' | 9 | 10>('all');
  const [stuSearch, setStuSearch] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [editStuName, setEditStuName] = useState('');
  const [editStuGender, setEditStuGender] = useState<'Boy' | 'Girl'>('Boy');
  const [editStuClass, setEditStuClass] = useState<9 | 10>(10);
  const [editStuRoll, setEditStuRoll] = useState('');
  const [editStuMobile, setEditStuMobile] = useState('');
  const [editStuPassword, setEditStuPassword] = useState('');
  const [editStuActive, setEditStuActive] = useState(true);
  const [confirmDelStudent, setConfirmDelStudent] = useState<number | null>(null);

  // Ownership Transfer
  const [currentPassword, setCurrentPassword] = useState('');
  const [newOwnerName, setNewOwnerName] = useState(user.name);
  const [newOwnerId, setNewOwnerId] = useState(user.loginId || '');
  const [newOwnerMobile, setNewOwnerMobile] = useState(user.mobile || '');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState('');
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  // Backup & Restore
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadOwnerData = async () => {
    try {
      const [adminsRes, stuRes] = await Promise.all([
        apiRequest<{ slots: AdminSlot[] }>('/api/owner/admins'),
        apiRequest<{ students: StudentProfile[] }>('/api/students'),
      ]);
      setSlots(adminsRes.slots);
      setStudents(stuRes.students);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load owner data' });
    }
  };

  useEffect(() => {
    loadOwnerData();
  }, []);

  const filteredStudents = students.filter((s) => {
    if (stuGender !== 'all' && s.gender !== stuGender) return false;
    if (stuClass !== 'all' && s.class_level !== stuClass) return false;
    if (stuSearch.trim()) {
      const q = stuSearch.trim().toLowerCase();
      const hay = `${s.full_name} ${s.roll_number} ${s.mobile} ${s.reg_code}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // ---- 5 Admin Slots Handlers ----
  const openEditSlot = (slot: AdminSlot) => {
    setEditingSlot(slot);
    setAdminName(slot.name || '');
    setAdminLoginId(slot.login_id || '');
    setAdminPassword('');
    setAdminActive(slot.login_id ? Boolean(slot.is_active) : true);
    setFeedback(null);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    setBusy(true);
    setFeedback(null);
    try {
      await apiRequest(`/api/owner/admins/${editingSlot.slot_number}`, {
        method: 'PUT',
        body: {
          name: adminName.trim(),
          login_id: adminLoginId.trim(),
          password: adminPassword,
          is_active: adminActive,
        },
      });
      setEditingSlot(null);
      await loadOwnerData();
      await onRefreshAll();
      setFeedback({ type: 'success', text: `Admin Slot ${editingSlot.slot_number} updated successfully.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save Admin slot' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSlot = async (slot: AdminSlot) => {
    setFeedback(null);
    try {
      await apiRequest(`/api/owner/admins/${slot.slot_number}/status`, {
        method: 'PATCH',
        body: { is_active: !slot.is_active },
      });
      await loadOwnerData();
      await onRefreshAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Status update failed' });
    }
  };

  const handleClearSlot = async (slotNumber: number) => {
    setFeedback(null);
    try {
      await apiRequest(`/api/owner/admins/${slotNumber}`, { method: 'DELETE' });
      await loadOwnerData();
      await onRefreshAll();
      setFeedback({ type: 'success', text: `Admin Slot ${slotNumber} cleared and access revoked.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Remove failed' });
    }
  };

  // ---- Student Management Handlers ----
  const openEditStudent = (s: StudentProfile) => {
    setEditingStudent(s);
    setEditStuName(s.full_name);
    setEditStuGender(s.gender);
    setEditStuClass(s.class_level);
    setEditStuRoll(s.roll_number);
    setEditStuMobile(s.mobile);
    setEditStuPassword('');
    setEditStuActive(Boolean(s.is_active ?? 1));
    setFeedback(null);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setBusy(true);
    try {
      await apiRequest(`/api/owner/students/${editingStudent.id}`, {
        method: 'PUT',
        body: {
          full_name: editStuName.trim(),
          gender: editStuGender,
          class_level: editStuClass,
          roll_number: editStuRoll.trim(),
          mobile: editStuMobile.trim(),
          password: editStuPassword,
          is_active: editStuActive,
        },
      });
      setEditingStudent(null);
      await loadOwnerData();
      await onRefreshAll();
      setFeedback({ type: 'success', text: 'Student account updated successfully.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteStudent = async (id: number) => {
    await apiRequest(`/api/owner/students/${id}`, { method: 'DELETE' });
    setConfirmDelStudent(null);
    await loadOwnerData();
    await onRefreshAll();
    setFeedback({ type: 'success', text: 'Student account deleted.' });
  };

  // ---- Ownership Transfer Handler ----
  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newOwnerPassword !== confirmOwnerPassword) {
      setFeedback({ type: 'error', text: 'New Owner passwords do not match.' });
      return;
    }
    if (!confirmTransfer) {
      setFeedback({ type: 'error', text: 'Please check the ownership transfer confirmation box.' });
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{ ok: boolean; token: string; user: AuthUser }>(
        '/api/owner/transfer-ownership',
        {
          method: 'POST',
          body: {
            current_password: currentPassword,
            new_name: newOwnerName.trim(),
            new_login_id: newOwnerId.trim(),
            new_mobile: newOwnerMobile.trim(),
            new_password: newOwnerPassword,
          },
        }
      );
      setAuthToken(res.token);
      onUserUpdated(res.user);
      setCurrentPassword('');
      setNewOwnerPassword('');
      setConfirmOwnerPassword('');
      setConfirmTransfer(false);
      setFeedback({
        type: 'success',
        text: `Ownership cleanly transferred to ${res.user.name} (${res.user.loginId} / ${res.user.mobile}). All previous sessions were revoked.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Ownership transfer failed' });
    } finally {
      setBusy(false);
    }
  };

  // ---- Backup & Restore Handlers ----
  const handleExportCsv = async () => {
    const params = new URLSearchParams();
    if (stuGender !== 'all') params.set('gender', stuGender);
    if (stuClass !== 'all') params.set('class_level', String(stuClass));
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      await downloadAuthenticatedFile(`/api/owner/export/students.csv${qs}`, 'lnks-high-school-students.csv');
      setFeedback({ type: 'success', text: 'Students CSV downloaded.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'CSV export failed' });
    }
  };

  const handleExportJson = async () => {
    try {
      await downloadAuthenticatedFile('/api/owner/backup/export', `lnks-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setFeedback({ type: 'success', text: 'Complete portal JSON backup downloaded.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Backup export failed' });
    }
  };

  const handleImportJson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFile || !restoreConfirm) return;
    setBusy(true);
    setFeedback(null);
    try {
      const text = await backupFile.text();
      const parsed = JSON.parse(text);
      const res = await apiRequest<{ ok: boolean; restored: Record<string, number> }>('/api/owner/backup/import', {
        method: 'POST',
        body: parsed,
      });
      setBackupFile(null);
      setRestoreConfirm(false);
      await loadOwnerData();
      await onRefreshAll();
      setFeedback({
        type: 'success',
        text: `Backup restored: ${res.restored.students} students, ${res.restored.materials} materials, ${res.restored.notices} notices, ${res.restored.gallery} gallery photos, ${res.restored.quiz_questions} quiz questions.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Invalid backup JSON file' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-amber-700">
            {t('roleSuperOwner')} · {user.loginId} · {user.mobile}
          </p>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
            {t('ownerDashboardTitle')}
          </h1>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'admins', label: t('tabAdminSlots'), icon: UserCheck },
            { id: 'students', label: t('tabStudents'), icon: Users },
            { id: 'transfer', label: t('tabTransfer'), icon: KeyRound },
            { id: 'backup', label: t('tabBackup'), icon: Database },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSubTab(tab.id);
                setFeedback(null);
              }}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                subTab === tab.id
                  ? 'bg-blue-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
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

      {/* 1. FIVE ADMIN SLOTS MANAGEMENT */}
      {subTab === 'admins' && (
        <section className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="font-display text-base font-bold text-slate-900">
              {lang === 'or' ? '୫ଟି ଆଡମିନ୍ ସ୍ଲଟ୍ (Admin 1 ରୁ Admin 5)' : '5 Dedicated Admin Slots (Admin 1 to Admin 5)'}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {lang === 'or'
                ? 'ପ୍ରତ୍ୟେକ ସକ୍ରିୟ ଆଡମିନ୍ PDF, ଫଟୋ, ବିଜ୍ଞପ୍ତି, କ୍ୱିଜ୍ ଏବଂ ଛାତ୍ରଛାତ୍ରୀ ବାର୍ତ୍ତା ପରିଚାଳନା କରିପାରିବେ। କେବଳ ସୁପର ମାଲିକ ଆଡମିନ୍ ସ୍ଲଟ୍ ଓ ମାଲିକାନା ପରିବର୍ତ୍ତନ କରିପାରିବେ।'
                : 'Active Admins receive full Add, Edit, and Remove permissions for PDFs, Study Materials, Photos, Notices, Quizzes, and Boys & Girls Messages. Only the Super Owner can edit Admin Slots or Transfer Ownership.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slots.map((slot) => {
              const isAssigned = Boolean(slot.login_id);
              return (
                <article
                  key={slot.slot_number}
                  className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono-num font-bold text-blue-950">Admin Slot {slot.slot_number}</span>
                      <span
                        className={
                          !isAssigned
                            ? 'text-slate-500 font-medium'
                            : slot.is_active
                            ? 'text-emerald-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {!isAssigned ? 'Unassigned' : slot.is_active ? t('activeStatus') : t('inactiveStatus')}
                      </span>
                    </div>

                    {isAssigned ? (
                      <div className="mt-3 space-y-1">
                        <h3 className="font-display text-base font-bold text-slate-900">{slot.name}</h3>
                        <p className="text-xs text-slate-600 font-mono-num">ID / Mobile: {slot.login_id}</p>
                        {slot.assigned_at && (
                          <p className="text-xs text-slate-500">
                            Assigned {formatShortDate(slot.assigned_at)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">{t('unassignedSlot')}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditSlot(slot)}
                      className="flex-1 min-h-[40px] px-3 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 whitespace-nowrap cursor-pointer"
                    >
                      {isAssigned ? t('editAdmin') : t('assignAdmin')}
                    </button>
                    {isAssigned && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleSlot(slot)}
                          className="min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
                          title={slot.is_active ? t('deactivate') : t('activate')}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{slot.is_active ? t('deactivate') : t('activate')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearSlot(slot.slot_number)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                          aria-label={t('removeAdmin')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. REGISTERED STUDENTS DIRECTORY (BOYS & GIRLS) */}
      {subTab === 'students' && (
        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(['all', 'Boy', 'Girl'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setStuGender(g)}
                    className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      stuGender === g ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {g === 'all' ? t('allGenders') : g === 'Boy' ? t('boysOnly') : t('girlsOnly')}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(['all', 9, 10] as const).map((c) => (
                  <button
                    key={String(c)}
                    type="button"
                    onClick={() => setStuClass(c)}
                    className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      stuClass === c ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {c === 'all' ? t('allClasses') : c === 9 ? t('class9') : t('class10')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stuSearch}
                  onChange={(e) => setStuSearch(e.target.value)}
                  placeholder="Name, roll, mobile..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 pl-9 pr-3 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="min-h-[40px] px-3.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('exportCsv')}</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Student</th>
                    <th className="py-3.5 px-4 font-semibold">Gender</th>
                    <th className="py-3.5 px-4 font-semibold">Class &amp; Roll</th>
                    <th className="py-3.5 px-4 font-semibold">Mobile</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        No registered students match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{s.full_name}</p>
                          <p className="text-xs text-slate-500 font-mono-num">{s.reg_code}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">{s.gender}</td>
                        <td className="py-3.5 px-4 font-mono-num text-slate-800">
                          Class {s.class_level} · Roll {s.roll_number}
                        </td>
                        <td className="py-3.5 px-4 font-mono-num text-slate-800">{s.mobile}</td>
                        <td className="py-3.5 px-4 text-xs font-semibold">
                          <span className={s.is_active ? 'text-emerald-700' : 'text-red-700'}>
                            {s.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditStudent(s)}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                              aria-label="Edit student"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {confirmDelStudent === s.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudent(s.id)}
                                  className="min-h-[32px] px-2 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                                >
                                  {t('delete')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelStudent(null)}
                                  className="min-h-[32px] px-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                                >
                                  {t('cancel')}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDelStudent(s.id)}
                                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                                aria-label="Delete student"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 3. SELL / TRANSFER OWNERSHIP SETTINGS */}
      {subTab === 'transfer' && (
        <section className="max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">{t('transferHeading')}</h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{t('transferWarning')}</p>
            </div>
          </div>

          <form onSubmit={handleTransferOwnership} className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Current Owner ID: <strong className="font-mono-num">{user.loginId}</strong> · Mobile:{' '}
                <strong className="font-mono-num">{user.mobile}</strong>
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('currentPassword')}</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current Super Owner password to authorize"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('newOwnerName')}</label>
                <input
                  type="text"
                  required
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('newOwnerId')}</label>
                <input
                  type="text"
                  required
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  placeholder="newowner@lnksschool"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('newOwnerMobile')}</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                value={newOwnerMobile}
                onChange={(e) => setNewOwnerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('newOwnerPassword')}</label>
                <input
                  type="password"
                  minLength={6}
                  required
                  value={newOwnerPassword}
                  onChange={(e) => setNewOwnerPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('confirmPassword')}</label>
                <input
                  type="password"
                  minLength={6}
                  required
                  value={confirmOwnerPassword}
                  onChange={(e) => setConfirmOwnerPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmTransfer}
                onChange={(e) => setConfirmTransfer(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-900"
              />
              <span>{t('confirmTransferCheck')}</span>
            </label>

            <button
              type="submit"
              disabled={busy || !confirmTransfer}
              className="w-full min-h-[48px] rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
            >
              {busy ? t('loading') : t('transferAction')}
            </button>
          </form>
        </section>
      )}

      {/* 4. FULL BACKUP & RESTORE */}
      {subTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">Export Portal Data</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Download complete JSON snapshots of all registered students, notices, study materials, gallery entries,
              messages, and MCQ quizzes — or export the Boys &amp; Girls roster as CSV for Excel.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full min-h-[46px] px-4 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('exportJson')}</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('exportCsv')}</span>
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">{t('importJson')}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Restore a previously exported L.N.K.S High School JSON backup file. Super Owner credentials remain
              protected during restoration.
            </p>
            <form onSubmit={handleImportJson} className="space-y-3.5 pt-1">
              <input
                type="file"
                accept="application/json,.json"
                required
                onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-900"
              />
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreConfirm}
                  onChange={(e) => setRestoreConfirm(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300"
                />
                <span>Confirm restoring notices, materials, gallery, quiz bank, and student records from this file.</span>
              </label>
              <button
                type="submit"
                disabled={busy || !backupFile || !restoreConfirm}
                className="w-full min-h-[46px] px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{busy ? t('loading') : t('importJson')}</span>
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Modal: Assign / Edit Admin Slot */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Admin Slot {editingSlot.slot_number}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Admin Full Name</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g., Ramesh Sir (Math Teacher)"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number or Login ID</label>
                <input
                  type="text"
                  required
                  value={adminLoginId}
                  onChange={(e) => setAdminLoginId(e.target.value)}
                  placeholder="e.g., 9861001122 or admin1@lnksschool"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password {editingSlot.login_id ? '(leave blank to keep current password)' : '(min 6 chars)'}
                </label>
                <input
                  type="password"
                  required={!editingSlot.login_id}
                  minLength={6}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={adminActive}
                  onChange={(e) => setAdminActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span>Active Admin Access</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] px-5 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 cursor-pointer"
                >
                  {busy ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Student */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-display text-lg font-bold text-slate-900">Edit Student Account</h3>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editStuName}
                  onChange={(e) => setEditStuName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={editStuGender}
                    onChange={(e) => setEditStuGender(e.target.value as 'Boy' | 'Girl')}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="Boy">Boy</option>
                    <option value="Girl">Girl</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Class</label>
                  <select
                    value={editStuClass}
                    onChange={(e) => setEditStuClass(Number(e.target.value) as 9 | 10)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value={9}>Class 9</option>
                    <option value={10}>Class 10</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Roll Number</label>
                  <input
                    type="text"
                    required
                    value={editStuRoll}
                    onChange={(e) => setEditStuRoll(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile (10 digits)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    required
                    value={editStuMobile}
                    onChange={(e) => setEditStuMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reset Password (optional, min 6 chars)
                </label>
                <input
                  type="password"
                  value={editStuPassword}
                  onChange={(e) => setEditStuPassword(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editStuActive}
                  onChange={(e) => setEditStuActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span>Account Active</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] px-5 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 cursor-pointer"
                >
                  {busy ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
