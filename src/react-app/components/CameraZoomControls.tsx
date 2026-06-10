import type { CSSProperties } from 'react';
import { formatCameraZoomLabel } from '@/react-app/utils/cameraZoom';

type CameraZoomControlsProps = {
  presets: number[];
  value: number;
  disabled?: boolean;
  onSelect: (zoom: number) => void;
  className?: string;
  style?: CSSProperties;
};

export default function CameraZoomControls({
  presets,
  value,
  disabled = false,
  onSelect,
  className = '',
  style,
}: CameraZoomControlsProps) {
  if (presets.length < 2) return null;

  return (
    <div
      className={[
        'pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/10 bg-black/45 px-1.5 py-1 shadow-lg backdrop-blur-md',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      role="toolbar"
      aria-label="Camera zoom"
    >
      {presets.map((preset) => {
        const active = Math.abs(preset - value) < 0.08;
        return (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(preset)}
            aria-pressed={active}
            aria-label={`${preset} times zoom`}
            className={[
              'rounded-full font-semibold transition-all duration-200 disabled:opacity-40',
              active
                ? 'scale-110 bg-white/20 px-2.5 py-1 text-sm text-amber-300'
                : 'px-2 py-1 text-xs text-white/85 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            {formatCameraZoomLabel(preset, active)}
          </button>
        );
      })}
    </div>
  );
}
