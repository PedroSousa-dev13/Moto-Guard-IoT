import React, { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
}

const Card: React.FC<CardProps> = ({ 
  title, 
  subtitle, 
  children, 
  className = '', 
  headerActions,
  footer 
}) => {
  return (
    <div className={`ui-card ${className}`}>
      {(title || subtitle || headerActions) && (
        <div className="ui-card-header">
          <div className="ui-card-title-group">
            {title && <h3 className="ui-card-title">{title}</h3>}
            {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
          </div>
          {headerActions && <div className="ui-card-actions">{headerActions}</div>}
        </div>
      )}
      <div className="ui-card-body">
        {children}
      </div>
      {footer && <div className="ui-card-footer">{footer}</div>}
    </div>
  );
};

export default Card;
