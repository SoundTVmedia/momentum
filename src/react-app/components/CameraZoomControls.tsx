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

  const activeIndex = presets.findIndex((p) => Math.abs(p - value) < 0.08);
  const resolvedActive = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div
      className={[
        'pointer-events-auto relative flex items-center gap-0.5 rounded-full border border-white/10 bg-black/45 px-1.5 py-1 shadow-lg backdrop-blur-md',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      role="toolbar"
      aria-label="Camera zoom"
    >
      {presets.length > 1 ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-white/20 transition-all duration-300 ease-out"
          style={{
            width: `calc((100% - 0.75rem) / ${presets.length})`,
            left: `calc(0.375rem + ${resolvedActive} * ((100% - 0.75rem) / ${presets.length}))`,
          }}
        />
      ) : null}

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
              'relative z-[1] min-w-[2.25rem] flex-1 rounded-full px-2 py-1 text-center font-semibold transition-all duration-300 ease-out disabled:opacity-40',
              active
                ? 'scale-105 text-sm text-momentum-ember'
                : 'text-xs text-white/85 hover:text-white',
            ].join(' ')}
          >
            {formatCameraZoomLabel(preset, active)}
          </button>
        );
      })}
    </div>
  );
}
