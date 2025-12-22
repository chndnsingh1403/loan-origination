import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../utils/auth';

interface NotificationTemplate {
  id: string;
  event_type: string;
  channel: string;
  recipient_role: string;
  subject: string;
  body_template: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface NotificationSettings {
  email_provider: string;
  email_from_address: string;
  email_from_name: string;
  sms_provider: string;
  sms_from_number: string;
  is_email_enabled: boolean;
  is_sms_enabled: boolean;
}

interface NotificationLog {
  id: string;
  event_type: string;
  channel: string;
  recipient_email: string;
  recipient_phone: string;
  status: string;
  created_at: string;
  application_number: string;
  error_message: string;
}

const EVENT_TYPES = [
  { value: 'application_submitted', label: 'Application Submitted', description: 'When a broker submits an application' },
  { value: 'application_approved', label: 'Application Approved', description: 'When an underwriter approves an application' },
  { value: 'application_declined', label: 'Application Declined', description: 'When an underwriter declines an application' },
  { value: 'application_under_review', label: 'Under Review', description: 'When application moves to underwriting' },
  { value: 'documents_required', label: 'Documents Required', description: 'When additional documents are needed' },
  { value: 'document_uploaded', label: 'Document Uploaded', description: 'When a document is uploaded' },
  { value: 'task_completed', label: 'Task Completed', description: 'When a task is marked as complete' },
  { value: 'decision_pending', label: 'Decision Pending', description: 'When application needs manager approval' },
];

const RECIPIENT_ROLES = [
  { value: 'broker', label: 'Broker' },
  { value: 'customer', label: 'Customer/Applicant' },
  { value: 'underwriter', label: 'Underwriter' },
  { value: 'tenant_admin', label: 'Tenant Admin' },
];

const TEMPLATE_VARIABLES = [
  '{{application_number}}',
  '{{applicant_name}}',
  '{{loan_amount}}',
  '{{status}}',
  '{{product_name}}',
  '{{broker_name}}',
  '{{underwriter_name}}',
];

export const Notifications = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'templates' | 'logs'>('settings');
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await authenticatedFetch('/api/notifications/settings');
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await authenticatedFetch('/api/notifications/templates');
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await authenticatedFetch('/api/notifications/logs?limit=50');
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const handleSaveSettings = async (formData: any) => {
    try {
      setLoading(true);
      await authenticatedFetch('/api/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      await fetchSettings();
      setShowSettingsModal(false);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (formData: any) => {
    try {
      setLoading(true);
      if (editingTemplate) {
        await authenticatedFetch(`/api/notifications/templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await authenticatedFetch('/api/notifications/templates', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      await fetchTemplates();
      setShowTemplateModal(false);
      setEditingTemplate(null);
      alert('Template saved successfully!');
    } catch (error: any) {
      console.error('Failed to save template:', error);
      alert(error.error || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await authenticatedFetch(`/api/notifications/templates/${id}`, {
        method: 'DELETE',
      });
      await fetchTemplates();
      alert('Template deleted successfully!');
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  const handleToggleTemplate = async (template: NotificationTemplate) => {
    try {
      await authenticatedFetch(`/api/notifications/templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_enabled: !template.is_enabled }),
      });
      await fetchTemplates();
    } catch (error) {
      console.error('Failed to toggle template:', error);
      alert('Failed to update template');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Notification Management</h1>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Activity Logs
          </button>
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <SettingsTab 
          settings={settings} 
          onEdit={() => setShowSettingsModal(true)} 
        />
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <TemplatesTab
          templates={templates}
          onAdd={() => {
            setEditingTemplate(null);
            setShowTemplateModal(true);
          }}
          onEdit={(template) => {
            setEditingTemplate(template);
            setShowTemplateModal(true);
          }}
          onDelete={handleDeleteTemplate}
          onToggle={handleToggleTemplate}
        />
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && <LogsTab logs={logs} onRefresh={fetchLogs} />}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettingsModal(false)}
          loading={loading}
        />
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          loading={loading}
        />
      )}
    </div>
  );
};

// Settings Tab Component
const SettingsTab = ({ settings, onEdit }: { settings: NotificationSettings | null; onEdit: () => void }) => {
  if (!settings) {
    return <div className="text-center py-12">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Notification Configuration</h2>
            <p className="text-gray-600 text-sm">
              Configure your email and SMS providers to enable notifications
            </p>
          </div>
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Configure
          </button>
        </div>

        {/* Email Configuration */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            📧 Email Configuration
            <span className={`px-2 py-1 rounded text-xs ${
              settings.is_email_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {settings.is_email_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </h3>
          <div className="bg-gray-50 rounded p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Provider:</span>
              <span className="text-sm font-medium">{settings.email_provider || 'Not configured'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">From Address:</span>
              <span className="text-sm font-medium">{settings.email_from_address || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">From Name:</span>
              <span className="text-sm font-medium">{settings.email_from_name || 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* SMS Configuration */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            📱 SMS Configuration
            <span className={`px-2 py-1 rounded text-xs ${
              settings.is_sms_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {settings.is_sms_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </h3>
          <div className="bg-gray-50 rounded p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Provider:</span>
              <span className="text-sm font-medium">{settings.sms_provider || 'Not configured'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">From Number:</span>
              <span className="text-sm font-medium">{settings.sms_from_number || 'Not set'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Templates Tab Component
const TemplatesTab = ({ 
  templates, 
  onAdd, 
  onEdit, 
  onDelete, 
  onToggle 
}: { 
  templates: NotificationTemplate[]; 
  onAdd: () => void; 
  onEdit: (template: NotificationTemplate) => void; 
  onDelete: (id: string) => void; 
  onToggle: (template: NotificationTemplate) => void; 
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-600">Manage notification templates for different events</p>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">📧</div>
          <h3 className="text-lg font-medium mb-2">No templates configured</h3>
          <p className="text-gray-600 mb-4">
            Create notification templates to automatically send emails and SMS for application events
          </p>
          <button
            onClick={onAdd}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">
                      {EVENT_TYPES.find(e => e.value === template.event_type)?.label || template.event_type}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      template.channel === 'email' ? 'bg-blue-100 text-blue-800' :
                      template.channel === 'sms' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {template.channel}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      to: {template.recipient_role}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      template.is_enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {template.is_enabled ? '✓ Active' : '✗ Disabled'}
                    </span>
                  </div>
                  {template.subject && (
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Subject:</span> {template.subject}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {template.body_template}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => onToggle(template)}
                    className={`px-3 py-1 text-sm rounded ${
                      template.is_enabled 
                        ? 'bg-gray-100 hover:bg-gray-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {template.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => onEdit(template)}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(template.id)}
                    className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Logs Tab Component
const LogsTab = ({ logs, onRefresh }: { logs: NotificationLog[]; onRefresh: () => void }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-600">Recent notification activity</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Application</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No notifications sent yet
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.event_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${
                        log.channel === 'email' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {log.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.recipient_email || log.recipient_phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.application_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${
                        log.status === 'sent' ? 'bg-green-100 text-green-800' :
                        log.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {log.status}
                      </span>
                      {log.error_message && (
                        <div className="text-xs text-red-600 mt-1">{log.error_message}</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Settings Modal Component
const SettingsModal = ({ 
  settings, 
  onSave, 
  onClose, 
  loading 
}: { 
  settings: NotificationSettings | null; 
  onSave: (data: any) => void; 
  onClose: () => void; 
  loading: boolean; 
}) => {
  const [formData, setFormData] = useState({
    email_provider: settings?.email_provider || 'sendgrid',
    email_api_key: '',
    email_from_address: settings?.email_from_address || '',
    email_from_name: settings?.email_from_name || '',
    sms_provider: settings?.sms_provider || 'twilio',
    sms_api_key: '',
    sms_account_sid: '',
    sms_from_number: settings?.sms_from_number || '',
    is_email_enabled: settings?.is_email_enabled || false,
    is_sms_enabled: settings?.is_sms_enabled || false,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Notification Settings</h2>

        <div className="space-y-6">
          {/* Email Settings */}
          <div>
            <h3 className="font-semibold mb-3">Email Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={formData.email_provider}
                  onChange={(e) => setFormData({ ...formData, email_provider: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="sendgrid">SendGrid</option>
                  <option value="ses">Amazon SES</option>
                  <option value="smtp">SMTP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key (leave empty to keep existing)</label>
                <input
                  type="password"
                  value={formData.email_api_key}
                  onChange={(e) => setFormData({ ...formData, email_api_key: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter API key..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">From Address</label>
                <input
                  type="email"
                  value={formData.email_from_address}
                  onChange={(e) => setFormData({ ...formData, email_from_address: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="notifications@yourcompany.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">From Name</label>
                <input
                  type="text"
                  value={formData.email_from_name}
                  onChange={(e) => setFormData({ ...formData, email_from_name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Your Company Name"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_email_enabled}
                  onChange={(e) => setFormData({ ...formData, is_email_enabled: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm">Enable email notifications</label>
              </div>
            </div>
          </div>

          {/* SMS Settings */}
          <div>
            <h3 className="font-semibold mb-3">SMS Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={formData.sms_provider}
                  onChange={(e) => setFormData({ ...formData, sms_provider: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="twilio">Twilio</option>
                  <option value="sns">Amazon SNS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key (leave empty to keep existing)</label>
                <input
                  type="password"
                  value={formData.sms_api_key}
                  onChange={(e) => setFormData({ ...formData, sms_api_key: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter API key..."
                />
              </div>
              {formData.sms_provider === 'twilio' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Account SID</label>
                  <input
                    type="text"
                    value={formData.sms_account_sid}
                    onChange={(e) => setFormData({ ...formData, sms_account_sid: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="AC..."
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">From Number</label>
                <input
                  type="text"
                  value={formData.sms_from_number}
                  onChange={(e) => setFormData({ ...formData, sms_from_number: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="+1234567890"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_sms_enabled}
                  onChange={(e) => setFormData({ ...formData, is_sms_enabled: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm">Enable SMS notifications</label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onSave(formData)}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Template Modal Component
const TemplateModal = ({ 
  template, 
  onSave, 
  onClose, 
  loading 
}: { 
  template: NotificationTemplate | null; 
  onSave: (data: any) => void; 
  onClose: () => void; 
  loading: boolean; 
}) => {
  const [formData, setFormData] = useState({
    event_type: template?.event_type || '',
    channel: template?.channel || 'email',
    recipient_role: template?.recipient_role || 'broker',
    subject: template?.subject || '',
    body_template: template?.body_template || '',
    is_enabled: template?.is_enabled !== false,
  });

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('body_template') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.body_template;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setFormData({ ...formData, body_template: newText });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {template ? 'Edit Template' : 'Create Template'}
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Event Type</label>
              <select
                value={formData.event_type}
                onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                className="w-full border rounded px-3 py-2"
                disabled={!!template}
              >
                <option value="">Select event...</option>
                {EVENT_TYPES.map((event) => (
                  <option key={event.value} value={event.value}>
                    {event.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Channel</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                className="w-full border rounded px-3 py-2"
                disabled={!!template}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Recipient</label>
              <select
                value={formData.recipient_role}
                onChange={(e) => setFormData({ ...formData, recipient_role: e.target.value })}
                className="w-full border rounded px-3 py-2"
                disabled={!!template}
              >
                {RECIPIENT_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(formData.channel === 'email' || formData.channel === 'both') && (
            <div>
              <label className="block text-sm font-medium mb-1">Email Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Application {{application_number}} - {{status}}"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Message Template</label>
            <div className="mb-2">
              <span className="text-xs text-gray-600 mr-2">Insert variables:</span>
              {TEMPLATE_VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => insertVariable(variable)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded mr-1 mb-1"
                >
                  {variable}
                </button>
              ))}
            </div>
            <textarea
              id="body_template"
              value={formData.body_template}
              onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              rows={10}
              placeholder={
                formData.channel === 'sms'
                  ? 'Hi {{applicant_name}}, your application {{application_number}} has been {{status}}.'
                  : 'Dear {{applicant_name}},\n\nYour loan application {{application_number}} for {{loan_amount}} has been {{status}}.\n\nThank you,\n{{broker_name}}'
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.channel === 'sms' && 'Keep SMS messages under 160 characters'}
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_enabled}
              onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
              className="mr-2"
            />
            <label className="text-sm">Enable this template</label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onSave(formData)}
            disabled={loading || !formData.event_type || !formData.body_template}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
