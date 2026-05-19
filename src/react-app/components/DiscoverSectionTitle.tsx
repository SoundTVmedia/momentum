import type { LucideIcon } from 'lucide-react';

type DiscoverSectionTitleProps = {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle?: string;
};

export default function DiscoverSectionTitle({
  icon: Icon,
  iconClassName = 'text-cyan-400',
  title,
  subtitle,
}: DiscoverSectionTitleProps) {
  return (
    <div className="mb-4 md:mb-5">
      <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
        <Icon className={`w-6 h-6 shrink-0 ${iconClassName}`} aria-hidden />
        <span>{title}</span>
      </h2>
      {subtitle ? <p className="text-gray-400 text-sm mt-1">{subtitle}</p> : null}
    </div>
  );
}
