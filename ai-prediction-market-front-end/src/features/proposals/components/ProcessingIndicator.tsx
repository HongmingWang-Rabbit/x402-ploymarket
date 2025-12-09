'use client';

const STEPS = [
  { label: 'Analyzing proposal', description: 'Understanding your prediction' },
  { label: 'Generating market', description: 'Creating resolution rules' },
  { label: 'Validating', description: 'Checking for clarity and fairness' },
];

interface ProcessingIndicatorProps {
  currentStep?: number;
}

export function ProcessingIndicator({ currentStep = 0 }: ProcessingIndicatorProps) {
  return (
    <div className="mt-6 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-white">Processing Your Proposal</h3>
      </div>

      <p className="text-gray-400 text-sm mb-6">
        Our AI is reviewing your proposal and creating a deterministic prediction market.
        This usually takes 10-30 seconds.
      </p>

      <div className="space-y-4">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={index} className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  isCompleted
                    ? 'bg-green-500'
                    : isCurrent
                    ? 'bg-blue-500'
                    : 'bg-gray-700'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                ) : (
                  <span className="text-xs text-gray-400">{index + 1}</span>
                )}
              </div>
              <div>
                <p
                  className={`font-medium ${
                    isCompleted || isCurrent ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
