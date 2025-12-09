'use client';

interface ConfidenceScoreProps {
  score: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ConfidenceScore({
  score,
  size = 'md',
  showLabel = true,
}: ConfidenceScoreProps) {
  const percentage = Math.round(score * 100);

  // Color based on confidence level
  const getColor = () => {
    if (percentage >= 80) return { bg: 'bg-green-500', text: 'text-green-400' };
    if (percentage >= 60) return { bg: 'bg-yellow-500', text: 'text-yellow-400' };
    return { bg: 'bg-red-500', text: 'text-red-400' };
  };

  const colors = getColor();

  const sizeClasses = {
    sm: { bar: 'h-1.5', text: 'text-xs', gap: 'gap-1.5' },
    md: { bar: 'h-2', text: 'text-sm', gap: 'gap-2' },
    lg: { bar: 'h-3', text: 'text-base', gap: 'gap-3' },
  };

  const sizes = sizeClasses[size];

  return (
    <div className={`flex items-center ${sizes.gap}`}>
      {showLabel && (
        <span className={`${sizes.text} text-gray-400 whitespace-nowrap`}>Confidence:</span>
      )}
      <div className={`flex-1 ${sizes.bar} bg-gray-700 rounded-full overflow-hidden min-w-[60px]`}>
        <div
          className={`h-full ${colors.bg} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`${sizes.text} ${colors.text} font-medium min-w-[40px] text-right`}>
        {percentage}%
      </span>
    </div>
  );
}

export default ConfidenceScore;
