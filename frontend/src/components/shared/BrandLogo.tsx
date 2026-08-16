/**
 * EpiCare — Unified Brand Logo Component
 * =======================================
 * Renders the official EpiCare emerald pulse icon + wordmark
 * across all public marketing, auth pages, and in-app workspaces.
 */
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import './BrandLogo.css';

export interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  variant?: 'default' | 'light';
  to?: string | null;
  className?: string;
  onClick?: () => void;
}

export function BrandLogo({
  size = 'md',
  showText = true,
  subtitle,
  variant = 'default',
  to,
  className = '',
  onClick,
}: BrandLogoProps) {
  const iconSizes = {
    xs: 14,
    sm: 17,
    md: 21,
    lg: 26,
    xl: 32,
  };

  const content = (
    <>
      <div className="brand-logo-icon-box" aria-hidden="true">
        <Activity size={iconSizes[size]} strokeWidth={2.6} />
      </div>

      {showText && (
        <div className="brand-logo-text-group">
          <span className="brand-logo-title">EpiCare</span>
          {subtitle && <span className="brand-logo-sub">{subtitle}</span>}
        </div>
      )}
    </>
  );

  const rootClass = `brand-logo-root brand-logo--${size} brand-logo--${variant} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={rootClass} onClick={onClick} aria-label="EpiCare Home">
        {content}
      </Link>
    );
  }

  return (
    <div className={rootClass} onClick={onClick}>
      {content}
    </div>
  );
}
