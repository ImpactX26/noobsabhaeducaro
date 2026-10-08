import React, { useEffect, useState } from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

interface ProcessingScreenProps {
  onComplete: () => void;
  applicantName: string;
}

const analysisSteps = [
  { id: 1, text: 'Extracting academic records and transcript seals...', duration: 800 },
  { id: 2, text: 'Cross-referencing university status in KMK Anabin database (H+)...', duration: 1000 },
  { id: 3, text: 'Calculating German GPA with modified Bavarian formula & ECTS credits...', duration: 900 },
  { id: 4, text: 'Auditing language test validity against German admissions criteria...', duration: 800 },
  { id: 5, text: 'Synthesizing verified applicant dossier & priority directives...', duration: 600 },
];

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({
  onComplete,
  applicantName,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 2;
      });
    }, 55);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress >= 95) {
      setCurrentStepIndex(4);
    } else if (progress >= 70) {
      setCurrentStepIndex(3);
    } else if (progress >= 45) {
      setCurrentStepIndex(2);
    } else if (progress >= 20) {
      setCurrentStepIndex(1);
    } else {
      setCurrentStepIndex(0);
    }

    if (progress >= 100) {
      const timeout = setTimeout(() => {
        onComplete();
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [progress, onComplete]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 space-y-8 text-center theme-text-main">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card border theme-border text-[#FFD21C] text-xs font-mono font-bold backdrop-blur-md">
          <Cpu className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>SIEG.AI Admissions Intelligence Engine</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black theme-text-main tracking-tight uppercase">
          Scanning & Verifying Dossier
        </h1>

        <p className="text-sm theme-text-muted max-w-md mx-auto">
          Evaluating credentials for <span className="theme-text-main font-bold">{applicantName || 'Applicant'}</span> against official German higher education databases.
        </p>
      </div>

      {/* Modern Circular / Bar Progress Card */}
      <div className="theme-bg-card border theme-border rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono theme-text-muted">
            <span>KMK Anabin + Bavarian Conversion</span>
            <span className="font-bold text-[#FFD21C]">{progress}%</span>
          </div>

          <div className="w-full h-3 theme-bg-surface rounded-full overflow-hidden border theme-border p-0.5 flex">
            <div
              className="h-full bg-gradient-to-r from-[#050505] via-[#E30613] to-[#FFD21C] rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Live Active Step Readout */}
        <div className="p-4 rounded-2xl theme-bg-surface border theme-border text-left space-y-3">
          <div className="text-[11px] font-mono font-bold text-[#E30613] uppercase tracking-wider flex items-center justify-between">
            <span>Current Pipeline Operation</span>
            <span className="w-2 h-2 rounded-full bg-[#FFD21C] animate-ping" />
          </div>

          <p className="text-sm font-bold theme-text-main font-mono">
            {analysisSteps[currentStepIndex].text}
          </p>
        </div>

        {/* Institutional Trust Seals */}
        <div className="pt-2 flex flex-wrap items-center justify-around gap-4 text-xs font-mono theme-text-muted border-t theme-border">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FFD21C]" />
            KMK Anabin H+
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E30613]" />
            Uni-Assist Criteria
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FFD21C]" />
            Modifizierte bayerische Formel
          </span>
        </div>
      </div>
    </div>
  );
};
