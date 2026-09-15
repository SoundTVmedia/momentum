import { Star } from 'lucide-react';
import { useState } from 'react';

interface StarRatingProps {
  rating: number | null;
  averageRating?: number;
  ratingCount?: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function StarRating({
  rating,
  averageRating,
  ratingCount,
  onRate,
  readonly = false,
  size = 'md',
  className = '',
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const interactive = Boolean(onRate) && !readonly;
  const displayRating =
    hoverRating || rating || (averageRating && averageRating > 0 ? Math.round(averageRating) : 0);

  return (
    <div className={`flex flex-col space-y-1 ${className}`.trim()}>
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onRate?.(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(null)}
            disabled={!interactive}
            aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
            className={`transition-all ${
              interactive
                ? 'cursor-pointer hover:scale-110'
                : 'cursor-default'
            }`}
          >
            <Star
              className={`${sizeClasses[size]} transition-colors ${
                star <= displayRating
                  ? 'fill-momentum-ember text-momentum-ember'
                  : 'text-gray-500'
              }`}
            />
          </button>
        ))}
      </div>
      
      {averageRating !== undefined && ratingCount !== undefined && (
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <span className="font-medium text-momentum-ember">
            {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings'}
          </span>
          {ratingCount > 0 && (
            <span>({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})</span>
          )}
        </div>
      )}
    </div>
  );
}
