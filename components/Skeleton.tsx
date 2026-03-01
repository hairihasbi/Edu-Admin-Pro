import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  variant = 'text', 
  width, 
  height 
}) => {
  const baseClasses = "animate-pulse bg-gray-200 rounded";
  
  let variantClasses = "";
  if (variant === 'circular') variantClasses = "rounded-full";
  if (variant === 'text') variantClasses = "rounded h-4 w-full";
  
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div 
      className={`${baseClasses} ${variantClasses} ${className}`} 
      style={style}
    />
  );
};

export default Skeleton;
