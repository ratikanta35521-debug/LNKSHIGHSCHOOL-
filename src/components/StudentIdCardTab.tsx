import React from 'react';
import { Printer, ShieldCheck } from 'lucide-react';
import { ASSETS, formatShortDate } from '../constants';
import { createTranslator } from '../i18n';
import { AuthUser, Language } from '../types';

interface StudentIdCardTabProps {
  user: AuthUser;
  lang: Language;
  logoUrl: string;
}

export const StudentIdCardTab: React.FC<StudentIdCardTabProps> = ({ user, lang, logoUrl }) => {
  const t = createTranslator(lang);
  const student = user.student;

  if (!student) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-600">
        Digital Student ID Cards are generated automatically for registered Class 9 and Class 10 students.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">{t('idCardTitle')}</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {lang === 'or'
              ? 'ବିଦ୍ୟାଳୟ ପରୀକ୍ଷା ଓ ପଞ୍ଜୀକରଣ ପ୍ରମାଣପତ୍ର ଭାବେ ବ୍ୟବହାର କରନ୍ତୁ।'
              : 'Official verified digital student identity card and online registration receipt.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[44px] px-5 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>{t('printReceipt')}</span>
        </button>
      </div>

      {/* Official Printable ID Card + Registration Receipt */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Digital Identity Card */}
        <section className="lg:col-span-6 print-card rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-sm">
          <div className="bg-blue-950 text-white p-5 sm:p-6 flex items-center gap-4">
            <img
              src={logoUrl || ASSETS.crest}
              alt="L.N.K.S High School Crest"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-2xl object-cover border border-amber-400/50 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-300">{t('academicSession')}</p>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
                {t('schoolName')}
              </h2>
              <p className="text-xs text-slate-300 truncate">{t('schoolOdiaSub')}</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-500">{t('fullName')}</p>
                <p className="font-display text-xl font-bold text-slate-900 mt-0.5">{student.full_name}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-blue-900 text-white font-display text-xl font-bold flex items-center justify-center shrink-0">
                {student.full_name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Registration ID</dt>
                <dd className="font-mono-num font-semibold text-blue-950 mt-0.5">{student.reg_code}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('classLabel')}</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {student.class_level === 9 ? t('class9') : t('class10')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('rollNumber')}</dt>
                <dd className="font-mono-num font-semibold text-slate-900 mt-0.5">{student.roll_number}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('gender')}</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {student.gender === 'Boy' ? t('boy') : t('girl')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('mobileNumber')}</dt>
                <dd className="font-mono-num font-semibold text-slate-900 mt-0.5">{student.mobile}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Registered On</dt>
                <dd className="font-mono-num font-semibold text-slate-900 mt-0.5">
                  {formatShortDate(student.created_at)}
                </dd>
              </div>
            </dl>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Active Student</span>
              </div>
              <span className="font-mono-num text-slate-500">L.N.K.S OFFICE</span>
            </div>
          </div>
        </section>

        {/* Online Admission & Registration Receipt */}
        <section className="lg:col-span-6 print-card rounded-3xl bg-white border border-slate-200 p-6 space-y-5">
          <div className="pb-4 border-b border-slate-200">
            <p className="text-xs font-semibold text-blue-900">
              {lang === 'or' ? 'ଅନଲାଇନ୍ ପଞ୍ଜୀକରଣ ରସିଦ' : 'ONLINE PORTAL REGISTRATION RECEIPT'}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-900">{t('schoolName')}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Receipt No: <span className="font-mono-num font-semibold text-slate-800">{student.reg_code}</span>
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Student Name</span>
              <span className="font-semibold text-slate-900">{student.full_name}</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Academic Class</span>
              <span className="font-semibold text-slate-900">Class {student.class_level} (BSE Odisha)</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Class Roll Number</span>
              <span className="font-mono-num font-semibold text-slate-900">{student.roll_number}</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Student Category</span>
              <span className="font-semibold text-slate-900">{student.gender}</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Registered Mobile</span>
              <span className="font-mono-num font-semibold text-slate-900">{student.mobile}</span>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <span className="text-slate-500">Portal Access Status</span>
              <span className="font-semibold text-emerald-700">Approved &amp; Active</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 leading-relaxed">
            This digital receipt confirms active registration in the L.N.K.S High School Class 9 &amp; Class 10 Portal.
            Present this card or Registration ID during school practicals and examinations.
          </div>
        </section>
      </div>
    </div>
  );
};
