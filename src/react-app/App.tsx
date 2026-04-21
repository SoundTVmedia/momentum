import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@getmocha/users-service/react";
import ErrorBoundary from "@/react-app/components/ErrorBoundary";
import HomePage from "@/react-app/pages/Home";
import FeedPage from "@/react-app/pages/Feed";
import NotFoundPage from "@/react-app/pages/NotFound";
import AuthPage from "@/react-app/pages/Auth";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import OnboardingPage from "@/react-app/pages/Onboarding";
import DashboardPage from "@/react-app/pages/Dashboard";
import UploadClipPage from "@/react-app/pages/UploadClip";
import SavedClipsPage from "@/react-app/pages/SavedClips";
import ArtistPage from "@/react-app/pages/ArtistPage";
import VenuePage from "@/react-app/pages/VenuePage";
import AdminPage from "@/react-app/pages/Admin";
import UserProfilePage from "@/react-app/pages/UserProfile";
import DiscoverPage from "@/react-app/pages/Discover";
import AnalyticsPage from "@/react-app/pages/Analytics";
import PremiumPage from "@/react-app/pages/Premium";
import ShowClipsPage from "@/react-app/pages/ShowClips";
import MobileBottomNav from "@/react-app/components/MobileBottomNav";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadClipPage />} />
          <Route path="/saved" element={<SavedClipsPage />} />
          <Route path="/artists/:artistName" element={<ArtistPage />} />
          <Route path="/venues/:venueName" element={<VenuePage />} />
          <Route path="/users/:userId" element={<UserProfilePage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/artists/:artistName/shows/:showId/clips" element={<ShowClipsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <MobileBottomNav />
      </Router>
    </AuthProvider>
    </ErrorBoundary>
  );
}
