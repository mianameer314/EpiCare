/**
 * LifestyleStory — Wide rounded image with dark gradient overlay,
 * skeuomorphic bevel border, and peaceful morning photography.
 */
import { Reveal } from './MarketingMotion';
import { RemoteImage, ImageCredit } from './RemoteMedia';
import { media } from '../media';

export function LifestyleStory() {
  return (
    <section className="mk-lifestyle-section" aria-labelledby="lifestyle-heading">
      <div className="mk-container">
        <Reveal>
          <div className="mk-lifestyle-frame mk-skeuo-card">
            <RemoteImage
              media={media.lifestyleStory}
              className="mk-lifestyle-image"
            />
            <div className="mk-lifestyle-overlay">
              <div className="mk-lifestyle-badge">
                <span>Holistic Epilepsy Wellbeing</span>
              </div>
              <h2 id="lifestyle-heading" className="mk-lifestyle-title">
                Your health is more than just one single data point.
              </h2>
              <p className="mk-lifestyle-body">
                Build a rich, personal care history around restorative sleep, consistent AED routines, stress management, and the everyday moments that matter to you and your family.
              </p>
            </div>
            <div className="mk-lifestyle-credit">
              <ImageCredit credit={media.lifestyleStory.credit} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
