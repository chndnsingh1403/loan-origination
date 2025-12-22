import React from 'react';

interface EnrichmentData {
  source: string;
  confidence_score: number;
  enriched_at: string;
}

interface EnrichedFieldProps {
  label: string;
  value: string | number;
  enrichment?: EnrichmentData;
  type?: 'text' | 'number' | 'email' | 'tel';
  readOnly?: boolean;
  className?: string;
}

/**
 * EnrichedField Component
 * 
 * Displays form fields with verification badges when data has been enriched
 * by external integrations (Experian, Plaid, etc.)
 * 
 * Usage:
 * <EnrichedField 
 *   label="Credit Score" 
 *   value={applicant.credit_score}
 *   enrichment={enrichments.find(e => e.field_path === 'credit_score')}
 * />
 */
export const EnrichedField: React.FC<EnrichedFieldProps> = ({ 
  label, 
  value, 
  enrichment,
  type = 'text',
  readOnly = true,
  className = ''
}) => {
  const formatSource = (source: string) => {
    const sourceMap: Record<string, string> = {
      'experian': 'Experian',
      'plaid': 'Plaid',
      'socure': 'Socure',
      'textract': 'AWS Textract',
      'kbb': 'KBB',
      'system': 'System'
    };
    return sourceMap[source.toLowerCase()] || source;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 80) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={`relative mb-4 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {enrichment && (
          <span className="ml-2 text-xs text-gray-500">
            (Auto-verified)
          </span>
        )}
      </label>
      
      <div className="relative">
        <input
          type={type}
          value={value || ''}
          readOnly={readOnly}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            readOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
          } ${
            enrichment ? 'border-green-300 bg-green-50' : 'border-gray-300'
          }`}
        />
        
        {enrichment && (
          <div className="absolute right-2 top-2">
            <div 
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200"
              title={`Verified by ${formatSource(enrichment.source)} on ${new Date(enrichment.enriched_at).toLocaleString()}`}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Verified</span>
            </div>
          </div>
        )}
      </div>

      {enrichment && (
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-gray-600">
            Source: <span className="font-medium">{formatSource(enrichment.source)}</span>
          </span>
          
          <div className="flex items-center gap-3">
            {enrichment.confidence_score && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getConfidenceColor(enrichment.confidence_score)}`}>
                {enrichment.confidence_score}% confident
              </span>
            )}
            
            <span className="text-gray-500">
              {formatDate(enrichment.enriched_at)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrichedField;
