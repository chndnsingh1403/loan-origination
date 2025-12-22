import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';

interface Enrichment {
  id: string;
  source: string;
  field_path: string;
  old_value: any;
  new_value: any;
  confidence_score: number;
  enriched_at: string;
  enriched_by: string;
}

interface EnrichmentHistoryProps {
  applicationId: string;
}

/**
 * EnrichmentHistory Component
 * 
 * Displays complete enrichment history for an application, showing all
 * data changes made by integration workflows (credit checks, income verification, etc.)
 * 
 * Helps underwriters understand:
 * - Which fields were auto-populated
 * - Data source and confidence levels
 * - Change history (old → new values)
 * - Data provenance for compliance
 * 
 * Usage:
 * <EnrichmentHistory applicationId={application.id} />
 */
export const EnrichmentHistory: React.FC<EnrichmentHistoryProps> = ({ applicationId }) => {
  const [enrichments, setEnrichments] = useState<Enrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchEnrichments();
  }, [applicationId]);

  const fetchEnrichments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authenticatedFetch(`/api/applications/${applicationId}/enrichments`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch enrichments');
      }

      const data = await response.json();
      setEnrichments(data);
    } catch (err: any) {
      console.error('Error fetching enrichments:', err);
      setError(err.message || 'Failed to load enrichment history');
    } finally {
      setLoading(false);
    }
  };

  const formatSource = (source: string) => {
    const sourceMap: Record<string, { name: string; icon: string; color: string }> = {
      'experian': { name: 'Experian', icon: '📊', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      'plaid': { name: 'Plaid', icon: '🏦', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      'socure': { name: 'Socure', icon: '🆔', color: 'bg-green-100 text-green-800 border-green-200' },
      'textract': { name: 'AWS Textract', icon: '📄', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      'kbb': { name: 'KBB', icon: '🚗', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
      'system': { name: 'System', icon: '⚙️', color: 'bg-gray-100 text-gray-800 border-gray-200' }
    };
    
    return sourceMap[source.toLowerCase()] || { name: source, icon: '🔄', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const formatFieldPath = (path: string) => {
    return path
      .split('.')
      .map(part => part.replace(/_/g, ' '))
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' → ');
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'text-green-600 bg-green-50';
    if (confidence >= 80) return 'text-blue-600 bg-blue-50';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  const sources = Array.from(new Set(enrichments.map(e => e.source)));
  const filteredEnrichments = filter === 'all' 
    ? enrichments 
    : enrichments.filter(e => e.source === filter);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading enrichment history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          <p className="font-medium">Error loading enrichments</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Data Enrichments</h3>
            <p className="text-sm text-gray-600 mt-1">
              {enrichments.length} field{enrichments.length !== 1 ? 's' : ''} auto-populated from integrations
            </p>
          </div>

          {sources.length > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Sources
              </button>
              {sources.map(source => {
                const sourceInfo = formatSource(source);
                return (
                  <button
                    key={source}
                    onClick={() => setFilter(source)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                      filter === source
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {sourceInfo.icon} {sourceInfo.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {filteredEnrichments.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-500">No enrichments found</p>
            <p className="text-sm text-gray-400 mt-1">
              Data will appear here when integrations populate application fields
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEnrichments.map((enrichment) => {
              const sourceInfo = formatSource(enrichment.source);
              
              return (
                <div
                  key={enrichment.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sourceInfo.color}`}>
                        {sourceInfo.icon} {sourceInfo.name}
                      </span>
                      
                      {enrichment.confidence_score && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(enrichment.confidence_score)}`}>
                          {enrichment.confidence_score}% confidence
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-gray-500">
                      {formatDate(enrichment.enriched_at)}
                    </span>
                  </div>

                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {formatFieldPath(enrichment.field_path)}
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-md p-3 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-medium mb-1">
                        Previous Value
                      </div>
                      <div className="text-sm text-gray-600 font-mono">
                        {formatValue(enrichment.old_value)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 uppercase font-medium mb-1 flex items-center gap-1">
                        New Value
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-900 font-mono font-medium">
                        {formatValue(enrichment.new_value)}
                      </div>
                    </div>
                  </div>

                  {enrichment.enriched_by && enrichment.enriched_by !== 'system' && (
                    <div className="mt-2 text-xs text-gray-500">
                      Enriched by: {enrichment.enriched_by}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnrichmentHistory;
