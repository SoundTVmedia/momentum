import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export default function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      <div className="max-w-md mx-auto bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-lg border border-purple-500/20 rounded-xl p-8 space-y-4 animate-fade-in">
        {/* Icon or Emoji */}
        <div className="mb-4">
          {emoji ? (
            <div className="text-6xl">{emoji}</div>
          ) : Icon ? (
            <div className="w-20 h-20 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center">
              <Icon className="w-10 h-10 text-purple-400" />
            </div>
          ) : null}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-white mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-gray-300">
          {description}
        </p>

        {/* Action Button */}
        {action && (
          <button
            onClick={action.onClick}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform"
          >
            {action.label}
          </button>
        )}

        {/* Custom Children */}
        {children}
      </div>
    </div>
  );
}
