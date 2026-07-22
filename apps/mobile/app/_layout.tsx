import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/src/lib/auth/AuthContext';
import { PlatformBootstrap } from '@/src/components/PlatformBootstrap';
import { colors } from '@/src/theme/tokens';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <PlatformBootstrap />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.shellBg },
          headerTintColor: colors.textBody,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.shellBg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/index" options={{ title: 'Sign in' }} />
        <Stack.Screen name="auth/callback" options={{ title: 'Signing in' }} />
        <Stack.Screen name="discover" options={{ title: 'Discover' }} />
        <Stack.Screen name="artists/[artistName]" options={{ title: 'Artist' }} />
        <Stack.Screen name="venues/[venueName]" options={{ title: 'Venue' }} />
        <Stack.Screen name="browse/shows/nearby" options={{ title: 'Nearby' }} />
        <Stack.Screen name="browse/shows/tonight" options={{ title: 'Tonight' }} />
        <Stack.Screen name="saved" options={{ title: 'Saved' }} />
        <Stack.Screen name="liked" options={{ title: 'Liked' }} />
        <Stack.Screen name="upload" options={{ title: 'Review clip' }} />
      </Stack>
    </AuthProvider>
  );
}
