export const MIN_ACCOUNT_AGE_YEARS = 13;

export const ACCOUNT_TOO_YOUNG_MESSAGE =
  'You must be at least 13 years old to create a Feedback account.';

export const GOOGLE_BIRTHDAY_SCOPE =
  'https://www.googleapis.com/auth/user.birthday.read';

export const GOOGLE_OAUTH_SCOPES = `openid email profile ${GOOGLE_BIRTHDAY_SCOPE}`;

export class AccountTooYoungError extends Error {
  readonly status = 403 as const;

  constructor(message = ACCOUNT_TOO_YOUNG_MESSAGE) {
    super(message);
    this.name = 'AccountTooYoungError';
  }
}

export function isAccountTooYoungError(error: unknown): error is AccountTooYoungError {
  return error instanceof AccountTooYoungError;
}

export function oauthErrorHttpStatus(
  error: unknown,
  fallback: 502 = 502,
): 403 | 502 {
  return isAccountTooYoungError(error) ? error.status : fallback;
}

export type CalendarDate = {
  year?: number;
  month?: number;
  day?: number;
};

export type ProviderAgeSignal = {
  birthday?: CalendarDate | null;
  lowerAgeBound?: number | null;
  upperAgeBound?: number | null;
};

/** True when the person is known to be younger than `minAge`. Unknown data returns false. */
export function isYoungerThanMinAge(
  signal: ProviderAgeSignal | null | undefined,
  minAge = MIN_ACCOUNT_AGE_YEARS,
  now = new Date(),
): boolean {
  if (!signal) {
    return false;
  }

  if (
    typeof signal.upperAgeBound === 'number' &&
    Number.isFinite(signal.upperAgeBound) &&
    signal.upperAgeBound < minAge
  ) {
    return true;
  }

  if (
    typeof signal.lowerAgeBound === 'number' &&
    Number.isFinite(signal.lowerAgeBound) &&
    signal.lowerAgeBound >= minAge
  ) {
    return false;
  }

  const birthday = signal.birthday;
  const year = birthday?.year;
  if (!year || year < 1800 || year > now.getUTCFullYear()) {
    return false;
  }

  const month = birthday.month && birthday.month >= 1 && birthday.month <= 12 ? birthday.month : 12;
  const day =
    birthday.day && birthday.day >= 1 && birthday.day <= 31 ? birthday.day : 31;
  return ageOnDate(year, month, day, now) < minAge;
}

export function assertMinimumAge(
  signal: ProviderAgeSignal | null | undefined,
  minAge = MIN_ACCOUNT_AGE_YEARS,
): void {
  if (isYoungerThanMinAge(signal, minAge)) {
    throw new AccountTooYoungError();
  }
}

export function ageOnDate(
  year: number,
  month: number,
  day: number,
  now = new Date(),
): number {
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth() + 1;
  const todayDay = now.getUTCDate();
  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) {
    age -= 1;
  }
  return age;
}

type GoogleBirthday = {
  metadata?: { primary?: boolean; source?: { type?: string } };
  date?: CalendarDate;
};

type GooglePerson = {
  birthdays?: GoogleBirthday[];
};

function pickGoogleBirthday(person: GooglePerson): CalendarDate | null {
  const birthdays = person.birthdays ?? [];
  const ranked = [...birthdays].sort((a, b) => {
    const aProfile = a.metadata?.source?.type === 'PROFILE' ? 0 : 1;
    const bProfile = b.metadata?.source?.type === 'PROFILE' ? 0 : 1;
    if (aProfile !== bProfile) return aProfile - bProfile;
    const aPrimary = a.metadata?.primary ? 0 : 1;
    const bPrimary = b.metadata?.primary ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    const aYear = a.date?.year ? 0 : 1;
    const bYear = b.date?.year ? 0 : 1;
    return aYear - bYear;
  });
  const date = ranked[0]?.date;
  if (!date?.year && !date?.month && !date?.day) {
    return null;
  }
  return date;
}

export function ageSignalFromGooglePerson(person: GooglePerson | null | undefined): ProviderAgeSignal {
  return { birthday: person ? pickGoogleBirthday(person) : null };
}

export function ageSignalFromAppleClaims(
  claims: Record<string, unknown> | null | undefined,
): ProviderAgeSignal {
  if (!claims) {
    return {};
  }

  const birthday = calendarDateFromUnknown(
    claims.birthdate ?? claims.birthday ?? claims.birth_date,
  );
  const range = ageRangeFromUnknown(claims.age_range ?? claims.ageRange ?? claims.declared_age_range);

  return {
    birthday,
    lowerAgeBound: range.lower,
    upperAgeBound: range.upper,
  };
}

export function ageSignalFromDeclaredAgeRange(range: {
  lowerBound?: number | null;
  upperBound?: number | null;
} | null | undefined): ProviderAgeSignal {
  if (!range) {
    return {};
  }
  return {
    lowerAgeBound: finiteNumber(range.lowerBound),
    upperAgeBound: finiteNumber(range.upperBound),
  };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function calendarDateFromUnknown(value: unknown): CalendarDate | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }
  if (typeof value === 'object') {
    const record = value as CalendarDate;
    return {
      year: finiteNumber(record.year) ?? undefined,
      month: finiteNumber(record.month) ?? undefined,
      day: finiteNumber(record.day) ?? undefined,
    };
  }
  return null;
}

function ageRangeFromUnknown(value: unknown): { lower: number | null; upper: number | null } {
  if (!value) {
    return { lower: null, upper: null };
  }
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (match) {
      return { lower: Number(match[1]), upper: Number(match[2]) };
    }
    const single = finiteNumber(value);
    return { lower: single, upper: single };
  }
  if (typeof value === 'number') {
    return { lower: value, upper: value };
  }
  if (typeof value === 'object') {
    const record = value as {
      lowerBound?: unknown;
      upperBound?: unknown;
      lower?: unknown;
      upper?: unknown;
      min?: unknown;
      max?: unknown;
    };
    return {
      lower: finiteNumber(record.lowerBound ?? record.lower ?? record.min),
      upper: finiteNumber(record.upperBound ?? record.upper ?? record.max),
    };
  }
  return { lower: null, upper: null };
}

export async function fetchGoogleAgeSignal(accessToken: string): Promise<ProviderAgeSignal> {
  const token = accessToken.trim();
  if (!token) {
    return {};
  }

  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=birthdays',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      console.warn('Google People birthday lookup failed', res.status);
      return {};
    }
    const person = (await res.json()) as GooglePerson;
    return ageSignalFromGooglePerson(person);
  } catch (e) {
    console.warn('Google People birthday lookup error', e);
    return {};
  }
}

export async function assertGoogleAccessTokenMeetsMinimumAge(accessToken: string): Promise<void> {
  const signal = await fetchGoogleAgeSignal(accessToken);
  assertMinimumAge(signal);
}
