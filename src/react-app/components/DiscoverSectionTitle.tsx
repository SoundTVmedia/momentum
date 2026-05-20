import type { LucideIcon } from 'lucide-react';
import SectionHeading from '@/react-app/components/SectionHeading';

type DiscoverSectionTitleProps = {
  icon?: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle?: string;
};

export default function DiscoverSectionTitle({
  icon,
  iconClassName = 'text-momentum-mint',
  title,
  subtitle,
}: DiscoverSectionTitleProps) {
  return (
    <SectionHeading
      title={title}
      subtitle={subtitle}
      icon={icon}
      iconClassName={iconClassName}
    />
  );
}
