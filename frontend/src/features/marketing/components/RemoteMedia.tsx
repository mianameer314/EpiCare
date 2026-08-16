/**
 * EpiCare Marketing — Remote Media Components
 * =============================================
 * Reusable image/video components with lazy loading,
 * aspect-ratio containers, graceful fallbacks, and
 * optional attribution rendering.
 */
import { useState, type CSSProperties } from 'react';
import type { RemoteMediaItem, MediaCredit } from '../media';
import { FALLBACK_GRADIENT } from '../media';

/* ── Gradient + SVG Fallback ── */
export function MediaFallback({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`mk-media-fallback ${className || ''}`}
      style={{
        background: FALLBACK_GRADIENT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      aria-hidden="true"
    >
      {/* Decorative abstract waveform */}
      <svg
        viewBox="0 0 600 120"
        fill="none"
        style={{ width: '60%', maxWidth: 400, opacity: 0.3 }}
      >
        <path
          d="M0 60 Q75 20 150 60 T300 60 T450 60 T600 60"
          stroke="var(--mk-primary, #4F46E5)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M0 75 Q75 45 150 75 T300 75 T450 75 T600 75"
          stroke="var(--mk-teal, #0F9F98)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {children}
    </div>
  );
}

/* ── Remote Image ── */
export function RemoteImage({
  media: m,
  className,
  style,
  priority = false,
  sizes,
}: {
  media: RemoteMediaItem;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <MediaFallback
        className={className}
        style={{
          width: '100%',
          aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : '16 / 9',
          borderRadius: 'inherit',
          ...style,
        }}
      />
    );
  }

  return (
    <img
      src={m.src}
      alt={m.alt}
      width={m.width}
      height={m.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      sizes={sizes}
      className={className}
      style={{
        objectFit: 'cover',
        width: '100%',
        height: '100%',
        ...style,
      }}
      onError={() => setFailed(true)}
    />
  );
}

/* ── Image Credit Attribution ── */
export function ImageCredit({ credit }: { credit?: MediaCredit }) {
  if (!credit?.sourceName) return null;

  return (
    <span className="mk-image-credit">
      {credit.photographer && (
        <>
          Photo by{' '}
          {credit.profileUrl ? (
            <a href={credit.profileUrl} target="_blank" rel="noopener noreferrer">
              {credit.photographer}
            </a>
          ) : (
            credit.photographer
          )}
          {' on '}
        </>
      )}
      {credit.sourceUrl ? (
        <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
          {credit.sourceName}
        </a>
      ) : (
        credit.sourceName
      )}
    </span>
  );
}
