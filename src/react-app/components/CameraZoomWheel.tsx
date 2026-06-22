import { useCallback, useId, useRef, useState } from 'react';
import {
  CAPTURE_ZOOM_WHEEL_MAX,
  CAPTURE_ZOOM_WHEEL_MIN,
  captureWheelAngleToZoom,
  captureWheelZoomToAngle,
  clampCaptureWheelZoom,
  formatCaptureWheelZoom,
} from '@/react-app/utils/cameraZoom';

type CameraZoomWheelProps = {
  value: number;
  disabled?: boolean;
  onChange: (zoom: number) => void;
  className?: string;
};

const CX = 100;
const CY = 92;
const R = 72;
const SIZE = { w: 200, h: 108 };

function polarOnArc(angle: number): { x: number; y: number } {
  return {
    x: CX + R * Math.cos(angle),
    y: CY - R * Math.sin(angle),
  };
}

function describeArc(startAngle: number, endAngle: number): string {
  const start = polarOnArc(startAngle);
  const end = polarOnArc(endAngle);
  const sweep = startAngle - endAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function pointerAngle(clientX: number, clientY: number, rect: DOMRect): number | null {
  const x = clientX - rect.left - (rect.width * CX) / SIZE.w;
  const y = clientY - rect.top - (rect.height * CY) / SIZE.h;
  const angle = Math.atan2(CY - y, x - CX);
  if (angle < 0 || angle > Math.PI) return null;
  return angle;
}

export default function CameraZoomWheel({
  value,
  disabled = false,
  onChange,
  className = '',
}: CameraZoomWheelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const gradId = useId().replace(/:/g, '');

  const wheelZoom = clampCaptureWheelZoom(value);
  const thumbAngle = captureWheelZoomToAngle(wheelZoom);
  const thumb = polarOnArc(thumbAngle);
  const activeEnd = thumbAngle;

  const emitFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      const angle = pointerAngle(clientX, clientY, rect);
      if (angle == null) return;
      onChange(captureWheelAngleToZoom(angle));
    },
    [disabled, onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    emitFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || disabled) return;
    emitFromPointer(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    draggingRef.current = false;
    setDragging(false);
  };

  const tickStops = [CAPTURE_ZOOM_WHEEL_MIN, 1, 2, CAPTURE_ZOOM_WHEEL_MAX];

  return (
    <div
      ref={rootRef}
      className={[
        'pointer-events-auto select-none touch-none',
        disabled ? 'opacity-40' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="slider"
      aria-label="Camera zoom"
      aria-valuemin={CAPTURE_ZOOM_WHEEL_MIN}
      aria-valuemax={CAPTURE_ZOOM_WHEEL_MAX}
      aria-valuenow={wheelZoom}
      aria-valuetext={formatCaptureWheelZoom(wheelZoom)}
      aria-disabled={disabled}
    >
      <div className="relative mx-auto" style={{ width: SIZE.w, height: SIZE.h }}>
        <p
          className={`absolute left-1/2 top-0 -translate-x-1/2 font-semibold tabular-nums text-white transition-transform ${
            dragging ? 'scale-110 text-momentum-ember' : 'text-sm'
          }`}
        >
          {formatCaptureWheelZoom(wheelZoom)}
        </p>

        <svg
          viewBox={`0 0 ${SIZE.w} ${SIZE.h}`}
          className="h-full w-full overflow-visible"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--momentum-ember, #00e8ff)" />
              <stop offset="55%" stopColor="var(--momentum-flare, #00d4aa)" />
              <stop offset="100%" stopColor="var(--momentum-rose, #059669)" />
            </linearGradient>
          </defs>

          <path
            d={describeArc(Math.PI, 0)}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {activeEnd < Math.PI - 0.02 ? (
            <path
              d={describeArc(Math.PI, activeEnd)}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="6"
              strokeLinecap="round"
            />
          ) : null}

          {tickStops.map((stop) => {
            const a = captureWheelZoomToAngle(stop);
            const outer = polarOnArc(a);
            const inner = {
              x: CX + (R - 10) * Math.cos(a),
              y: CY - (R - 10) * Math.sin(a),
            };
            const label = polarOnArc(a);
            const isEdge = stop === CAPTURE_ZOOM_WHEEL_MIN || stop === CAPTURE_ZOOM_WHEEL_MAX;
            return (
              <g key={stop}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {isEdge ? (
                  <text
                    x={label.x}
                    y={label.y + (stop === CAPTURE_ZOOM_WHEEL_MIN ? 14 : 14)}
                    textAnchor="middle"
                    className="fill-white/55 text-[9px] font-medium"
                  >
                    {stop === CAPTURE_ZOOM_WHEEL_MIN ? '.5' : '2.5'}
                  </text>
                ) : null}
              </g>
            );
          })}

          <circle
            cx={thumb.x}
            cy={thumb.y}
            r={dragging ? 11 : 9}
            fill="white"
            stroke="var(--momentum-flare, #00d4aa)"
            strokeWidth="2.5"
            className="drop-shadow-[0_0_10px_rgba(0,212,170,0.55)]"
          />
        </svg>
      </div>
    </div>
  );
}
