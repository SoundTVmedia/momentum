import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2, Upload } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ProgramApplicationFormShell from '@/react-app/components/program-applications/ProgramApplicationFormShell';
import {
  FormField,
  TextInput,
  TextArea,
  SelectInput,
  MultiSelectChips,
} from '@/react-app/components/program-applications/form-fields';
import {
  BUDGET_TIERS,
  MUSIC_GENRES,
  SPONSOR_INDUSTRIES,
  SPONSOR_PACKAGE_TYPES,
  type SponsorApplicationData,
} from '@/shared/program-applications';

const STEP_LABELS = ['Company', 'Campaign', 'Package', 'Assets', 'Creators', 'Submit'];

const CREATOR_TYPES = ['influencer', 'ambassador', 'ugc', 'photographer', 'other'] as const;

const PACKAGE_LABELS: Record<(typeof SPONSOR_PACKAGE_TYPES)[number], string> = {
  single_show: 'Single show',
  regional: 'Regional package',
  genre: 'Genre package',
  tour: 'Tour package',
  custom: 'Custom package',
};

const initialForm: SponsorApplicationData = {
  companyName: '',
  contactName: '',
  workEmail: '',
  website: '',
  category: '',
  campaignGoal: '',
  cta: '',
  campaignPriority: '',
  packageType: 'single_show',
  targetMarkets: [],
  targetGenres: [],
  targetTour: '',
  showCount: undefined,
  budgetTier: undefined,
  campaignWindowStart: '',
  campaignWindowEnd: '',
  logoUrl: '',
  brandColors: '',
  creativeRestrictions: '',
  wantsCreators: true,
  creatorTypes: [],
  creatorNotes: '',
  additionalNotes: '',
  consent: false,
};

function parseMarketsInput(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SponsorApplicationForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SponsorApplicationData>(() => ({
    ...initialForm,
    workEmail: user?.email || '',
    contactName:
      user?.google_user_data?.name?.trim() ||
      user?.email?.split('@')[0] ||
      '',
  }));
  const [marketsInput, setMarketsInput] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof SponsorApplicationData>(
    key: K,
    value: SponsorApplicationData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep = (currentStep: number): string | null => {
    switch (currentStep) {
      case 1:
        if (!form.companyName.trim()) return 'Company name is required.';
        if (!form.contactName.trim()) return 'Contact name is required.';
        if (!form.workEmail.trim()) return 'Work email is required.';
        if (!form.website.trim()) return 'Website is required.';
        if (!form.category) return 'Select an industry.';
        return null;
      case 2:
        if (!form.campaignGoal.trim()) return 'Describe what you are promoting.';
        if (!form.cta.trim()) return 'Primary CTA is required.';
        return null;
      case 3:
        if (!form.packageType) return 'Select a package type.';
        return null;
      case 4:
        return null;
      case 5:
        return null;
      case 6:
        if (!form.consent) return 'You must accept the terms to submit.';
        return null;
      default:
        return null;
    }
  };

  const canGoNext = validateStep(step) === null;

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/program-applications/brand-asset', {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Logo upload failed');
      }
      const data = (await res.json()) as { url: string };
      update('logoUrl', data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleNext = async () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    if (step < STEP_LABELS.length) {
      if (step === 3) {
        update('targetMarkets', parseMarketsInput(marketsInput));
      }
      setStep((s) => s + 1);
      return;
    }

    setSubmitting(true);
    try {
      const payload: SponsorApplicationData = {
        ...form,
        targetMarkets: parseMarketsInput(marketsInput),
        website: form.website.trim().startsWith('http')
          ? form.website.trim()
          : `https://${form.website.trim()}`,
        consent: true,
      };

      const res = await fetch('/api/program-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'sponsor', formData: payload }),
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
          <h1 className="text-3xl font-headline font-bold mb-4">Thanks for reaching out</h1>
          <p className="text-gray-300 mb-8">
            Your sponsorship inquiry has been submitted. Our partnerships team will review fit and follow up at {form.workEmail}.
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
        title="Partner With Us"
        description="Launch authentic live-music sponsorship campaigns with creators already in the scene."
        step={step}
        totalSteps={STEP_LABELS.length}
        stepLabels={STEP_LABELS}
        onBack={() => navigate(-1)}
        onPrevious={() => setStep((s) => Math.max(1, s - 1))}
        onNext={handleNext}
        canGoNext={canGoNext && !uploadingLogo}
        isLastStep={step === STEP_LABELS.length}
        submitting={submitting}
        submitLabel="Submit inquiry"
        error={error}
      >
        {step === 1 ? (
          <div className="space-y-4">
            <FormField label="Company / brand name" required>
              <TextInput value={form.companyName} onChange={(v) => update('companyName', v)} />
            </FormField>
            <FormField label="Contact name" required>
              <TextInput value={form.contactName} onChange={(v) => update('contactName', v)} />
            </FormField>
            <FormField label="Work email" required>
              <TextInput type="email" value={form.workEmail} onChange={(v) => update('workEmail', v)} />
            </FormField>
            <FormField label="Website" required>
              <TextInput value={form.website} onChange={(v) => update('website', v)} placeholder="https://..." />
            </FormField>
            <FormField label="Industry / category" required>
              <SelectInput
                value={form.category}
                onChange={(v) => update('category', v)}
                placeholder="Select industry"
                options={SPONSOR_INDUSTRIES.map((i) => ({ value: i, label: i }))}
              />
            </FormField>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <FormField label="What are you trying to promote?" required>
              <TextArea value={form.campaignGoal} onChange={(v) => update('campaignGoal', v)} />
            </FormField>
            <FormField label="Primary CTA" required>
              <TextInput value={form.cta} onChange={(v) => update('cta', v)} placeholder="Try our app tonight" />
            </FormField>
            <FormField label="What matters most?">
              <SelectInput
                value={form.campaignPriority || ''}
                onChange={(v) => update('campaignPriority', v)}
                placeholder="Optional"
                options={[
                  { value: 'awareness', label: 'Awareness' },
                  { value: 'traffic', label: 'Traffic' },
                  { value: 'trials', label: 'Trials' },
                  { value: 'sales', label: 'Sales' },
                  { value: 'sampling', label: 'Sampling' },
                  { value: 'attendance', label: 'Attendance' },
                ]}
              />
            </FormField>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <FormField label="Sponsorship package" required>
              <SelectInput
                value={form.packageType}
                onChange={(v) => update('packageType', v as SponsorApplicationData['packageType'])}
                options={SPONSOR_PACKAGE_TYPES.map((p) => ({ value: p, label: PACKAGE_LABELS[p] }))}
              />
            </FormField>
            <FormField label="Target markets (comma-separated)">
              <TextInput
                value={marketsInput}
                onChange={setMarketsInput}
                placeholder="New York, Los Angeles"
              />
            </FormField>
            <FormField label="Target genres">
              <MultiSelectChips
                values={form.targetGenres || []}
                onChange={(v) => update('targetGenres', v)}
                options={MUSIC_GENRES}
              />
            </FormField>
            <FormField label="Target artist / tour">
              <TextInput value={form.targetTour || ''} onChange={(v) => update('targetTour', v)} />
            </FormField>
            <FormField label="Number of shows">
              <TextInput
                type="number"
                value={form.showCount != null ? String(form.showCount) : ''}
                onChange={(v) => update('showCount', v ? Number(v) : undefined)}
              />
            </FormField>
            <FormField label="Budget range">
              <SelectInput
                value={form.budgetTier || ''}
                onChange={(v) => update('budgetTier', (v || undefined) as SponsorApplicationData['budgetTier'])}
                placeholder="Optional"
                options={BUDGET_TIERS.map((t) => ({ value: t, label: t }))}
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Campaign start">
                <TextInput type="date" value={form.campaignWindowStart || ''} onChange={(v) => update('campaignWindowStart', v)} />
              </FormField>
              <FormField label="Campaign end">
                <TextInput type="date" value={form.campaignWindowEnd || ''} onChange={(v) => update('campaignWindowEnd', v)} />
              </FormField>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <FormField label="Logo">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo || !user}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-50"
                >
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload logo
                </button>
                {!user ? (
                  <span className="text-xs text-gray-500">Sign in to upload, or paste a URL below.</span>
                ) : null}
                {form.logoUrl ? (
                  <span className="text-xs text-green-400 truncate max-w-full">Logo attached</span>
                ) : null}
              </div>
              <div className="mt-2">
                <TextInput
                  value={form.logoUrl || ''}
                  onChange={(v) => update('logoUrl', v)}
                  placeholder="Or paste logo URL"
                />
              </div>
            </FormField>
            <FormField label="Brand colors">
              <TextInput value={form.brandColors || ''} onChange={(v) => update('brandColors', v)} placeholder="#FF5500, #111111" />
            </FormField>
            <FormField label="Creative notes or restrictions">
              <TextArea value={form.creativeRestrictions || ''} onChange={(v) => update('creativeRestrictions', v)} />
            </FormField>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.wantsCreators}
                onChange={(e) => update('wantsCreators', e.target.checked)}
              />
              <span className="text-sm text-gray-300">We want creator / influencer participation</span>
            </label>
            {form.wantsCreators ? (
              <>
                <FormField label="Creator types">
                  <MultiSelectChips
                    values={form.creatorTypes || []}
                    onChange={(v) => update('creatorTypes', v)}
                    options={CREATOR_TYPES}
                  />
                </FormField>
                <FormField label="Creator preferences or notes">
                  <TextArea value={form.creatorNotes || ''} onChange={(v) => update('creatorNotes', v)} />
                </FormField>
              </>
            ) : null}
            <FormField label="Additional notes">
              <TextArea value={form.additionalNotes || ''} onChange={(v) => update('additionalNotes', v)} />
            </FormField>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              We review every sponsorship inquiry manually. Subtle, scene-native integrations work best — no forced scripts required.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => update('consent', e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-300">
                I agree to be contacted about this inquiry and understand approval is required before campaign access.
              </span>
            </label>
          </div>
        ) : null}
      </ProgramApplicationFormShell>
    </div>
  );
}
