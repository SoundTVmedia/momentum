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
  isValidUrl,
} from '@/react-app/components/program-applications/form-fields';
import {
  MUSIC_GENRES,
  SOCIAL_PLATFORMS,
  type AmbassadorApplicationData,
} from '@/shared/program-applications';

const STEP_LABELS = ['Basics', 'Music', 'Network', 'Motivation', 'Submit'];

const initialForm: AmbassadorApplicationData = {
  fullName: '',
  email: '',
  phone: '',
  primaryCity: '',
  secondaryRegion: '',
  socialLinks: [''],
  primaryPlatform: '',
  monthlyShows: 0,
  genres: [],
  lastFiveArtists: ['', '', '', '', ''],
  localInfluenceCount: 0,
  motivation: '',
  growthPlan: '',
  communityLeadership: '',
  sampleLinks: [''],
  availabilityPerMonth: '',
  consent: false,
};

export default function AmbassadorApplicationForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AmbassadorApplicationData>(() => ({
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

  const update = <K extends keyof AmbassadorApplicationData>(
    key: K,
    value: AmbassadorApplicationData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep = (currentStep: number): string | null => {
    switch (currentStep) {
      case 1:
        if (!form.fullName.trim()) return 'Full name is required.';
        if (!form.email.trim()) return 'Email is required.';
        if (!form.primaryCity.trim()) return 'Primary city is required.';
        return null;
      case 2:
        if (form.monthlyShows < 0) return 'Monthly show count is required.';
        if (form.genres.length === 0) return 'Select at least one genre.';
        if (cleanTextList(form.lastFiveArtists).length < 1) {
          return 'Add at least one recent artist you saw live.';
        }
        return null;
      case 3: {
        const links = cleanUrlList(form.socialLinks);
        if (links.length === 0) return 'Add at least one social link.';
        if (!form.primaryPlatform) return 'Select your primary platform.';
        if (form.localInfluenceCount < 0) return 'Local influence count is required.';
        if (form.sampleLinks?.some((l) => l.trim() && !isValidUrl(l))) {
          return 'Sample links must be valid URLs.';
        }
        return null;
      }
      case 4:
        if (!form.motivation.trim()) return 'Tell us why you want to be an ambassador.';
        if (!form.growthPlan.trim()) return 'Share how you would help grow the app.';
        return null;
      case 5:
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
      const payload: AmbassadorApplicationData = {
        ...form,
        socialLinks: cleanUrlList(form.socialLinks),
        lastFiveArtists: cleanTextList(form.lastFiveArtists),
        sampleLinks: cleanUrlList(form.sampleLinks || []),
        consent: true,
      };

      const res = await fetch('/api/program-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'ambassador', formData: payload }),
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
            Thanks for applying to be an ambassador. Our team will review your application and follow up by email.
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
        title="Become an Ambassador"
        description="Help grow the live-music community in your city."
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
            <FormField label="Phone number">
              <TextInput type="tel" value={form.phone || ''} onChange={(v) => update('phone', v)} />
            </FormField>
            <FormField label="Primary city" required>
              <TextInput value={form.primaryCity} onChange={(v) => update('primaryCity', v)} placeholder="Austin, TX" />
            </FormField>
            <FormField label="Secondary city / region">
              <TextInput value={form.secondaryRegion || ''} onChange={(v) => update('secondaryRegion', v)} />
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
            <FormField label="Genres you attend most" required>
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
            <FormField label="Social links" required>
              <UrlListInput values={form.socialLinks} onChange={(v) => update('socialLinks', v)} />
            </FormField>
            <FormField label="Primary platform" required>
              <SelectInput
                value={form.primaryPlatform}
                onChange={(v) => update('primaryPlatform', v)}
                placeholder="Select platform"
                options={SOCIAL_PLATFORMS.map((p) => ({
                  value: p,
                  label: p.replace(/-/g, ' '),
                }))}
              />
            </FormField>
            <FormField label="People you usually influence when deciding where to go" required>
              <TextInput
                type="number"
                value={String(form.localInfluenceCount)}
                onChange={(v) => update('localInfluenceCount', Number(v) || 0)}
              />
            </FormField>
            <FormField label="Event-related post links">
              <UrlListInput values={form.sampleLinks || ['']} onChange={(v) => update('sampleLinks', v)} />
            </FormField>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <FormField label="Why do you want to be an ambassador?" required>
              <TextArea value={form.motivation} onChange={(v) => update('motivation', v)} />
            </FormField>
            <FormField label="How would you help grow the app in your market?" required>
              <TextArea value={form.growthPlan} onChange={(v) => update('growthPlan', v)} />
            </FormField>
            <FormField label="Have you led communities, group chats, or event coordination?">
              <TextArea
                value={form.communityLeadership || ''}
                onChange={(v) => update('communityLeadership', v)}
                placeholder="Optional — share examples"
              />
            </FormField>
            <FormField label="Availability per month">
              <SelectInput
                value={form.availabilityPerMonth || ''}
                onChange={(v) => update('availabilityPerMonth', v)}
                placeholder="Optional"
                options={[
                  { value: '1-2', label: '1–2 activations' },
                  { value: '3-4', label: '3–4 activations' },
                  { value: '5+', label: '5+ activations' },
                ]}
              />
            </FormField>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Review your answers, then submit for manual review. A confidence score helps our team prioritize applications, but every submission is reviewed by a human.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => update('consent', e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-300">
                I agree to be contacted about this application and understand ambassador status is subject to approval.
              </span>
            </label>
          </div>
        ) : null}
      </ProgramApplicationFormShell>
    </div>
  );
}
