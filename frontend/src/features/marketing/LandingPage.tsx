/**
 * EpiCare Marketing — Landing Page Orchestrator
 * ===============================================
 * Composes all 13 sections into a single premium landing page.
 * Wrapped in MarketingMotionProvider for reduced-motion support.
 */
import { MarketingMotionProvider } from './components/MarketingMotion';
import { AnnouncementBar } from './components/AnnouncementBar';
import { MarketingNavbar } from './components/MarketingNavbar';
import { Hero } from './components/Hero';
import { TrustStrip } from './components/TrustStrip';
import { HowItWorks } from './components/HowItWorks';
import { ProductPreview } from './components/ProductPreview';
import { FeatureBento } from './components/FeatureBento';
import { SafetySection } from './components/SafetySection';
import { LifestyleStory } from './components/LifestyleStory';
import { FAQ } from './components/FAQ';
import { FinalCTA } from './components/FinalCTA';
import { MarketingFooter } from './components/MarketingFooter';

import './styles/marketing-tokens.css';
import './styles/marketing.css';

export function LandingPage() {
  return (
    <MarketingMotionProvider>
      <div className="marketing">
        <AnnouncementBar />
        <MarketingNavbar />
        <main>
          <Hero />
          <TrustStrip />
          <HowItWorks />
          <ProductPreview />
          <FeatureBento />
          <SafetySection />
          <LifestyleStory />
          <FAQ />
          <FinalCTA />
        </main>
        <MarketingFooter />
      </div>
    </MarketingMotionProvider>
  );
}
