import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@/src/lib/auth/AuthContext';
import {
  clearCaptureHandoff,
  enqueueCaptureUpload,
  readCaptureHandoff,
  runOutboxJob,
  type CaptureHandoff,
} from '@/src/lib/upload/outbox';
import { formFieldsFromCandidate } from '@/src/lib/capture/show-match';
import type { UploadFormFields } from '@/src/lib/upload/multipart';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

const emptyForm: UploadFormFields = {
  artist_name: '',
  venue_name: '',
  location: '',
  content_description: '',
  song_title: '',
  genre_name: '',
  hashtags: '',
};

export default function UploadReviewScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [handoff, setHandoff] = useState<CaptureHandoff | null>(null);
  const [form, setForm] = useState<UploadFormFields>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = await readCaptureHandoff();
      if (!cancelled) {
        setHandoff(pending);
        if (pending?.showCandidate) {
          const prefill = formFieldsFromCandidate(pending.showCandidate);
          setForm((prev) => ({
            ...prev,
            artist_name: prev.artist_name || prefill.artist_name,
            venue_name: prev.venue_name || prefill.venue_name,
            location: prev.location || prefill.location,
          }));
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const player = useVideoPlayer(handoff?.videoUri ?? null, (instance) => {
    instance.loop = true;
    if (handoff?.videoUri) instance.play();
  });

  if (!authLoading && !user) {
    return <Redirect href="/auth" />;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.ember} />
      </View>
    );
  }

  if (!handoff) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Upload' }} />
        <Text style={styles.body}>No pending capture. Record a clip first.</Text>
        <Pressable style={styles.primary} onPress={() => router.replace('/capture')}>
          <Text style={styles.primaryLabel}>Open capture</Text>
        </Pressable>
      </View>
    );
  }

  const onDiscard = async () => {
    await clearCaptureHandoff();
    router.replace('/capture');
  };

  const onShare = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const job = await enqueueCaptureUpload({ handoff, form });
      // Fire upload; queue screen shows progress
      void runOutboxJob(job.id).catch(() => undefined);
      router.replace('/upload-queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enqueue upload');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Review clip' }} />
      <VideoView style={styles.video} player={player} contentFit="contain" nativeControls />
      <View style={styles.form}>
        <Field
          label="Artist"
          value={form.artist_name}
          onChange={(artist_name) => setForm((f) => ({ ...f, artist_name }))}
        />
        <Field
          label="Venue"
          value={form.venue_name}
          onChange={(venue_name) => setForm((f) => ({ ...f, venue_name }))}
        />
        <Field
          label="Song"
          value={form.song_title}
          onChange={(song_title) => setForm((f) => ({ ...f, song_title }))}
        />
        <Field
          label="Caption"
          value={form.content_description}
          onChange={(content_description) =>
            setForm((f) => ({ ...f, content_description }))
          }
          multiline
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable style={styles.secondary} onPress={() => void onDiscard()} disabled={submitting}>
            <Text style={styles.secondaryLabel}>Discard</Text>
          </Pressable>
          <Pressable style={styles.primary} onPress={() => void onShare()} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.textBody} />
            ) : (
              <Text style={styles.primaryLabel}>Share</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, multiline && styles.inputMultiline]}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.shellBg },
  centered: {
    flex: 1,
    backgroundColor: colors.shellBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  video: {
    width: '100%',
    aspectRatio: 9 / 14,
    backgroundColor: '#000',
  },
  form: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  field: { gap: 4 },
  label: { ...typography.label },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    borderRadius: radii.sm,
    color: colors.textBody,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.flare,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: colors.textBody, fontWeight: '700', fontSize: 16 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: colors.textBody, fontWeight: '600' },
  body: { ...typography.body, textAlign: 'center' },
  error: { color: colors.danger },
});
