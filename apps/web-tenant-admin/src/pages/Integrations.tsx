import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';

interface Integration {
  id?: string;
  provider: string;
  is_enabled: boolean;
  endpoint_url?: string;
  settings?: any;
  created_at?: string;
  updated_at?: string;
}

interface Provider {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'textarea';
    required?: boolean;
    placeholder?: string;
  }>;
}

const PROVIDERS: Provider[] = [
  {
    id: 'experian',
    name: 'Experian',
    category: 'Credit Bureau',
    icon: '📊',
    description: 'Credit score and history verification',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', required: true },
      { name: 'endpoint_url', label: 'API Endpoint', type: 'url', placeholder: 'https://api.experian.com' },
      { name: 'client_id', label: 'Client ID', type: 'text' }
    ]
  },
  {
    id: 'plaid',
    name: 'Plaid',
    category: 'Income Verification',
    icon: '🏦',
    description: 'Bank account and income verification',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', required: true },
      { name: 'client_id', label: 'Client ID', type: 'text', required: true },
      { name: 'secret', label: 'Secret', type: 'password', required: true },
      { name: 'endpoint_url', label: 'Environment', type: 'url', placeholder: 'https://sandbox.plaid.com' }
    ]
  },
  {
    id: 'socure',
    name: 'Socure',
    category: 'Identity Verification',
    icon: '🆔',
    description: 'Identity and document verification',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', required: true },
      { name: 'endpoint_url', label: 'API Endpoint', type: 'url' }
    ]
  },
  {
    id: 'textract',
    name: 'AWS Textract',
    category: 'Document OCR',
    icon: '📄',
    description: 'Document text extraction and analysis',
    fields: [
      { name: 'access_key_id', label: 'AWS Access Key ID', type: 'text', required: true },
      { name: 'secret_access_key', label: 'AWS Secret Access Key', type: 'password', required: true },
      { name: 'region', label: 'AWS Region', type: 'text', placeholder: 'us-east-1' }
    ]
  },
  {
    id: 'kbb',
    name: 'Kelley Blue Book',
    category: 'Vehicle Valuation',
    icon: '🚗',
    description: 'Vehicle value assessment',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', required: true },
      { name: 'endpoint_url', label: 'API Endpoint', type: 'url' }
    ]
  },
  {
    id: 'twilio',
    name: 'Twilio',
    category: 'SMS Notifications',
    icon: '📱',
    description: 'SMS and phone notifications',
    fields: [
      { name: 'account_sid', label: 'Account SID', type: 'text', required: true },
      { name: 'auth_token', label: 'Auth Token', type: 'password', required: true },
      { name: 'from_number', label: 'From Phone Number', type: 'text', placeholder: '+1234567890' }
    ]
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    category: 'Email',
    icon: '📧',
    description: 'Email notifications and communications',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', required: true },
      { name: 'from_email', label: 'From Email', type: 'text', placeholder: 'noreply@example.com' },
      { name: 'from_name', label: 'From Name', type: 'text', placeholder: 'My Org' }
    ]
  }
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch('/api/integrations');
      if (res.ok) {
        setIntegrations(await res.json());
      } else {
        setError('Failed to load integrations');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIntegration = async (provider: string, data: any) => {
    try {
      const res = await authenticatedFetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          ...data
        })
      });

      if (res.ok) {
        await fetchIntegrations();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save integration');
      }
    } catch (err) {
      alert('Failed to save integration');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-gray-600 mt-1">
          Configure third-party services for credit checks, income verification, and notifications
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4 mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDERS.map((provider) => {
          const config = integrations.find((i) => i.provider === provider.id);
          return (
            <IntegrationCard
              key={provider.id}
              provider={provider}
              config={config}
              onConfigure={handleSaveIntegration}
            />
          );
        })}
      </div>
    </div>
  );
}

function IntegrationCard({
  provider,
  config,
  onConfigure
}: {
  provider: Provider;
  config?: Integration;
  onConfigure: (provider: string, data: any) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{provider.icon}</span>
            <div>
              <h3 className="font-semibold">{provider.name}</h3>
              <p className="text-sm text-gray-500">{provider.category}</p>
            </div>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              config?.is_enabled
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {config?.is_enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-4">{provider.description}</p>

        {config?.updated_at && (
          <p className="text-xs text-gray-500 mb-4">
            Last updated: {new Date(config.updated_at).toLocaleDateString()}
          </p>
        )}

        <button
          onClick={() => setShowModal(true)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          {config ? 'Configure' : 'Set Up'}
        </button>
      </div>

      {showModal && (
        <ConfigModal
          provider={provider}
          config={config}
          onSave={(data) => {
            onConfigure(provider.id, data);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function ConfigModal({
  provider,
  config,
  onSave,
  onClose
}: {
  provider: Provider;
  config?: Integration;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<any>({
    is_enabled: config?.is_enabled || false,
    endpoint_url: config?.endpoint_url || '',
    api_key: '',
    settings: config?.settings || {}
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build settings object from form fields
    const settings: any = {};
    provider.fields.forEach((field) => {
      if (field.name !== 'api_key' && field.name !== 'endpoint_url') {
        settings[field.name] = formData[field.name] || '';
      }
    });

    onSave({
      is_enabled: formData.is_enabled,
      api_key: formData.api_key || undefined,
      endpoint_url: formData.endpoint_url || undefined,
      settings
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{provider.icon}</span>
            <div>
              <h2 className="text-xl font-bold">{provider.name}</h2>
              <p className="text-sm text-gray-600">{provider.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">{provider.description}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center mb-4 p-4 bg-gray-50 rounded">
            <input
              type="checkbox"
              id="is_enabled"
              checked={formData.is_enabled}
              onChange={(e) =>
                setFormData({ ...formData, is_enabled: e.target.checked })
              }
              className="mr-3 w-5 h-5"
            />
            <label htmlFor="is_enabled" className="font-medium">
              Enable this integration
            </label>
          </div>

          {provider.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, [field.name]: e.target.value })
                  }
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              ) : (
                <input
                  type={field.type}
                  value={formData[field.name] || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, [field.name]: e.target.value })
                  }
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full border rounded px-3 py-2"
                />
              )}
              {field.type === 'password' && config && (
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to keep existing value
                </p>
              )}
            </div>
          ))}

          <div className="flex gap-3 mt-6 pt-4 border-t">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Configuration
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
