import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';

interface Document {
  id: string;
  document_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  ocr_status: string;
  confidence_score?: number;
  is_verified: boolean;
  verified_at?: string;
  verified_by?: string;
  created_at: string;
  processed_at?: string;
  uploaded_by: string;
}

interface ExtractedData {
  [key: string]: {
    value: string;
    confidence?: number;
  };
}

interface DocumentViewerProps {
  applicationId: string;
}

export default function DocumentViewer({ applicationId }: DocumentViewerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [applicationId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch(`/api/applications/${applicationId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    setSelectedDoc(doc);
    setExtractedData(null);

    // Fetch extracted OCR data if available
    if (doc.ocr_status === 'completed') {
      try {
        const res = await authenticatedFetch(`/api/documents/${doc.id}/extracted-data`);
        if (res.ok) {
          const data = await res.json();
          setExtractedData(data.extractedData);
        }
      } catch (err) {
        console.error('Failed to fetch extracted data:', err);
      }
    }
  };

  const handleVerifyDocument = async (docId: string, isVerified: boolean, notes: string = '') => {
    try {
      setVerifying(true);
      const res = await authenticatedFetch(`/api/documents/${docId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_verified: isVerified,
          verification_notes: notes
        })
      });

      if (res.ok) {
        await fetchDocuments();
        alert(isVerified ? 'Document verified successfully' : 'Document marked as unverified');
      } else {
        alert('Failed to verify document');
      }
    } catch (err) {
      console.error('Verification error:', err);
      alert('Failed to verify document');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = async (documentId: string) => {
    try {
      const res = await authenticatedFetch(`/api/documents/${documentId}/download`);
      if (res.ok) {
        const data = await res.json();
        window.open(data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDocumentIcon = (type: string): string => {
    const icons: { [key: string]: string } = {
      paystub: '💰',
      bank_statement: '🏦',
      id_document: '🪪',
      w2: '📄',
      tax_return: '📊',
      proof_of_residence: '🏠',
      other: '📎'
    };
    return icons[type] || '📎';
  };

  const getOcrStatusBadge = (status: string) => {
    const badges: { [key: string]: { label: string; className: string } } = {
      pending: { label: 'Pending OCR', className: 'bg-yellow-100 text-yellow-800' },
      processing: { label: 'Processing...', className: 'bg-blue-100 text-blue-800' },
      completed: { label: 'OCR Complete', className: 'bg-green-100 text-green-800' },
      failed: { label: 'OCR Failed', className: 'bg-red-100 text-red-800' },
      not_applicable: { label: 'N/A', className: 'bg-gray-100 text-gray-600' }
    };
    
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return <div className="p-6">Loading documents...</div>;
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">
          <span className="text-4xl">📁</span>
          <p className="mt-2">No documents uploaded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Document List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Application Documents</h2>
        
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleViewDocument(doc)}
              className={`border rounded-lg p-4 cursor-pointer transition ${
                selectedDoc?.id === doc.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getDocumentIcon(doc.document_type)}</span>
                  <div>
                    <div className="font-semibold">{doc.file_name}</div>
                    <div className="text-sm text-gray-500">
                      {doc.document_type.replace('_', ' ')} • {formatFileSize(doc.file_size)}
                    </div>
                  </div>
                </div>
                {doc.is_verified && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✓ Verified
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                {getOcrStatusBadge(doc.ocr_status)}
                {doc.confidence_score && (
                  <span className="text-xs text-gray-600">
                    {doc.confidence_score.toFixed(1)}% confidence
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-500 mt-2">
                Uploaded by {doc.uploaded_by} on {new Date(doc.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Document Details */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {selectedDoc ? (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Document Details</h2>
                <button
                  onClick={() => handleDownload(selectedDoc.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Download
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{selectedDoc.document_type.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">File name:</span>
                  <span className="font-medium">{selectedDoc.file_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Size:</span>
                  <span className="font-medium">{formatFileSize(selectedDoc.file_size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Uploaded:</span>
                  <span className="font-medium">
                    {new Date(selectedDoc.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Uploaded by:</span>
                  <span className="font-medium">{selectedDoc.uploaded_by}</span>
                </div>
              </div>
            </div>

            {/* Extracted OCR Data */}
            {selectedDoc.ocr_status === 'completed' && extractedData && (
              <div className="border-t pt-4 mb-4">
                <h3 className="font-semibold mb-3">Extracted Data (OCR)</h3>
                <div className="space-y-2">
                  {Object.entries(extractedData).map(([key, field]) => (
                    <div key={key} className="flex justify-between items-start p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-600 capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-medium">{field.value}</span>
                        {field.confidence && (
                          <div className="text-xs text-gray-500">
                            {field.confidence}% confident
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedDoc.confidence_score && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-sm text-blue-800">
                      <strong>Overall Confidence:</strong> {selectedDoc.confidence_score.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedDoc.ocr_status === 'processing' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Processing document...</span>
                </div>
              </div>
            )}

            {selectedDoc.ocr_status === 'failed' && (
              <div className="border-t pt-4 mb-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <div className="text-sm text-red-800">
                    <strong>OCR Failed:</strong> Unable to extract data from this document.
                    Manual review required.
                  </div>
                </div>
              </div>
            )}

            {/* Verification Section */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Verification Status</h3>
              
              {selectedDoc.is_verified ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded mb-3">
                  <div className="flex items-center gap-2 text-green-800">
                    <span className="text-xl">✓</span>
                    <div>
                      <div className="font-medium">Verified</div>
                      {selectedDoc.verified_by && selectedDoc.verified_at && (
                        <div className="text-sm">
                          By {selectedDoc.verified_by} on{' '}
                          {new Date(selectedDoc.verified_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded mb-3">
                  <div className="text-yellow-800">
                    <strong>Pending Verification</strong>
                    <p className="text-sm mt-1">This document requires manual verification.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {!selectedDoc.is_verified ? (
                  <button
                    onClick={() => handleVerifyDocument(selectedDoc.id, true)}
                    disabled={verifying}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {verifying ? 'Verifying...' : 'Verify Document'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleVerifyDocument(selectedDoc.id, false, 'Re-review required')}
                    disabled={verifying}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {verifying ? 'Processing...' : 'Mark for Re-review'}
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <span className="text-4xl">👈</span>
            <p className="mt-2">Select a document to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
