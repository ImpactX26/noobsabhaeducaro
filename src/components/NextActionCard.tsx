import React from 'react';
import { AlertTriangle, Upload, CheckCircle2 } from 'lucide-react';

interface NextActionCardProps {
  onUploadClick: () => void;
  isCertificateUploaded?: boolean;
  onResetSimulation?: () => void;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  onUploadClick,
  isCertificateUploaded = false,
  onResetSimulation,
}) => {
  return (
    <div
      className={`border-2 rounded-3xl p-6 sm:p-10 shadow-2xl transition-all ${
        isCertificateUploaded
          ? 'theme-bg-card border-emerald-500/80 shadow-emerald-500/5'
          : 'theme-bg-surface border-[#E30613] ring-4 ring-red-500/10'
      }`}
    >
      <div className="max-w-2xl mx-auto space-y-6 text-center sm:text-left">
        {/* Kicker Tag */}
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
            SIEG.AI Diagnosis & Directive
          </span>
          <span aria-hidden="true" className="opacity-40">·</span>
          <span className="text-xs font-mono font-bold text-[#FFD21C]">Immediate Action Required</span>
        </div>

        {/* Section Heading */}
        <div className="space-y-3">
          <h2 className="text-3xl sm:text-4xl font-black theme-text-main tracking-tight uppercase">
            Your next step
          </h2>

          {/* Critical Callout */}
          {!isCertificateUploaded ? (
            <div className="inline-flex items-center gap-2.5 text-lg sm:text-xl font-bold text-[#E30613] bg-red-500/10 border border-red-500/40 px-4 py-2.5 rounded-2xl shadow-sm">
              <AlertTriangle className="w-5 h-5 text-[#E30613] shrink-0 stroke-[2.5]" />
              <span>Upload your language certificate</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 text-lg sm:text-xl font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/40 px-4 py-2.5 rounded-2xl shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 stroke-[2.5]" />
              <span>Language Certificate Uploaded & Verified ✓</span>
            </div>
          )}
        </div>

        {/* Explanation */}
        <div className="text-base theme-text-muted leading-relaxed max-w-xl">
          {!isCertificateUploaded ? (
            <p>
              Your application is currently missing proof of language proficiency. German Master's admissions (Uni-Assist & German embassies) require verified certification before issuing final offer letters or student visa clearance.
            </p>
          ) : (
            <p>
              Your verified IELTS Academic Band 7.5 score meets the C1 English requirement for TUM Master of Science admissions. Your application dossier is now 100% complete.
            </p>
          )}
        </div>

        {/* Action Trigger */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
          {!isCertificateUploaded ? (
            <button
              onClick={onUploadClick}
              className="w-full sm:w-auto px-8 py-4 bg-[#E30613] hover:bg-[#E00018] text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Language Certificate</span>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
              <button
                disabled
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2.5 opacity-90 cursor-default"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified by SIEG.AI Copilot</span>
              </button>

              {onResetSimulation && (
                <button
                  onClick={onResetSimulation}
                  className="text-xs font-mono theme-text-muted hover:theme-text-main hover:underline cursor-pointer"
                >
                  Reset simulation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
