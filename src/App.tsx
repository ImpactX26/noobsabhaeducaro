/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  ApplicationStep,
  ApplicantDetails,
  DocumentItem,
  ProfileSection,
  QualificationRequirement,
  DashboardStats,
} from './types';
import {
  initialApplicantDetails,
  initialDocuments,
  applicantProfileSections,
  initialRequirements,
  initialDashboardStats,
} from './data/mockData';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Navbar } from './components/Navbar';
import { JourneyProgress } from './components/JourneyProgress';
import { AIChatbot } from './components/AIChatbot';
import { HomeScreen } from './components/HomeScreen';
import { ApplicantDetailsScreen } from './components/ApplicantDetailsScreen';
import { ConsentScreen } from './components/ConsentScreen';
import { DocumentUploadScreen } from './components/DocumentUploadScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { ApplicantProfileScreen } from './components/ApplicantProfileScreen';
import { QualificationCheckScreen } from './components/QualificationCheckScreen';
import { NextActionScreen } from './components/NextActionScreen';
import { LoginScreen } from './components/LoginScreen';

function AppContent() {
  // Navigation State: default to 'home' (Full-screen hero experience)
  const [currentStep, setCurrentStep] = useState<ApplicationStep>('home');

  // Chatbot Open State (can be triggered externally by "Ask AI Assistant" button)
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // Authentication Context
  const {
    user,
    isAuthenticated,
    userData,
    authModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    saveCurrentUserData,
  } = useAuth();

  // Application Data States
  const [applicantDetails, setApplicantDetails] = useState<ApplicantDetails>(initialApplicantDetails);
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [profileSections, setProfileSections] = useState<ProfileSection[]>(applicantProfileSections);
  const [requirements, setRequirements] = useState<QualificationRequirement[]>(initialRequirements);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(initialDashboardStats);
  const [isCertificateUploaded, setIsCertificateUploaded] = useState(false);

  // Synchronize isolated applicant data whenever active user session changes
  useEffect(() => {
    if (userData) {
      setApplicantDetails(userData.details);
      setDocuments(userData.documents);
      setProfileSections(userData.profileSections);
      setRequirements(userData.requirements);
      setDashboardStats(userData.dashboardStats);
      setIsCertificateUploaded(userData.isCertificateUploaded);
    }
  }, [userData]);

  // Persist current applicant state isolated to active user
  const persistState = (overrides?: Partial<{
    details: ApplicantDetails;
    documents: DocumentItem[];
    profileSections: ProfileSection[];
    requirements: QualificationRequirement[];
    dashboardStats: DashboardStats;
    isCertificateUploaded: boolean;
  }>) => {
    if (!user) return;
    saveCurrentUserData({
      details: overrides?.details || applicantDetails,
      documents: overrides?.documents || documents,
      profileSections: overrides?.profileSections || profileSections,
      requirements: overrides?.requirements || requirements,
      dashboardStats: overrides?.dashboardStats || dashboardStats,
      isCertificateUploaded:
        overrides?.isCertificateUploaded !== undefined
          ? overrides?.isCertificateUploaded
          : isCertificateUploaded,
    });
  };

  // Synchronize certificate upload state across Dashboard, Profile, and Requirements
  const handleCertificateUploadedStateChange = (uploaded: boolean) => {
    setIsCertificateUploaded(uploaded);

    // Update Dashboard Stats
    const updatedStats: DashboardStats = {
      ...dashboardStats,
      progressPercentage: uploaded ? 100 : 60,
      documentsUploadedCount: uploaded ? 5 : 4,
      documentsMissingCount: uploaded ? 0 : 1,
      requirementsMetCount: uploaded ? 4 : 3,
      requirementsAttentionCount: uploaded ? 0 : 1,
      nextActionText: uploaded ? 'Review finalized application' : 'Upload your language certificate',
    };
    setDashboardStats(updatedStats);

    // Update requirements checklist
    const updatedRequirements = requirements.map((req) => {
      if (req.id === 'language') {
        return uploaded
          ? {
              ...req,
              status: 'met' as const,
              statusLabel: 'Met',
              explanation:
                'Official IELTS Academic test score (Band 7.5 / CEFR C1) verified and satisfies German university requirements.',
              evidence: 'IELTS_Academic_Score_7.5_TRF.pdf',
              provenance: 'document-supported' as const,
            }
          : {
              ...req,
              status: 'missing' as const,
              statusLabel: 'Missing certificate',
              explanation:
                'Your application is missing proof of language proficiency. German Master\'s programs require an official IELTS, TOEFL, or Goethe test score.',
              evidence: 'No valid language certificate attached',
              provenance: 'missing' as const,
            };
      }
      return req;
    });
    setRequirements(updatedRequirements);

    // Update documents list
    const updatedDocs = documents.map((doc) => {
      if (doc.id === 'language') {
        return uploaded
          ? {
              ...doc,
              status: 'uploaded' as const,
              fileName: 'IELTS_Academic_Score_7.5_TRF.pdf',
              fileSize: '1.2 MB',
              uploadedAt: 'Just now',
            }
          : {
              ...doc,
              status: 'missing' as const,
              fileName: undefined,
              fileSize: undefined,
              uploadedAt: undefined,
            };
      }
      return doc;
    });
    setDocuments(updatedDocs);

    // Update profile sections (languages & documents)
    const updatedSections = profileSections.map((section) => {
      if (section.id === 'languages') {
        return {
          ...section,
          fields: section.fields.map((f) => {
            if (f.label === 'English Proficiency') {
              return uploaded
                ? {
                    ...f,
                    value: 'IELTS 7.5 (C1 Academic Competent)',
                    provenance: 'document-supported' as const,
                    subValue: 'TRF: 24IN019284SHAR7.5',
                  }
                : {
                    ...f,
                    value: 'Score Pending / Unverified',
                    provenance: 'missing' as const,
                    subValue: undefined,
                  };
            }
            return f;
          }),
        };
      }
      if (section.id === 'documents') {
        return {
          ...section,
          fields: section.fields.map((f) => {
            if (f.label === 'Language Certificate') {
              return uploaded
                ? {
                    ...f,
                    value: 'IELTS_Academic_Score_7.5_TRF.pdf',
                    provenance: 'document-supported' as const,
                    subValue: 'Uploaded & Verified · CEFR C1',
                  }
                : {
                    ...f,
                    value: 'Missing Certificate',
                    provenance: 'missing' as const,
                    subValue: 'Required before Uni-Assist submission',
                  };
            }
            return f;
          }),
        };
      }
      return section;
    });
    setProfileSections(updatedSections);

    persistState({
      isCertificateUploaded: uploaded,
      dashboardStats: updatedStats,
      requirements: updatedRequirements,
      documents: updatedDocs,
      profileSections: updatedSections,
    });
  };

  const handleStartApplication = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
    } else {
      setCurrentStep('details');
    }
  };

  const handleNavigate = (step: ApplicationStep) => {
    // If user clicks a protected view while not authenticated, prompt sign-in
    if (step !== 'home' && !isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen flex flex-col theme-bg-main theme-text-main transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        currentStep={currentStep}
        onNavigate={handleNavigate}
        onOpenAuth={(mode) => openAuthModal(mode)}
      />

      {/* Multi-step Journey Progress Header (visible when not on Home) */}
      {currentStep !== 'home' && (
        <div className="border-b theme-border theme-bg-card/90 backdrop-blur-md px-4 py-4 z-20">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <JourneyProgress
              currentStep={currentStep}
              onNavigate={handleNavigate}
            />

            <div className="hidden md:flex items-center gap-2 theme-text-muted text-xs font-mono">
              <span>Applicant:</span>
              <span className="font-bold theme-text-main">
                {applicantDetails.fullName}
              </span>
              <span className="opacity-40">·</span>
              <span className="text-[#FFD21C] font-semibold">
                {applicantDetails.goal === 'work' ? 'Employment in Germany 🇩🇪' : "Master's in Germany 🇩🇪"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 relative z-10 pb-16">
        {/* Step 1: Home (Full-screen hero & Germany intelligence) */}
        {currentStep === 'home' && (
          <HomeScreen
            onStart={handleStartApplication}
            onSelectGoal={(goal) => {
              const updated = { ...applicantDetails, goal };
              setApplicantDetails(updated);
              persistState({ details: updated });
            }}
          />
        )}

        {/* Step 2: Applicant Details */}
        {currentStep === 'details' && (
          <ApplicantDetailsScreen
            details={applicantDetails}
            onUpdate={(details) => {
              setApplicantDetails(details);
              persistState({ details });
            }}
            onContinue={() => setCurrentStep('consent')}
            onBack={() => setCurrentStep('home')}
          />
        )}

        {/* Step 3: Consent Screen */}
        {currentStep === 'consent' && (
          <ConsentScreen
            onContinue={() => setCurrentStep('documents')}
            onBack={() => setCurrentStep('details')}
          />
        )}

        {/* Step 4: Upload Documents */}
        {currentStep === 'documents' && (
          <DocumentUploadScreen
            documents={documents}
            onUpdateDocuments={(docs) => {
              setDocuments(docs);
              persistState({ documents: docs });
            }}
            onContinue={() => setCurrentStep('processing')}
            onBack={() => setCurrentStep('consent')}
          />
        )}

        {/* Step 5: AI Processing */}
        {currentStep === 'processing' && (
          <ProcessingScreen
            applicantName={applicantDetails.fullName}
            onComplete={() => setCurrentStep('dashboard')}
          />
        )}

        {/* Step 6: DASHBOARD SCREEN (Main Overview Page) */}
        {currentStep === 'dashboard' && (
          <DashboardScreen
            details={applicantDetails}
            documents={documents}
            requirements={requirements}
            stats={dashboardStats}
            isCertificateUploaded={isCertificateUploaded}
            onNavigateToProfile={() => setCurrentStep('profile')}
            onNavigateToDocuments={() => setCurrentStep('documents')}
            onNavigateToQualification={() => setCurrentStep('qualification')}
            onNavigateToNextAction={() => setCurrentStep('next-action')}
            onOpenChatbot={() => setIsChatbotOpen(true)}
            onUploadCertificate={() => handleCertificateUploadedStateChange(true)}
          />
        )}

        {/* Step 7: My Profile */}
        {currentStep === 'profile' && (
          <ApplicantProfileScreen
            sections={profileSections}
            onContinueToQualification={() => setCurrentStep('qualification')}
            onBack={() => setCurrentStep('dashboard')}
          />
        )}

        {/* Step 8: Qualification Check */}
        {currentStep === 'qualification' && (
          <QualificationCheckScreen
            requirements={requirements}
            onContinueToNextAction={() => setCurrentStep('next-action')}
            onBackToProfile={() => setCurrentStep('profile')}
          />
        )}

        {/* Step 9: Next Action */}
        {currentStep === 'next-action' && (
          <NextActionScreen
            onBackToQualification={() => setCurrentStep('qualification')}
            isCertificateUploaded={isCertificateUploaded}
            onCertificateUploadedStateChange={handleCertificateUploadedStateChange}
          />
        )}
      </main>

      {/* Floating AI Chatbot in Bottom Right */}
      <AIChatbot
        externalIsOpen={isChatbotOpen}
        onOpenChange={setIsChatbotOpen}
      />

      {/* Authentication Modal */}
      {authModalOpen && (
        <LoginScreen
          initialMode={authModalMode}
          onClose={closeAuthModal}
          onAuthSuccess={() => {
            closeAuthModal();
            // Automatically guide user into their application workspace
            if (currentStep === 'home') {
              setCurrentStep('dashboard');
            }
          }}
        />
      )}

      {/* Clean Premium Footer for Application Screens */}
      {currentStep !== 'home' && (
        <footer className="relative z-10 border-t theme-border theme-bg-card py-6 text-center text-xs font-mono theme-text-muted transition-colors">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded bg-[#E30613] text-white font-mono font-bold text-[10px]">
                SIEG.AI
              </span>
              <span className="font-bold theme-text-main">
                AI Applicant Copilot
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="text-[#FFD21C]">
                Germany Application Intelligence 🇩🇪
              </span>
            </div>
            <div className="theme-text-muted opacity-80">
              Academic standards aligned with KMK Anabin & Uni-Assist
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
