import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import Header from '@/react-app/components/Header';
import ProgramApplicationFormShell from '@/react-app/components/program-applications/ProgramApplicationFormShell';
import {
  FormField,
  TextInput,
  TextArea,
  SelectInput,
  MultiSelectChips,
  UrlListInput,
  TextListInput,
  cleanUrlList,
  cleanTextList,
} from '@/react-app/components/program-applications/form-fields';
import {
  MUSIC_GENRES,
  SOCIAL_PLATFORMS,
  type InfluencerApplicationData,
} from '@/shared/program-applications';

const STEP_LABELS = ['Identity', 'Live music', 'Content proof', 'Audience', 'Submit'];

const CONTENT_CATEGORIES = ['live-clips', 'reviews', 'vlogs', 'interviews', 'stories', 'other'] as const;

const initialForm: InfluencerApplicationData = {
  fullName: '',
  email: '',
  primaryMarket: '',
  secondaryMarkets: '',
  socialLinks: [''],
  primaryPlatform: '',
  contentCategories: [],
  monthlyShows: 0,
  genres: [],
  lastFiveArtists: ['', '', '', '', ''],
  liveMusicLinks: [''],
  brandCampaignLinks: [''],
  brandsWorkedWith: [''],
  onCameraComfort: 'medium',
  turnaround: undefined,
  audienceSize: undefined,
  engagementRate: undefined,
  motivation: '',
  uniqueAngle: '',
  consent: false,
};

export default function InfluencerApplicationForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<InfluencerApplicationData>(() => ({
    ...initialForm,
    email: user?.email || '',
    fullName:
      user?.google_user_data?.name?.trim() ||
      user?.email?.split('@')[0] ||
      '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof InfluencerApplicationData>(
    key: K,
    value: InfluencerApplicationData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep = (currentStep: number): string | null => {
    switch (currentStep) {
      case 1:
        if (!form.fullName.trim()) return 'Full name is required.';
        if (!form.email.trim()) return 'Email is required.';
        if (!form.primaryMarket.trim()) return 'Primary market is required.';
        if (!form.primaryPlatform) return 'Select your primary platform.';
        if (cleanUrlList(form.socialLinks).length === 0) return 'Add at least one social link.';
        if (form.contentCategories.length === 0) return 'Select at least one content category.';
        return null;
      case 2:
        if (form.genres.length === 0) return 'Select at least one genre.';
        if (cleanTextList(form.lastFiveArtists).length < 1) return 'Add at least one recent artist.';
        return null;
      case 3:
        if (cleanUrlList(form.liveMusicLinks).length === 0) {
          return 'Add at least one live-music content link.';
        }
        return null;
      case 4:
        return null;
      case 5:
        if (!form.motivation.trim()) return 'Tell us why you want to work with us.';
        if (!form.consent) return 'You must accept the terms to submit.';
        return null;
      default:
        return null;
    }
  };

  const canGoNext = validateStep(step) === null;

  const handleNext = async () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    if (step < STEP_LABELS.length) {
      setStep((s) => s + 1);
      return;
    }

    setSubmitting(true);
    try {
      const payload: InfluencerApplicationData = {
        ...form,
        socialLinks: cleanUrlList(form.socialLinks),
        lastFiveArtists: cleanTextList(form.lastFiveArtists),
        liveMusicLinks: cleanUrlList(form.liveMusicLinks),
        brandCampaignLinks: cleanUrlList(form.brandCampaignLinks || []),
        brandsWorkedWith: cleanTextList(form.brandsWorkedWith || []),
        consent: true,
      };

      const res = await fetch('/api/program-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'influencer', formData: payload }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to submit application');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-headline font-bold mb-4">Application submitted</h1>
          <p className="text-gray-300 mb-8">
            Thanks for applying as an influencer. Our team will review your content examples and follow up by email.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-3 momentum-grad-interactive rounded-lg text-white"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Header />
      <ProgramApplicationFormShell
        title="Become an Influencer"
        description="Share your live-music content and connect with brands authentically."
        step={step}
        totalSteps={STEP_LABELS.length}
        stepLabels={STEP_LABELS}
        onBack={() => navigate(-1)}
        onPrevious={() => setStep((s) => Math.max(1, s - 1))}
        onNext={handleNext}
        canGoNext={canGoNext}
        isLastStep={step === STEP_LABELS.length}
        submitting={submitting}
        error={error}
      >
        {step === 1 ? (
          <div className="space-y-4">
            <FormField label="Full name" required>
              <TextInput value={form.fullName} onChange={(v) => update('fullName', v)} />
            </FormField>
            <FormField label="Email" required>
              <TextInput type="email" value={form.email} onChange={(v) => update('email', v)} />
            </FormField>
            <FormField label="Primary market" required>
              <TextInput value={form.primaryMarket} onChange={(v) => update('primaryMarket', v)} />
            </FormField>
            <FormField label="Secondary markets">
              <TextInput value={form.secondaryMarkets || ''} onChange={(v) => update('secondaryMarkets', v)} />
            </FormField>
            <FormField label="Primary platform" required>
              <SelectInput
                value={form.primaryPlatform}
                onChange={(v) => update('primaryPlatform', v)}
                placeholder="Select platform"
                options={SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))}
              />
            </FormField>
            <FormField label="Social links" required>
              <UrlListInput values={form.socialLinks} onChange={(v) => update('socialLinks', v)} />
            </FormField>
            <FormField label="Content categories" required>
              <MultiSelectChips
                values={form.contentCategories}
                onChange={(v) => update('contentCategories', v)}
                options={CONTENT_CATEGORIES}
              />
            </FormField>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <FormField label="Shows attended per month" required>
              <TextInput
                type="number"
                value={String(form.monthlyShows)}
                onChange={(v) => update('monthlyShows', Number(v) || 0)}
              />
            </FormField>
            <FormField label="Genres you cover most" required>
              <MultiSelectChips values={form.genres} onChange={(v) => update('genres', v)} options={MUSIC_GENRES} />
            </FormField>
            <FormField label="Last five artists seen live" required>
              <TextListInput
                values={form.lastFiveArtists}
                onChange={(v) => update('lastFiveArtists', v)}
                placeholder="Artist name"
              />
            </FormField>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <FormField label="Live-music content links" required>
              <UrlListInput values={form.liveMusicLinks} onChange={(v) => update('liveMusicLinks', v)} />
            </FormField>
            <FormField label="Past branded campaign links">
              <UrlListInput
                values={form.brandCampaignLinks || ['']}
                onChange={(v) => update('brandCampaignLinks', v)}
              />
            </FormField>
            <FormField label="Brands worked with">
              <TextListInput
                values={form.brandsWorkedWith || ['']}
                onChange={(v) => update('brandsWorkedWith', v)}
                placeholder="Brand name"
              />
            </FormField>
            <FormField label="On-camera comfort" required>
              <SelectInput
                value={form.onCameraComfort}
                onChange={(v) => update('onCameraComfort', v as InfluencerApplicationData['onCameraComfort'])}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </FormField>
            <FormField label="Typical turnaround">
              <SelectInput
                value={form.turnaround || ''}
                onChange={(v) =>
                  update('turnaround', (v || undefined) as InfluencerApplicationData['turnaround'])
                }
                placeholder="Optional"
                options={[
                  { value: '24h', label: '24 hours' },
                  { value: '48h', label: '48 hours' },
                  { value: '72h', label: '72 hours' },
                  { value: 'flexible', label: 'Flexible' },
                ]}
              />
            </FormField>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <FormField label="Audience size (primary platform)">
              <TextInput
                type="number"
                value={form.audienceSize != null ? String(form.audienceSize) : ''}
                onChange={(v) => update('audienceSize', v ? Number(v) : undefined)}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Engagement rate (%)">
              <TextInput
                type="number"
                value={form.engagementRate != null ? String(form.engagementRate) : ''}
                onChange={(v) => update('engagementRate', v ? Number(v) : undefined)}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Anything unique about your audience or style?">
              <TextArea value={form.uniqueAngle || ''} onChange={(v) => update('uniqueAngle', v)} />
            </FormField>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <FormField label="Why do you want to work with us?" required>
              <TextArea value={form.motivation} onChange={(v) => update('motivation', v)} />
            </FormField>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => update('consent', e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-300">
                I agree to be contacted about this application and understand influencer status is subject to approval.
              </span>
            </label>
          </div>
        ) : null}
      </ProgramApplicationFormShell>
    </div>
  );
}
