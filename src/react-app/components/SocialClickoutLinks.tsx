import { socialLinkEntries } from '@/react-app/lib/social-link-icon';

type SocialClickoutLinksProps = {
  links: Record<string, string>;
  hoverClassName?: string;
};

export default function SocialClickoutLinks({
  links,
  hoverClassName = 'hover:text-momentum-rose',
}: SocialClickoutLinksProps) {
  const entries = socialLinkEntries(links);
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
      {entries.map(({ key, url, icon: Icon, label }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`text-gray-400 ${hoverClassName} transition-colors`}
        >
          <Icon className="w-5 h-5" />
        </a>
      ))}
    </div>
  );
}
