import React, { useState } from 'react';
import { JourneyStage } from '../types';
import { JourneyStepper } from './JourneyStepper';
import { NextActionCard } from './NextActionCard';
import {
  Upload,
  X,
  FileCheck2,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

interface NextActionScreenProps {
  onBackToQualification: () => void;
  onCertificateUploadedStateChange: (uploaded: boolean) => void;
  isCertificateUploaded: boolean;
}

export const NextActionScreen: React.FC<NextActionScreenProps> = ({
  onBackToQualification,
  onCertificateUploadedStateChange,
  isCertificateUploaded,
}) => {
  const [activeStage, setActiveStage] = useState<JourneyStage>('act');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCertificateName, setSelectedCertificateName] = useState<string>(
    'IELTS_Academic_Score_7.5_TRF.pdf'
  );

  const handleSimulateUpload = (certName: string) => {
    setSelectedCertificateName(certName);
    onCertificateUploadedStateChange(true);
    setShowUploadModal(false);
  };

  const handleReset = () => {
    onCertificateUploadedStateChange(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8 theme-text-main">
      {/* Header Badge */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 theme-bg-card text-[#FFD21C] text-xs font-mono font-bold rounded-full border theme-border backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>Screen 3 of 3 · AI Decision Engine</span>
        </div>
      </div>

      {/* Journey Stepper */}
      <JourneyStepper
        currentStage={activeStage}
        onSelectStage={setActiveStage}
      />

      {/* Main Focus: Next Action Card */}
      <NextActionCard
        onUploadClick={() => setShowUploadModal(true)}
        isCertificateUploaded={isCertificateUploaded}
        onResetSimulation={handleReset}
      />

      {/* Interactive Testing Sandbox Notice */}
      <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-[#E30613] uppercase">
            Interactive Prototype Sandbox
          </span>
          <span className="theme-text-muted">Test state propagation</span>
        </div>
        <p className="theme-text-muted">
          Clicking "Simulate Upload" will immediately verify IELTS Band 7.5, update your readiness score to 100%, and remove the language blocker across your Dashboard and Profile.
        </p>
      </div>

      {/* Back to Qualification check */}
      <div className="pt-2 border-t theme-border flex justify-start">
        <button
          onClick={onBackToQualification}
          className="px-5 py-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Qualification Check</span>
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
                Attach Language Certificate
              </h3>
              <p className="text-xs theme-text-muted">
                Select a verified credential to simulate instantaneous clearance.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleSimulateUpload('IELTS_Academic_Score_7.5_TRF.pdf')}
                className="w-full p-4 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border hover:border-[#FFD21C] text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold theme-text-main">IELTS Academic (Band 7.5)</div>
                  <div className="text-xs theme-text-muted font-mono">TRF #984210 · Band 7.5 (CEFR C1)</div>
                </div>
                <Upload className="w-4 h-4 text-[#FFD21C]" />
              </button>

              <button
                onClick={() => handleSimulateUpload('TOEFL_iBT_Score_105.pdf')}
                className="w-full p-4 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border hover:border-[#FFD21C] text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold theme-text-main">TOEFL iBT (105 / 120)</div>
                  <div className="text-xs theme-text-muted font-mono">Official Score Report</div>
                </div>
                <Upload className="w-4 h-4 text-[#FFD21C]" />
              </button>

              <button
                onClick={() => handleSimulateUpload('Goethe_Zertifikat_C1.pdf')}
                className="w-full p-4 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border hover:border-[#FFD21C] text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold theme-text-main">Goethe-Zertifikat C1</div>
                  <div className="text-xs theme-text-muted font-mono">German Academic Level</div>
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
