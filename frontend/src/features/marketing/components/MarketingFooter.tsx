/**
 * MarketingFooter — Product links, safety, copyright
 */
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../../components/shared/BrandLogo';

const PRODUCT_LINKS = [
  { label: 'EEG Analysis', href: '/eeg' },
  { label: 'Medications', href: '/medications' },
  { label: 'Lifestyle Logs', href: '/lifestyle' },
  { label: 'AI Assistant', href: '/chat' },
  { label: 'Emergency', href: '/emergency' },
] as const;

const COMPANY_LINKS = [
  { label: 'Safety & Limitations', href: '#safety' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Contact', href: '#' },
] as const;

export function MarketingFooter() {
  return (
    <footer className="mk-footer" role="contentinfo">
      <div className="mk-container">
        <div className="mk-footer-grid">
          {/* Brand column */}
          <div className="mk-footer-brand">
            <BrandLogo size="sm" to="/" subtitle="Neurology AI" />
            <p className="mk-footer-desc">
              AI-assisted epilepsy management. Designed to support your understanding
              of health information—not to replace professional medical care.
            </p>
          </div>

          {/* Product links */}
          <div className="mk-footer-col">
            <h3 className="mk-footer-col-title">Product</h3>
            <ul className="mk-footer-links">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div className="mk-footer-col">
            <h3 className="mk-footer-col-title">Resources</h3>
            <ul className="mk-footer-links">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith('#') ? (
                    <a href={link.href}>{link.label}</a>
                  ) : (
                    <Link to={link.href}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mk-footer-bottom">
          <p className="mk-footer-copyright">
            &copy; {new Date().getFullYear()} EpiCare. All rights reserved.
          </p>
          <p className="mk-footer-disclosure">
            This is a project demonstration. Not a certified medical device.
          </p>
        </div>
      </div>
    </footer>
  );
}
