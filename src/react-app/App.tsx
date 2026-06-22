import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import AppRouteChrome from "@/react-app/components/AppRouteChrome";
import { AuthProvider } from "@getmocha/users-service/react";
import ErrorBoundary from "@/react-app/components/ErrorBoundary";
import HomePage from "@/react-app/pages/Home";
import NotFoundPage from "@/react-app/pages/NotFound";
import AuthPage from "@/react-app/pages/Auth";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import ResetPasswordPage from "@/react-app/pages/ResetPassword";
import OnboardingPage from "@/react-app/pages/Onboarding";
import DashboardPage from "@/react-app/pages/Dashboard";
import UploadClipPage from "@/react-app/pages/UploadClip";
import UploadQueuePage from "@/react-app/pages/UploadQueue";
import SavedClipsPage from "@/react-app/pages/SavedClips";
import LikedClipsPage from "@/react-app/pages/LikedClips";
import ArtistPage from "@/react-app/pages/ArtistPage";
import VenuePage from "@/react-app/pages/VenuePage";
import AdminPage from "@/react-app/pages/Admin";
import UserProfilePage from "@/react-app/pages/UserProfile";
import DiscoverPage from "@/react-app/pages/Discover";
import BrowseClipsFeedPage from "@/react-app/pages/BrowseClipsFeed";
import BrowseFavoriteClipsPage from "@/react-app/pages/BrowseFavoriteClips";
import BrowseFavoriteShowsPage from "@/react-app/pages/BrowseFavoriteShows";
import BrowseNearbyShowsPage from "@/react-app/pages/BrowseNearbyShows";
import BrowseTonightShowsPage from "@/react-app/pages/BrowseTonightShows";
import MyShowsPage from "@/react-app/pages/MyShowsPage";
import AmbassadorsPage from "@/react-app/pages/Ambassadors";
import InfluencersPage from "@/react-app/pages/Influencers";
import BecomeAmbassadorPage from "@/react-app/pages/BecomeAmbassador";
import BecomeInfluencerPage from "@/react-app/pages/BecomeInfluencer";
import BecomeSponsorPage from "@/react-app/pages/BecomeSponsor";
import SponsorDashboardPage from "@/react-app/pages/SponsorDashboard";
import AnalyticsPage from "@/react-app/pages/Analytics";
import ShowClipsPage from "@/react-app/pages/ShowClips";
import EventClipsPage from "@/react-app/pages/EventClips";
import SongPage from "@/react-app/pages/SongPage";
import GlobalSongPage from "@/react-app/pages/GlobalSongPage";
import GenrePage from "@/react-app/pages/GenrePage";
import ShareClipRedirect from "@/react-app/pages/ShareClipRedirect";
import { MobileChromeProvider } from "@/react-app/contexts/MobileChromeContext";
import PendingCaptureRouteRecovery from "@/react-app/components/PendingCaptureRouteRecovery";
import { ClipUploadQueueProvider } from "@/react-app/contexts/ClipUploadQueueContext";
import { NotificationsProvider } from "@/react-app/contexts/NotificationsContext";
import { useEffect } from "react";
import { registerNativePush } from "@/react-app/lib/native-bridge";
import { warmClipPlaybackAssets } from "@/react-app/lib/warmClipPlaybackAssets";

function NativeAppBootstrap() {
  useEffect(() => {
    void registerNativePush();
    warmClipPlaybackAssets();
  }, []);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="momentum-ambient" aria-hidden />
      <NativeAppBootstrap />
      <AuthProvider>
        <MobileChromeProvider>
        <ClipUploadQueueProvider>
        <NotificationsProvider>
        <Router>
          <PendingCaptureRouteRecovery />
          <Routes>
            <Route element={<AppRouteChrome />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/share/clip/:clipId" element={<ShareClipRedirect />} />
              <Route path="/feed" element={<Navigate to="/" replace />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadClipPage />} />
              <Route path="/upload-queue" element={<UploadQueuePage />} />
              <Route path="/saved" element={<SavedClipsPage />} />
              <Route path="/liked" element={<LikedClipsPage />} />
              <Route path="/artists/:artistName" element={<ArtistPage />} />
              <Route path="/venues/:venueName" element={<VenuePage />} />
              <Route path="/users/:userId" element={<UserProfilePage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/browse/clips/:feedType" element={<BrowseClipsFeedPage />} />
              <Route path="/browse/favorites/clips" element={<BrowseFavoriteClipsPage />} />
              <Route path="/browse/favorites/shows" element={<BrowseFavoriteShowsPage />} />
              <Route path="/browse/shows/nearby" element={<BrowseNearbyShowsPage />} />
              <Route path="/browse/shows/tonight" element={<BrowseTonightShowsPage />} />
              <Route path="/my/shows" element={<MyShowsPage />} />
              <Route path="/ambassadors" element={<AmbassadorsPage />} />
              <Route path="/influencers" element={<InfluencersPage />} />
              <Route path="/become/ambassador" element={<BecomeAmbassadorPage />} />
              <Route path="/become/influencer" element={<BecomeInfluencerPage />} />
              <Route path="/partner" element={<BecomeSponsorPage />} />
              <Route path="/become/sponsor" element={<Navigate to="/partner" replace />} />
              <Route path="/sponsors" element={<SponsorDashboardPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/premium" element={<Navigate to="/" replace />} />
              <Route path="/artists/:artistName/songs/:songSlug" element={<SongPage />} />
              <Route path="/songs/:songSlug" element={<GlobalSongPage />} />
              <Route path="/genres/:genreSlug" element={<GenrePage />} />
              <Route path="/artists/:artistName/shows/:showId/clips" element={<ShowClipsPage />} />
              <Route path="/events/clips/:eventTitle" element={<EventClipsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Router>
        </NotificationsProvider>
        </ClipUploadQueueProvider>
        </MobileChromeProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
