/**
 * EpiCare Marketing — Centralized Remote Media Configuration
 * ===========================================================
 * All remote image/video URLs are managed here.
 * Earthy, serene, natural-light medical wellness imagery.
 * Never scatter remote URLs across JSX files.
 *
 * // Replace with approved licensed media before production
 */

export type MediaCredit = {
  photographer?: string;
  profileUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
};

export type RemoteMediaItem = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  poster?: string;
  type?: 'image' | 'video';
  credit?: MediaCredit;
};

/**
 * Centralized media registry with high-res, verified, stable Unsplash imagery.
 */
export const media = {
  // Hero section — calm person in natural morning light reviewing health information
  heroPortrait: {
    src: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1400&h=1600&fit=crop&q=85',
    alt: 'A person calmly reviewing health information on a laptop in a sunlit room',
    width: 1400,
    height: 1600,
    type: 'image' as const,
    credit: {
      photographer: 'Christina @ wocintechchat.com',
      sourceName: 'Unsplash',
      sourceUrl: 'https://unsplash.com',
    },
  },

  // Lifestyle story section — peaceful morning wellness routine in warm sunlight
  lifestyleStory: {
    src: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1600&h=900&fit=crop&q=85',
    alt: 'A peaceful morning wellness and mindfulness routine with warm natural sunlight',
    width: 1600,
    height: 900,
    type: 'image' as const,
    credit: {
      photographer: 'Jared Rice',
      sourceName: 'Unsplash',
      sourceUrl: 'https://unsplash.com',
    },
  },

  // Feature bento — journaling daily triggers & lifestyle context
  lifestyleBento: {
    src: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=800&h=600&fit=crop&q=85',
    alt: 'Writing in a wellness journal with warm morning light',
    width: 800,
    height: 600,
    type: 'image' as const,
    credit: {
      photographer: 'Cathryn Lavery',
      sourceName: 'Unsplash',
      sourceUrl: 'https://unsplash.com',
    },
  },

  // Feature bento — peaceful sleep & restorative rest
  sleepBento: {
    src: 'https://images.unsplash.com/photo-1511295742362-92c96b124e52?w=800&h=600&fit=crop&q=85',
    alt: 'Peaceful bedroom with soft morning light promoting restorative sleep',
    width: 800,
    height: 600,
    type: 'image' as const,
    credit: {
      photographer: 'Lauren Mancke',
      sourceName: 'Unsplash',
      sourceUrl: 'https://unsplash.com',
    },
  },

  // Feature bento — mindful wellness walking in nature
  natureWalk: {
    src: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=600&fit=crop&q=85',
    alt: 'Sunlight filtering through trees on a peaceful morning walk',
    width: 800,
    height: 600,
    type: 'image' as const,
    credit: {
      photographer: 'Sebastian Unrau',
      sourceName: 'Unsplash',
      sourceUrl: 'https://unsplash.com',
    },
  },

  // EEG Analysis Preview — clean tablet review
  eegReview: {
    src: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&h=800&fit=crop&q=85',
    alt: 'Modern clinical telemetry review on a digital surface',
    width: 1200,
    height: 800,
    type: 'image' as const,
    credit: {
      photographer: 'National Cancer Institute',
      sourceName: 'Unsplash',
      sourceUrl: 'https://unsplash.com',
    },
  },
} as const;

/** CSS gradient fallback when remote images fail */
export const FALLBACK_GRADIENT =
  'linear-gradient(135deg, #e8f5ec 0%, #efece5 50%, #f7f5f0 100%)';

/** Abstract waveform SVG for visual fallback */
export const FALLBACK_WAVE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 200" fill="none">
  <path d="M0 100 Q150 30 300 100 T600 100 T900 100 T1200 100"
        stroke="rgba(45,90,63,0.15)" stroke-width="2" fill="none"/>
  <path d="M0 120 Q150 60 300 120 T600 120 T900 120 T1200 120"
        stroke="rgba(15,159,152,0.1)" stroke-width="1.5" fill="none"/>
</svg>`;
