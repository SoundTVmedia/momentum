import { ShoppingBag } from 'lucide-react';

type ClipModalBuyMerchProps = {
  websiteUrl: string | null;
  loading: boolean;
  className?: string;
};

export default function ClipModalBuyMerch({
  websiteUrl,
  loading,
  className = '',
}: ClipModalBuyMerchProps) {
  if (loading || !websiteUrl) {
    return null;
  }

  const hintClass =
    'flex w-full items-center justify-start gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:scale-[0.98] tap-feedback';

  return (
    <a
      href={websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${hintClass} ${className}`}
      aria-label="Buy merch on the artist website"
    >
      <ShoppingBag className="h-4 w-4 shrink-0 text-momentum-ember" aria-hidden />
      <span className="min-w-0 flex-1 text-left">
        <span className="md:hidden">Tap to Buy Merch</span>
        <span className="hidden md:inline">Click to Buy Merch</span>
      </span>
      <span className="h-4 w-4 shrink-0 md:hidden" aria-hidden />
    </a>
  );
}
