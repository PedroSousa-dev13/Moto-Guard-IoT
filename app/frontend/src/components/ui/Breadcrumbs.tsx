import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav className={`flex items-center gap-1.5 text-[0.6rem] font-bold text-muted uppercase tracking-widest ${className}`}>
      <Link to="/" className="flex items-center gap-1 hover:text-text transition-colors no-underline text-muted">
        <Home size={12} />
      </Link>
      {items.map((crumb, i) => (
        <span key={crumb.label} className="flex items-center gap-1.5">
          <ChevronRight size={10} className="opacity-40" />
          {crumb.href ? (
            <Link to={crumb.href} className="hover:text-text transition-colors no-underline text-muted">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-text font-black">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
