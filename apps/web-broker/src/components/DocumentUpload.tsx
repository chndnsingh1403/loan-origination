import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';

interface Document {
  id: string;
  document_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_applicable';
  confidence_score?: number;
  is_verified: boolean;
  verified_at?: string;
  verified_by?: string;
  created_at: string;
  processed_at?: string;
  uploaded_by: string;
}

interface DocumentUploadProps {
  applicationId: string;
}

const DOCUMENT_TYPES = [
  { value: 'paystub', label: 'Pay Stub', required: true, icon: '💰' },
  { value: 'bank_statement', label: 'Bank Statement', required: true, icon: '🏦' },
  { value: 'id_document', label: 'Government ID', required: true, icon: '🪪' },
  { value: 'w2', label: 'W-2 Form', required: false, icon: '📄' },
  { value: 'tax_return', label: 'Tax Return', required: false, icon: '📊' },
  { value: 'proof_of_residence', label: 'Proof of Residence', required: false, icon: '🏠' },
  { value: 'other', label: 'Other', required: false, icon: '📎' }
];

export default function DocumentUpload({ applicationId }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedType, setSelectedType] = useState('paystub');

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
      } else {
        setError('Failed to load documents');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload PDF, images, or Word documents only.');
      return;
    }

    try {
      setUploading(true);
      setError('');

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        // Remove data:mime/type;base64, prefix
        const base64File = base64Data.split(',')[1];

        const res = await authenticatedFetch(`/api/applications/${applicationId}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            document_type: documentType,
            file_name: file.name,
            file_data: base64File,
            mime_type: file.type
          })
        });

        if (res.ok) {
          await fetchDocuments();
          // Reset file input
          event.target.value = '';
        } else {
          const errorData = await res.json();
          alert(errorData.error || 'Failed to upload document');
        }
        setUploading(false);
      };
      
      reader.onerror = () => {
        alert('Failed to read file');
        setUploading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload document');
      setUploading(false);
    }
  };

  const handleDownload = async (documentId: string) => {
    try {
      const res = await authenticatedFetch(`/api/documents/${documentId}/download`);
      if (res.ok) {
        const data = await res.json();
        window.open(data.downloadUrl, '_blank');
      } else {
        alert('Failed to generate download link');
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

  const getOcrStatusBadge = (status: string) => {
    const badges: { [key: string]: { label: string; className: string } } = {
      pending: { label: 'Pending OCR', className: 'bg-gray-100 text-gray-800' },
      processing: { label: 'Processing...', className: 'bg-blue-100 text-blue-800' },
      completed: { label: 'Processed', className: 'bg-green-100 text-green-800' },
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Required Documents</h2>
        <p className="text-sm text-gray-600">
          Upload all required documents to process your application. Documents will be automatically processed and verified.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4 mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-8">
        {DOCUMENT_TYPES.map((docType) => {
          const uploadedDoc = documents.find(d => d.document_type === docType.value);
          
          return (
            <div
              key={docType.value}
              className={`border rounded-lg p-4 ${uploadedDoc ? 'border-green-300 bg-green-50' : docType.required ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{docType.icon}</span>
                  <div>
                    <div className="font-semibold">
                      {docType.label}
                      {docType.required && <span className="text-red-500 ml-1">*</span>}
                    </div>
                    {uploadedDoc ? (
                      <div className="text-sm text-gray-600">
                        {uploadedDoc.file_name} ({formatFileSize(uploadedDoc.file_size)})
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        {docType.required ? 'Required' : 'Optional'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {uploadedDoc ? (
                    <>
                      {getOcrStatusBadge(uploadedDoc.ocr_status)}
                      {uploadedDoc.is_verified && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Verified
                        </span>
                      )}
                      <button
                        onClick={() => handleDownload(uploadedDoc.id)}
                        className="px-3 py-1 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 text-sm"
                      >
                        View
                      </button>
                    </>
                  ) : (
                    <label className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer text-sm">
                      {uploading ? 'Uploading...' : 'Upload'}
                      <input
                        type="file"
                        onChange={(e) => handleFileUpload(e, docType.value)}
                        disabled={uploading}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx"
                      />
                    </label>
                  )}
                </div>
              </div>

              {uploadedDoc && uploadedDoc.confidence_score && (
                <div className="mt-2 text-sm text-gray-600">
                  OCR Confidence: {uploadedDoc.confidence_score.toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {documents.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4">Uploaded Documents ({documents.length})</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.icon || '📎'}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{doc.file_name}</div>
                    <div className="text-xs text-gray-500">
                      Uploaded by {doc.uploaded_by} on {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getOcrStatusBadge(doc.ocr_status)}
                  <button
                    onClick={() => handleDownload(doc.id)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <div className="flex items-start gap-2">
          <span className="text-blue-600 mt-0.5">ℹ️</span>
          <div className="text-sm text-blue-800">
            <strong>Tip:</strong> Upload clear, high-quality scans or photos. Documents will be automatically
            processed to extract key information and speed up your application review.
          </div>
        </div>
      </div>
    </div>
  );
}
