/**
 * MarketingNavbar — Sticky navigation with scroll-aware background,
 * desktop links, CTAs, and accessible mobile drawer.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { BrandLogo } from '../../../components/shared/BrandLogo';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Safety', href: '#safety' },
  { label: 'FAQ', href: '#faq' },
] as const;

export function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Focus trap + Escape close
  useEffect(() => {
    if (!mobileOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        triggerRef.current?.focus();
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const firstLink = drawerRef.current?.querySelector<HTMLElement>('a[href]');
      firstLink?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleSmoothScroll = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setMobileOpen(false);
      const id = href.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    []
  );

  return (
    <>
      <header
        className={`mk-navbar ${scrolled ? 'mk-navbar--scrolled' : ''}`}
        role="banner"
      >
        <div className="mk-container mk-navbar-inner">
          {/* Logo */}
          <BrandLogo size="md" to="/" subtitle="Neurology AI" />

          {/* Desktop Nav */}
          <nav className="mk-nav-desktop" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="mk-nav-link"
                onClick={(e) => handleSmoothScroll(e, link.href)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="mk-nav-actions">
            <Link to="/auth" className="mk-nav-link mk-nav-signin">
              Sign in
            </Link>
            <Link to="/auth" className="mk-btn mk-btn-primary mk-btn-sm mk-btn-skeuo">
              <span>Get started</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            ref={triggerRef}
            className="mk-hamburger"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
            aria-controls="mk-mobile-menu"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="mk-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <div
        ref={drawerRef}
        id="mk-mobile-menu"
        className={`mk-mobile-drawer ${mobileOpen ? 'mk-mobile-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div className="mk-mobile-drawer-header">
          <BrandLogo size="sm" to="/" subtitle="Neurology AI" onClick={() => setMobileOpen(false)} />
          <button
            className="mk-mobile-close"
            onClick={() => {
              setMobileOpen(false);
              triggerRef.current?.focus();
            }}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="mk-mobile-nav" aria-label="Mobile navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="mk-mobile-nav-link"
              onClick={(e) => handleSmoothScroll(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="mk-mobile-actions">
          <Link
            to="/auth"
            className="mk-btn mk-btn-outline mk-btn-full"
            onClick={() => setMobileOpen(false)}
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="mk-btn mk-btn-primary mk-btn-full mk-btn-skeuo"
            onClick={() => setMobileOpen(false)}
          >
            <span>Get started</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}
