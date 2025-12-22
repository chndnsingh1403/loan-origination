import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  product_types: string[];
  estimated_duration?: string;
}

interface OrganizationWorkflow {
  id: string;
  workflow_name: string;
  workflow_type: string;
  n8n_workflow_id: string;
  is_active: boolean;
  is_custom: boolean;
  template_id: string;
  version: number;
  config: any;
  created_at: string;
  updated_at: string;
}

interface WorkflowConfig {
  workflow_name: string;
  auto_approve_threshold?: number;
  auto_decline_threshold?: number;
  require_manager_approval_amount?: number;
  enable_parallel_verification?: boolean;
}

export const WorkflowManagement: React.FC = () => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [activeWorkflows, setActiveWorkflows] = useState<OrganizationWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [conflictingWorkflow, setConflictingWorkflow] = useState<{id: string, workflow_name: string} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      console.log('Fetching workflow data from:', API);
      
      const [templatesRes, workflowsRes] = await Promise.all([
        authenticatedFetch('/api/workflow-templates'),
        authenticatedFetch('/api/workflows/active')
      ]);

      console.log('Templates response:', templatesRes.status);
      console.log('Workflows response:', workflowsRes.status);

      if (!templatesRes.ok || !workflowsRes.ok) {
        throw new Error(`API error: templates=${templatesRes.status}, workflows=${workflowsRes.status}`);
      }

      const templatesData = await templatesRes.json();
      const workflowsData = await workflowsRes.json();

      console.log('Templates data:', templatesData);
      console.log('Workflows data:', workflowsData);

      setTemplates(templatesData);
      setActiveWorkflows(workflowsData);
    } catch (error) {
      console.error('Error fetching workflow data:', error);
      alert('Failed to load workflows. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const activateWorkflow = async (config: WorkflowConfig) => {
    if (!selectedTemplate) return;

    try {
      const response = await authenticatedFetch('/api/workflows/activate', {
        method: 'POST',
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          workflow_name: config.workflow_name,
          workflow_type: 'application_submitted',
          config
        })
      });

      if (response.ok) {
        await fetchData();
        setShowConfigModal(false);
        setSelectedTemplate(null);
      } else if (response.status === 409) {
        // Workflow already exists for this type
        const errorData = await response.json();
        setConflictingWorkflow(errorData.existing);
        setShowConfigModal(false);
      } else {
        const errorData = await response.json();
        alert(`Failed to activate workflow: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error activating workflow:', error);
      alert('Failed to activate workflow. Please check the console for details.');
    }
  };

  const toggleWorkflowActive = async (workflowId: string, currentStatus: boolean) => {
    try {
      await authenticatedFetch(`/api/workflows/${workflowId}/customize`, {
        method: 'PUT',
        body: JSON.stringify({
          config: { is_active: !currentStatus }
        })
      });
      await fetchData();
    } catch (error) {
      console.error('Error toggling workflow:', error);
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await authenticatedFetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE'
      });
      await fetchData();
    } catch (error) {
      console.error('Error deleting workflow:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-500">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Workflow Management</h1>

      {/* Active Workflows Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Workflows</h2>
        {activeWorkflows.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              No workflows configured. Select a template below to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeWorkflows.map((workflow) => (
              <div 
                key={workflow.id}
                data-workflow-id={workflow.id}
                className="bg-white border rounded-lg p-4 shadow-sm transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{workflow.workflow_name}</h3>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      workflow.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Template: <span className="font-medium">{workflow.template_id}</span>
                  {workflow.is_custom && (
                    <span className="ml-2 text-blue-600">(Customized v{workflow.version})</span>
                  )}
                </p>
                <div className="text-xs text-gray-500 mb-3">
                  Workflow ID: {workflow.n8n_workflow_id}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleWorkflowActive(workflow.id, workflow.is_active)}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    {workflow.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => window.open(`http://localhost:5678`, '_blank')}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View in n8n
                  </button>
                  <button
                    onClick={() => deleteWorkflow(workflow.id)}
                    className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Templates Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-400 transition"
            >
              <h3 className="font-bold text-lg mb-2">{template.name}</h3>
              <p className="text-gray-600 text-sm mb-3">{template.description}</p>

              <div className="mb-4">
                <span className="text-xs text-gray-500">Suitable for:</span>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {template.product_types.map((type) => (
                    <span
                      key={type}
                      className="px-2 py-1 bg-gray-100 rounded text-xs"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>

              {template.estimated_duration && (
                <div className="text-xs text-gray-500 mb-3">
                  ⏱️ Estimated duration: {template.estimated_duration}
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedTemplate(template);
                  setShowConfigModal(true);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Activate This Template
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && selectedTemplate && (
        <ConfigModal
          template={selectedTemplate}
          onSave={activateWorkflow}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {conflictingWorkflow && (
        <ConflictModal
          workflow={conflictingWorkflow}
          onClose={() => setConflictingWorkflow(null)}
        />
      )}
    </div>
  );
};

interface ConfigModalProps {
  template: WorkflowTemplate;
  onSave: (config: WorkflowConfig) => void;
  onClose: () => void;
}

const WorkflowConfigModal: React.FC<ConfigModalProps> = ({
  template,
  onSave,
  onClose,
}) => {
  const [config, setConfig] = useState<WorkflowConfig>({
    workflow_name: `${template.name} - My Organization`,
    auto_approve_threshold: 750,
    auto_decline_threshold: 600,
    require_manager_approval_amount: 500000,
    enable_parallel_verification: true,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          Configure Workflow: {template.name}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Workflow Name
            </label>
            <input
              type="text"
              value={config.workflow_name}
              onChange={(e) =>
                setConfig({ ...config, workflow_name: e.target.value })
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Auto-Approve if Credit Score ≥
              </label>
              <input
                type="number"
                value={config.auto_approve_threshold}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    auto_approve_threshold: parseInt(e.target.value),
                  })
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Auto-Decline if Credit Score &lt;
              </label>
              <input
                type="number"
                value={config.auto_decline_threshold}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    auto_decline_threshold: parseInt(e.target.value),
                  })
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Require Manager Approval if Amount &gt;
            </label>
            <input
              type="number"
              value={config.require_manager_approval_amount}
              onChange={(e) =>
                setConfig({
                  ...config,
                  require_manager_approval_amount: parseInt(e.target.value),
                })
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={config.enable_parallel_verification}
              onChange={(e) =>
                setConfig({
                  ...config,
                  enable_parallel_verification: e.target.checked,
                })
              }
              className="mr-2"
            />
            <label className="text-sm">
              Run verifications in parallel (faster)
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onSave(config)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Activate Workflow
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Conflict Modal - Shows when a workflow already exists for this type
const ConflictModal: React.FC<{
  workflow: {id: string, workflow_name: string},
  onClose: () => void
}> = ({ workflow, onClose }) => {
  const scrollToActiveWorkflows = () => {
    onClose();
    // Scroll to the active workflows section at the top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Highlight the existing workflow briefly
    setTimeout(() => {
      const workflowElement = document.querySelector(`[data-workflow-id="${workflow.id}"]`);
      if (workflowElement) {
        workflowElement.classList.add('ring-4', 'ring-yellow-400');
        setTimeout(() => {
          workflowElement.classList.remove('ring-4', 'ring-yellow-400');
        }, 2000);
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-amber-700">⚠️ Workflow Already Exists</h3>
        
        <p className="text-gray-700 mb-4">
          You already have an active workflow for this type:
        </p>
        
        <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-4">
          <p className="font-medium text-amber-900">{workflow.workflow_name}</p>
          <p className="text-sm text-amber-700 mt-1">ID: {workflow.id.substring(0, 8)}...</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-6">
          <p className="text-sm text-blue-900">
            💡 <strong>Tip:</strong> Each organization can only have one workflow per type. 
            To use a different template, delete or deactivate the existing workflow first 
            in the "Active Workflows" section above.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={scrollToActiveWorkflows}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            View Existing Workflow
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
