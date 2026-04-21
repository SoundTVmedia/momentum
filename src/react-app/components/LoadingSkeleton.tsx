/**
 * Reusable loading skeleton components for better perceived performance
 */

export function ClipCardSkeleton() {
  return (
    <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-3 sm:p-4 md:p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-3 w-16 bg-white/10 rounded" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="h-4 w-20 bg-white/10 rounded ml-auto" />
          <div className="h-3 w-16 bg-white/10 rounded ml-auto" />
        </div>
      </div>

      {/* Thumbnail */}
      <div className="mb-3 sm:mb-4 rounded-lg overflow-hidden">
        <div className="w-full h-40 sm:h-48 bg-gradient-to-br from-slate-800 to-slate-900" />
      </div>

      {/* Description */}
      <div className="space-y-2 mb-3 sm:mb-4">
        <div className="h-3 w-full bg-white/10 rounded" />
        <div className="h-3 w-3/4 bg-white/10 rounded" />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 sm:space-x-4 md:space-x-6">
          <div className="h-8 w-16 bg-white/10 rounded" />
          <div className="h-8 w-16 bg-white/10 rounded" />
          <div className="h-8 w-16 bg-white/10 rounded hidden md:block" />
        </div>
        <div className="h-8 w-24 bg-white/10 rounded hidden md:block" />
      </div>
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-col md:flex-row items-center md:items-end space-y-3 sm:space-y-4 md:space-y-0 md:space-x-6 pt-6 sm:pt-8">
        <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full bg-white/10" />
        
        <div className="flex-1 text-center md:text-left pb-2 space-y-4">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-white/10 rounded mx-auto md:mx-0" />
            <div className="h-4 w-32 bg-white/10 rounded mx-auto md:mx-0" />
          </div>
          <div className="h-4 w-full max-w-md bg-white/10 rounded" />
        </div>
      </div>
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="flex space-x-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <div className="h-3 w-24 bg-white/10 rounded mb-2" />
          <div className="h-3 w-full bg-white/10 rounded" />
          <div className="h-3 w-3/4 bg-white/10 rounded mt-1" />
        </div>
      </div>
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="p-3 sm:p-4 border-b border-white/5 animate-pulse">
      <div className="flex items-start space-x-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-white/10 rounded-full" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-white/10 rounded" />
          <div className="h-3 w-1/4 bg-white/10 rounded" />
        </div>
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden animate-pulse">
          <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-3/4 bg-white/10 rounded" />
            <div className="h-3 w-1/2 bg-white/10 rounded" />
            <div className="flex items-center justify-between text-sm">
              <div className="h-3 w-16 bg-white/10 rounded" />
              <div className="h-3 w-16 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
