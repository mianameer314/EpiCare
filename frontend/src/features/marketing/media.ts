/**
 * EpiCare Marketing — Centralized Remote Media Configuration
 * ===========================================================
 * All remote and local images are managed here.
 * Earthy, serene, natural-light medical wellness imagery.
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
 * Centralized media registry with verified, high-res local and remote imagery.
 */
export const media = {
  // Hero section — Looping cinematic video
  heroMedia: {
    src: '/first.mp4',
    alt: 'EpiCare Neurology AI brainwave telemetry and personalized healthcare',
    width: 1400,
    height: 1600,
    type: 'video' as const,
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

  // Module 01 — EEG Analysis & Clinical Review
  eegBento: {
    src: '/eeg-analysis.jpg',
    alt: 'Neurologist analyzing EEG brainwave telemetry waveforms on a digital tablet',
    width: 1200,
    height: 800,
    type: 'image' as const,
    credit: {
      photographer: 'EpiCare Clinical',
      sourceName: 'EpiCare Platform',
      sourceUrl: '#',
    },
  },

  // Module 02 — Structured Clinical Reports
  reportsBento: {
    src: '/clinical-reports.jpg',
    alt: 'Clean clinical EEG assessment report with graphs on a modern doctor desk',
    width: 1200,
    height: 800,
    type: 'image' as const,
    credit: {
      photographer: 'EpiCare Clinical',
      sourceName: 'EpiCare Platform',
      sourceUrl: '#',
    },
  },

  // Module 03 — AED Medication Safety & Routine
  medsBento: {
    src: '/aed-medication.jpg',
    alt: 'Aesthetic morning medication organizer with prescription bottle in soft sunlight',
    width: 1200,
    height: 800,
    type: 'image' as const,
    credit: {
      photographer: 'EpiCare Clinical',
      sourceName: 'EpiCare Platform',
      sourceUrl: '#',
    },
  },

  // Module 04 — Lifestyle & Trigger Journaling
  lifestyleBento: {
    src: '/lifestyle-journaling.jpg',
    alt: 'Writing in a wellness journal with warm morning light and herbal tea',
    width: 1200,
    height: 900,
    type: 'image' as const,
    credit: {
      photographer: 'EpiCare Wellness',
      sourceName: 'EpiCare Platform',
      sourceUrl: '#',
    },
  },

  // Module 05 — Sleep Quality & Rest Patterns
  sleepBento: {
    src: '/sleep-quality.jpg',
    alt: 'Peaceful bedroom with soft morning light promoting restorative sleep',
    width: 1200,
    height: 900,
    type: 'image' as const,
    credit: {
      photographer: 'EpiCare Rest',
      sourceName: 'EpiCare Platform',
      sourceUrl: '#',
    },
  },

  // Module 06 — Mindful Wellness & Calm Movement
  natureWalk: {
    src: '/nature-walk.jpg',
    alt: 'Sunlight filtering through trees on a peaceful morning wellness walk',
    width: 1200,
    height: 900,
    type: 'image' as const,
    credit: {
      photographer: 'EpiCare Wellness',
      sourceName: 'EpiCare Platform',
      sourceUrl: '#',
    },
  },
} as const;

/** CSS gradient fallback */
export const FALLBACK_GRADIENT =
  'linear-gradient(135deg, #e8f5ec 0%, #efece5 50%, #f7f5f0 100%)';
