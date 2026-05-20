import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type SectionHeadingSize = 'section' | 'page' | 'hero';

export type SectionHeadingProps = {
  title: ReactNode;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  align?: 'left' | 'center';
  badge?: ReactNode;
  size?: SectionHeadingSize;
  className?: string;
};

const titleClassBySize: Record<SectionHeadingSize, string> = {
  section: 'fb-section-title',
  page: 'fb-page-section-title',
  hero: 'fb-hero-title',
};

export default function SectionHeading({
  title,
  subtitle,
  icon: Icon,
  iconClassName = 'text-momentum-mint',
  align = 'left',
  badge,
  size = 'section',
  className = '',
}: SectionHeadingProps) {
  const centered = align === 'center';

  return (
    <div
      className={`mb-4 md:mb-5 ${centered ? 'text-center' : ''} ${className}`.trim()}
    >
      <div
        className={`flex flex-wrap items-center gap-2 min-w-0 ${
          centered ? 'justify-center' : ''
        }`}
      >
        {Icon ? (
          <Icon className={`h-6 w-6 shrink-0 ${iconClassName}`} aria-hidden />
        ) : null}
        <h2 className={`${titleClassBySize[size]} ${centered ? 'w-full' : ''}`}>{title}</h2>
        {badge}
      </div>
      {subtitle ? (
        <p
          className={
            centered
              ? 'fb-section-subtitle fb-section-subtitle--center mt-2'
              : 'fb-section-subtitle mt-1'
          }
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
