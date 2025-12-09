'use client';

interface AllowedSource {
  name: string;
  url?: string;
  method?: string;
  condition?: string;
}

interface RulesDisplayProps {
  mustMeetAll?: string[];
  mustNotCount?: string[];
  allowedSources?: AllowedSource[];
  compact?: boolean;
}

export function RulesDisplay({
  mustMeetAll = [],
  mustNotCount = [],
  allowedSources = [],
  compact = false,
}: RulesDisplayProps) {
  if (mustMeetAll.length === 0 && mustNotCount.length === 0 && allowedSources.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-${compact ? '2' : '4'}`}>
      {/* Must Meet All */}
      {mustMeetAll.length > 0 && (
        <div className={`p-${compact ? '2' : '3'} bg-green-900/20 border border-green-800 rounded`}>
          <h4 className={`text-${compact ? 'xs' : 'sm'} font-medium text-green-400 mb-2 flex items-center gap-2`}>
            <svg className={`w-${compact ? '3' : '4'} h-${compact ? '3' : '4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Must Meet All
          </h4>
          <ul className="space-y-1">
            {mustMeetAll.map((rule, i) => (
              <li key={i} className={`text-${compact ? 'xs' : 'sm'} text-gray-300 flex items-start gap-2`}>
                <span className="text-green-400 mt-0.5">+</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Must Not Count */}
      {mustNotCount.length > 0 && (
        <div className={`p-${compact ? '2' : '3'} bg-red-900/20 border border-red-800 rounded`}>
          <h4 className={`text-${compact ? 'xs' : 'sm'} font-medium text-red-400 mb-2 flex items-center gap-2`}>
            <svg className={`w-${compact ? '3' : '4'} h-${compact ? '3' : '4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Does Not Count
          </h4>
          <ul className="space-y-1">
            {mustNotCount.map((rule, i) => (
              <li key={i} className={`text-${compact ? 'xs' : 'sm'} text-gray-300 flex items-start gap-2`}>
                <span className="text-red-400 mt-0.5">-</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verification Sources */}
      {allowedSources.length > 0 && (
        <div className={`p-${compact ? '2' : '3'} bg-blue-900/20 border border-blue-800 rounded`}>
          <h4 className={`text-${compact ? 'xs' : 'sm'} font-medium text-blue-400 mb-2 flex items-center gap-2`}>
            <svg className={`w-${compact ? '3' : '4'} h-${compact ? '3' : '4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Verification Sources
          </h4>
          <ul className="space-y-1">
            {allowedSources.map((source, i) => (
              <li key={i} className={`text-${compact ? 'xs' : 'sm'} text-gray-300`}>
                <span className="font-medium">{source.name}</span>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400 hover:text-blue-300 text-xs underline"
                  >
                    {new URL(source.url).hostname}
                  </a>
                )}
                {source.method && (
                  <span className="ml-2 text-gray-500 text-xs">({source.method})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default RulesDisplay;
