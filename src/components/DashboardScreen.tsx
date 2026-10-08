import React, { useState } from 'react';
import {
  ApplicantDetails,
  DocumentItem,
  QualificationRequirement,
  DashboardStats,
} from '../types';
import {
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Bot,
  Upload,
  Check,
  Compass,
  X,
} from 'lucide-react';

interface DashboardScreenProps {
  details: ApplicantDetails;
  documents: DocumentItem[];
  requirements: QualificationRequirement[];
  stats: DashboardStats;
  isCertificateUploaded: boolean;
  onNavigateToProfile: () => void;
  onNavigateToDocuments: () => void;
  onNavigateToQualification: () => void;
  onNavigateToNextAction: () => void;
  onOpenChatbot: () => void;
  onUploadCertificate: (certName: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  details,
  documents,
  requirements,
  stats,
  isCertificateUploaded,
  onNavigateToProfile,
  onNavigateToDocuments,
  onNavigateToQualification,
  onNavigateToNextAction,
  onOpenChatbot,
  onUploadCertificate,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Dynamic calculations based on state
  const uploadedCount = isCertificateUploaded
    ? documents.length
    : documents.filter((d) => d.status === 'uploaded').length;
  const missingCount = isCertificateUploaded
    ? 0
    : documents.filter((d) => d.status === 'missing').length;

  const metReqCount = isCertificateUploaded
    ? requirements.length
    : requirements.filter((r) => r.status === 'met').length;
  const attentionReqCount = isCertificateUploaded
    ? 0
    : requirements.filter((r) => r.status === 'missing').length;

  const currentProgress = isCertificateUploaded ? 100 : stats.progressPercentage;

  const handleSimulateUpload = (certName: string) => {
    onUploadCertificate(certName);
    setShowUploadModal(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 theme-text-main">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b theme-border">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card border theme-border text-[#FFD21C] text-xs font-mono font-bold backdrop-blur-md">
            <Compass className="w-3.5 h-3.5 text-[#FFD21C]" />
            <span>Command Center · Germany Admissions Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black theme-text-main tracking-tight uppercase">
            Your Germany Application
          </h1>

          <p className="text-base sm:text-lg theme-text-muted font-normal">
            Here's where you currently stand.
          </p>
        </div>

        {/* Applicant Tag */}
        <div className="flex items-center gap-3 theme-bg-card px-4 py-2.5 rounded-2xl border theme-border self-start md:self-auto shadow-md">
          <div className="w-9 h-9 rounded-xl bg-[#E30613] text-white font-mono font-bold flex items-center justify-center text-xs shadow-xs">
            {details.fullName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-bold theme-text-main flex items-center gap-2">
              <span>{details.fullName || 'Rahul Sharma'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 theme-bg-surface text-[#FFD21C] border theme-border rounded">
                DE 🇩🇪
              </span>
            </div>
            <div className="text-[11px] font-mono theme-text-muted truncate max-w-[200px]">
              {details.targetInstitution || 'TUM Munich'}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="theme-bg-card border theme-border rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Overall Application Progress
            </div>
            <div className="text-xl sm:text-2xl font-black theme-text-main">
              Application Readiness Score
            </div>
          </div>

          <div className="flex items-baseline gap-2 self-start sm:self-auto">
            <span className="text-3xl sm:text-4xl font-mono font-black text-[#FFD21C]">
              {currentProgress}%
            </span>
            <span className="text-xs font-mono theme-text-muted">
              {currentProgress === 100 ? 'Fully Ready' : 'In Progress'}
            </span>
          </div>
        </div>

        {/* Progress Bar with German Tri-Color Accent */}
        <div className="space-y-2">
          <div className="w-full h-3.5 theme-bg-surface rounded-full overflow-hidden border theme-border p-0.5 flex">
            <div
              className="h-full bg-gradient-to-r from-[#050505] via-[#E30613] to-[#FFD21C] rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono theme-text-muted">
            <span>Dossier Inception</span>
            <span className="text-[#FFD21C] font-semibold">Bavarian Calculation</span>
            <span>Uni-Assist & Visa Ready</span>
          </div>
        </div>
      </div>

      {/* 3 Core Metric Overview Cards */}
      <div className="grid sm:grid-cols-3 gap-5">
        {/* Metric 1: Documents */}
        <div
          onClick={onNavigateToDocuments}
          className="theme-bg-card border theme-border hover:border-[#E30613] p-6 rounded-3xl space-y-3 cursor-pointer transition-all duration-200 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Documents
            </span>
            <div className="w-7 h-7 rounded-lg theme-bg-surface flex items-center justify-center text-xs font-mono font-bold text-[#FFD21C]">
              {uploadedCount}/{documents.length}
            </div>
          </div>

          <div className="text-2xl font-black theme-text-main">
            {uploadedCount} Uploaded
          </div>

          <div className="text-xs font-mono flex items-center gap-1.5">
            {missingCount === 0 ? (
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All files present
              </span>
            ) : (
              <span className="text-[#E30613] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E30613]" /> {missingCount} document missing
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Requirements */}
        <div
          onClick={onNavigateToQualification}
          className="theme-bg-card border theme-border hover:border-[#FFD21C] p-6 rounded-3xl space-y-3 cursor-pointer transition-all duration-200 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Requirements
            </span>
            <div className="w-7 h-7 rounded-lg theme-bg-surface flex items-center justify-center text-xs font-mono font-bold text-[#FFD21C]">
              {metReqCount}/{requirements.length}
            </div>
          </div>

          <div className="text-2xl font-black theme-text-main">
            {metReqCount} Met
          </div>

          <div className="text-xs font-mono flex items-center gap-1.5">
            {attentionReqCount === 0 ? (
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Satisfied
              </span>
            ) : (
              <span className="text-[#FFD21C] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FFD21C]" /> {attentionReqCount} needs attention
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Target Institution */}
        <div
          onClick={onNavigateToProfile}
          className="theme-bg-card border theme-border hover:border-[#E30613] p-6 rounded-3xl space-y-3 cursor-pointer transition-all duration-200 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Target
            </span>
            <span className="text-[10px] font-mono text-[#FFD21C] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              TU9
            </span>
          </div>

          <div className="text-2xl font-black theme-text-main truncate">
            {details.targetInstitution || 'TUM Munich'}
          </div>

          <div className="text-xs font-mono theme-text-muted">
            {details.goal === 'work' ? 'EU Blue Card Track' : "M.Sc. Data Engineering"}
          </div>
        </div>
      </div>

      {/* Primary Directive Banner: Your Next Action */}
      <div
        className={`border-2 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl transition-all ${
          isCertificateUploaded
            ? 'theme-bg-card border-emerald-500/80 shadow-emerald-500/5'
            : 'theme-bg-surface border-[#E30613] shadow-red-500/10'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-[#E30613] text-white font-mono font-extrabold text-[10px] uppercase tracking-wider">
                Priority Directive
              </span>
              <span className="text-xs font-mono theme-text-muted">
                {isCertificateUploaded ? 'Application Complete' : 'Urgent Requirement'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black theme-text-main tracking-tight uppercase">
              {isCertificateUploaded
                ? 'All Requirements Met — Ready for Submission'
                : 'Upload Your Language Certificate'}
            </h2>
          </div>

          {/* Action Trigger */}
          {!isCertificateUploaded ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3.5 bg-[#E30613] hover:bg-[#E00018] text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Certificate</span>
            </button>
          ) : (
            <div className="px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 font-mono font-bold text-xs flex items-center gap-2">
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Verified C1 Proficiency</span>
            </div>
          )}
        </div>

        <p className="text-sm theme-text-muted max-w-2xl leading-relaxed">
          {isCertificateUploaded
            ? 'Your official language credential satisfies German university requirements. Your portfolio is cleared for submission.'
            : 'German Master\'s programs require an official IELTS, TOEFL, or Goethe test score to issue an admission offer.'}
        </p>

        {/* Quick Simulation Trigger */}
        {!isCertificateUploaded && (
          <div className="pt-2 flex flex-wrap items-center gap-3 border-t theme-border">
            <span className="text-xs font-mono theme-text-muted">Simulate Instant Upload:</span>
            <button
              onClick={() => handleSimulateUpload('IELTS_Academic_Score_7.5_TRF.pdf')}
              className="text-xs font-mono px-3 py-1.5 rounded-lg theme-bg-card hover:theme-bg-subtle border theme-border theme-text-main transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
              <span>IELTS Band 7.5 (TRF #984210)</span>
            </button>
            <button
              onClick={() => handleSimulateUpload('TOEFL_iBT_Score_105.pdf')}
              className="text-xs font-mono px-3 py-1.5 rounded-lg theme-bg-card hover:theme-bg-subtle border theme-border theme-text-main transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
              <span>TOEFL iBT 105</span>
            </button>
          </div>
        )}
      </div>

      {/* Four Deep-Dive Quick Action Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={onNavigateToProfile}
          className="p-5 rounded-2xl theme-bg-card border theme-border hover:border-[#E30613] text-left space-y-2 cursor-pointer transition-all group shadow-sm"
        >
          <div className="text-xs font-mono font-bold text-[#E30613] uppercase">
            Step 1 · Dossier
          </div>
          <div className="text-base font-black theme-text-main group-hover:text-[#E30613] transition-colors flex items-center justify-between">
            <span>Applicant Profile</span>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs theme-text-muted">
            Extracted GPA, credits, university H+ status, and work history.
          </p>
        </button>

        <button
          onClick={onNavigateToDocuments}
          className="p-5 rounded-2xl theme-bg-card border theme-border hover:border-[#E30613] text-left space-y-2 cursor-pointer transition-all group shadow-sm"
        >
          <div className="text-xs font-mono font-bold text-[#E30613] uppercase">
            Step 2 · Repository
          </div>
          <div className="text-base font-black theme-text-main group-hover:text-[#E30613] transition-colors flex items-center justify-between">
            <span>Uploaded Files</span>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs theme-text-muted">
            Transcripts, degree certificates, passport copies, and CVs.
          </p>
        </button>

        <button
          onClick={onNavigateToQualification}
          className="p-5 rounded-2xl theme-bg-card border theme-border hover:border-[#FFD21C] text-left space-y-2 cursor-pointer transition-all group shadow-sm"
        >
          <div className="text-xs font-mono font-bold text-[#FFD21C] uppercase">
            Step 3 · Audit
          </div>
          <div className="text-base font-black theme-text-main group-hover:text-[#FFD21C] transition-colors flex items-center justify-between">
            <span>Qualification Check</span>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs theme-text-muted">
            Direct comparison against German university admission criteria.
          </p>
        </button>

        <button
          onClick={onNavigateToNextAction}
          className="p-5 rounded-2xl theme-bg-card border theme-border hover:border-[#E30613] text-left space-y-2 cursor-pointer transition-all group shadow-sm"
        >
          <div className="text-xs font-mono font-bold text-[#E30613] uppercase">
            Step 4 · Plan
          </div>
          <div className="text-base font-black theme-text-main group-hover:text-[#E30613] transition-colors flex items-center justify-between">
            <span>Next Action Plan</span>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs theme-text-muted">
            Prioritized timeline for submission, deadlines, and embassy visas.
          </p>
        </button>
      </div>

      {/* Floating Assistant Trigger Callout */}
      <div className="theme-bg-surface border theme-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#E30613] text-white flex items-center justify-center font-bold shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold theme-text-main flex items-center gap-2">
              <span>Need help understanding German requirements?</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs theme-text-muted">
              Ask questions about Bavarian formula GPA conversions, Uni-Assist deadlines, or blocked accounts.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenChatbot}
          className="px-4 py-2 rounded-xl theme-bg-card hover:theme-bg-subtle border theme-border theme-text-main text-xs font-mono font-bold transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
        >
          Open AI Assistant
        </button>
      </div>

      {/* Upload Modal (Simulation) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="theme-bg-card border theme-border rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl theme-text-muted hover:theme-text-main hover:theme-bg-surface cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-mono text-[#E30613] font-bold uppercase">
                Document Upload
              </span>
              <h3 className="text-xl font-black theme-text-main uppercase">
                Submit Language Certificate
              </h3>
              <p className="text-xs theme-text-muted">
                Attach your official score report to clear the language deficiency.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleSimulateUpload('IELTS_Academic_Score_7.5_TRF.pdf')}
                className="w-full p-4 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border hover:border-[#FFD21C] text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold theme-text-main">IELTS Academic (Band 7.5)</div>
                  <div className="text-xs theme-text-muted font-mono">TRF #984210 · Official Test Report</div>
                </div>
                <Upload className="w-4 h-4 text-[#FFD21C]" />
              </button>

              <button
                onClick={() => handleSimulateUpload('TOEFL_iBT_Score_105.pdf')}
                className="w-full p-4 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border hover:border-[#FFD21C] text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold theme-text-main">TOEFL iBT (105 / 120)</div>
                  <div className="text-xs theme-text-muted font-mono">ETS Official Score Card</div>
                </div>
                <Upload className="w-4 h-4 text-[#FFD21C]" />
              </button>

              <button
                onClick={() => handleSimulateUpload('Goethe_Zertifikat_C1.pdf')}
                className="w-full p-4 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border hover:border-[#FFD21C] text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold theme-text-main">Goethe-Zertifikat C1</div>
                  <div className="text-xs theme-text-muted font-mono">German Language Proficiency</div>
                </div>
                <Upload className="w-4 h-4 text-[#FFD21C]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
