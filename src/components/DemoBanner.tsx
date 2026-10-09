import React from 'react';
import { FlaskConical } from 'lucide-react';
import { setDemoMode } from '../demo/demoMode';
import { resetDemo } from '../demo/demoApi';

/**
 * Always visible while DEMO MODE is on. Says plainly that everything shown is simulated, so a demo can never be
 * mistaken for live Gemini processing or a real account.
 */
export const DemoBanner: React.FC = () => (
  <div role="status" className="relative z-30 bg-[#FFD21C] text-black border-b border-black/20 px-4 py-2">
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
      <p className="flex items-start gap-2 leading-snug">
        <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong className="font-black uppercase tracking-wide">Demo mode</strong> — simulated results from fictional sample data. Not live Gemini processing and
          not a real account. The files you pick are not read or uploaded.
        </span>
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            resetDemo();
            setDemoMode(true);
          }}
          className="px-3 py-1 rounded-lg border border-black/40 font-bold hover:bg-black/10 cursor-pointer"
        >
          Restart demo
        </button>
        <button
          type="button"
          onClick={() => setDemoMode(false)}
          className="px-3 py-1 rounded-lg bg-black text-white font-bold hover:bg-black/80 cursor-pointer"
        >
          Use live backend
        </button>
      </div>
    </div>
  </div>
);
