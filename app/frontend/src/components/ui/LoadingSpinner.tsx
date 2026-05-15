interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = 'var(--accent)' 
}) => {
  const sizeClasses = {
    small: 'w-5 h-5 border-2',
    medium: 'w-10 h-10 border-4',
    large: 'w-16 h-16 border-4'
  };

  return (
    <div
      className={`inline-block ${sizeClasses[size]} border-white/10 rounded-full animate-spin`}
      style={{ borderTopColor: color }}
    />
  );
};

export default LoadingSpinner;
