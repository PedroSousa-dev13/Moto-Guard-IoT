import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = '#667eea' 
}) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return '20px';
      case 'large':
        return '60px';
      default:
        return '40px';
    }
  };

  return (
    <div
      style={{
        display: 'inline-block',
        width: getSize(),
        height: getSize(),
        border: `${size === 'small' ? '2px' : '4px'} solid #e5e7eb`,
        borderTop: `${size === 'small' ? '2px' : '4px'} solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );
};

export default LoadingSpinner;
