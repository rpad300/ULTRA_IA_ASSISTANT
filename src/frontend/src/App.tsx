import { useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DashboardView } from "@/components/views/DashboardView";
import { CompaniesView } from "@/components/views/CompaniesView";
import { ContactsView } from "@/components/views/ContactsView";
import { ContactDetailView } from "@/components/views/ContactDetailView";
import { ProjectsView } from "@/components/views/ProjectsView";
import { ProjectCockpitView } from "@/components/views/ProjectCockpitView";
import { ThreadsViewWithBulk as ThreadsView } from "@/components/views/ThreadsViewWithBulk";
import { ThreadWorkspaceView } from "@/components/views/ThreadWorkspaceView";
import { SessionLiveView } from "@/components/views/SessionLiveView";
import { SessionSummaryView } from "@/components/views/SessionSummaryView";
import { TasksView } from "@/components/views/TasksView";
import { AnalyticsView } from "@/components/views/AnalyticsView";
import { InsightsView } from "@/components/views/InsightsView";
import { ProfilesView } from "@/components/views/ProfilesView";
import { SettingsView } from "@/components/views/SettingsView";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OverlayRoot } from "@/components/overlay/OverlayRoot";
import { useOverlayStore } from "@/store/overlayStore";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { NativeAudioView } from "@/components/views/NativeAudioView";
import { MeetingHUD } from "@/components/oracle/MeetingHUD";

function AppContent() {
  const { isOpen, scriptContent, closeOverlay } = useOverlayStore();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Check if user has completed onboarding
    return !localStorage.getItem('onboarding_completed');
  });

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  return (
    <HashRouter>
      <OnboardingWizard open={showOnboarding} onComplete={handleOnboardingComplete} />
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/companies" element={<CompaniesView />} />
            <Route path="/contacts" element={<ContactsView />} />
            <Route path="/contacts/:contactId" element={<ContactDetailView />} />
            <Route path="/tasks" element={<TasksView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/insights" element={<InsightsView />} />
            <Route path="/profiles" element={<ProfilesView />} />
            <Route path="/companies/:companyId/projects" element={<ProjectsView />} />
            <Route path="/companies/:companyId/projects/:projectId" element={<ProjectCockpitView />} />
            <Route path="/projects/:projectId/threads" element={<ThreadsView />} />
            <Route path="/threads/:threadId" element={<ThreadWorkspaceView />} />
            <Route path="/sessions/:sessionId/live" element={<SessionLiveView />} />
            <Route path="/sessions/:sessionId/summary" element={<SessionSummaryView />} />
            <Route path="/sessions/:sessionId/transcript" element={<SessionLiveView readOnly={true} />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/native-audio" element={<NativeAudioView />} />
            <Route path="/oracle" element={<MeetingHUD />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes >
        </ErrorBoundary >
      </Layout >
      {isOpen && (
        <OverlayRoot
          scriptContent={scriptContent}
          onClose={closeOverlay}
        />
      )
      }
    </HashRouter >
  );
}

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
