import { ReactNode } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export default function PageHeader({ title, subtitle, icon, actions, badge, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[0.6rem] font-bold text-muted uppercase tracking-widest">
          <Link to="/" className="flex items-center gap-1 hover:text-text transition-colors no-underline text-muted">
            <Home size={12} />
          </Link>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              <ChevronRight size={10} className="opacity-40" />
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-text transition-colors no-underline text-muted">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {icon && (
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent border border-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)] shrink-0">
              {icon}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black text-text tracking-tight m-0">{title}</h1>
              {badge && <div className="hidden sm:block">{badge}</div>}
            </div>
            {subtitle && (
              <p className="text-sm font-medium text-muted m-0">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
