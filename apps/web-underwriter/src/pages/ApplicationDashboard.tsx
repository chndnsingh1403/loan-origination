import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/auth';
import DocumentViewer from '../components/DocumentViewer';

interface Application {
  id: string;
  application_number: string;
  customer: string;
  product: string;
  status: string;
  stage: string;
  requested_amount: number;
  requested_term_months: number;
  purpose: string;
  applicant_data: any;
  created_at: string;
  submitted_at?: string;
  approved_amount?: number;
  approved_rate?: number;
  credit_score?: number;
  dti_ratio?: number;
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  assigned_role: string;
  assigned_user_id?: string;
  is_required: boolean;
  due_date?: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

interface Exception {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: any;
  resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

interface Decision {
  id: string;
  decision_type: string;
  outcome: string;
  approved_amount?: number;
  approved_rate?: number;
  notes: string;
  created_at: string;
  decided_by_name?: string;
}

type TabType = 'summary' | 'documents' | 'tasks' | 'exceptions' | 'timeline' | 'decisioning' | 'notes';

export default function ApplicationDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchApplication();
      fetchTasks();
      fetchExceptions();
      fetchDecisions();
    }
  }, [id]);

  const fetchApplication = async () => {
    try {
      const res = await authenticatedFetch(`/api/underwriter/applications/${id}`);
      if (res.ok) {
        const data = await res.json();
        setApplication(data);
      } else {
        alert('Failed to load application');
        navigate('/applications');
      }
    } catch (error) {
      console.error('Error fetching application:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await authenticatedFetch(`/api/applications/${id}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    }
  };

  const fetchExceptions = async () => {
    try {
      const res = await authenticatedFetch(`/api/applications/${id}/exceptions`);
      if (res.ok) {
        const data = await res.json();
        setExceptions(data.exceptions || []);
      }
    } catch (error) {
      console.error('Error fetching exceptions:', error);
      setExceptions([]);
    }
  };

  const fetchDecisions = async () => {
    try {
      const res = await authenticatedFetch(`/api/applications/${id}/decisions`);
      if (res.ok) {
        const data = await res.json();
        setDecisions(data.decisions || []);
      }
    } catch (error) {
      console.error('Error fetching decisions:', error);
      setDecisions([]);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      withdrawn: 'bg-gray-100 text-gray-600'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status] || colors.draft}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const getSeverityIcon = (severity: string) => {
    const icons: { [key: string]: string } = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🔴'
    };
    return icons[severity] || '📋';
  };

  const handleApprove = async () => {
    if (!confirm('Approve this application?')) return;
    try {
      const res = await authenticatedFetch(`/api/underwriter/applications/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_amount: application?.requested_amount,
          approved_rate: 5.5,
          notes: 'Application approved after review'
        })
      });
      if (res.ok) {
        alert('Application approved successfully!');
        fetchApplication();
      }
    } catch (error) {
      console.error('Error approving application:', error);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const res = await authenticatedFetch(`/api/underwriter/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        alert('Application rejected');
        fetchApplication();
      }
    } catch (error) {
      console.error('Error rejecting application:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading application...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-red-600">Application not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/applications')}
                className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
              >
                ← Back to Applications
              </button>
              <h1 className="text-3xl font-bold text-gray-900">
                {application.application_number}
              </h1>
              <p className="text-gray-600 mt-1">{application.customer}</p>
            </div>
            <div className="text-right">
              {getStatusBadge(application.status)}
              <div className="mt-2 text-sm text-gray-600">
                Created {new Date(application.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'summary', label: 'Summary', icon: '📊' },
              { id: 'documents', label: 'Documents', icon: '📄' },
              { id: 'tasks', label: 'Tasks', icon: '✓', count: tasks.filter(t => t.status !== 'completed').length },
              { id: 'exceptions', label: 'Exceptions', icon: '⚠️', count: exceptions.filter(e => !e.resolved).length },
              { id: 'decisioning', label: 'Decisioning', icon: '⚖️' },
              { id: 'timeline', label: 'Timeline', icon: '📅' },
              { id: 'notes', label: 'Notes', icon: '📝' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Loan Details */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Loan Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Loan Product</label>
                  <div className="text-lg font-medium">{application.product}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Purpose</label>
                  <div className="text-lg font-medium">{application.purpose}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Requested Amount</label>
                  <div className="text-lg font-medium">${application.requested_amount.toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Term</label>
                  <div className="text-lg font-medium">{application.requested_term_months} months</div>
                </div>
                {application.credit_score && (
                  <div>
                    <label className="text-sm text-gray-600">Credit Score</label>
                    <div className={`text-lg font-medium ${application.credit_score >= 700 ? 'text-green-600' : 'text-orange-600'}`}>
                      {application.credit_score}
                    </div>
                  </div>
                )}
                {application.dti_ratio && (
                  <div>
                    <label className="text-sm text-gray-600">DTI Ratio</label>
                    <div className="text-lg font-medium">{application.dti_ratio}%</div>
                  </div>
                )}
                {application.approved_amount && (
                  <>
                    <div>
                      <label className="text-sm text-gray-600">Approved Amount</label>
                      <div className="text-lg font-medium text-green-600">
                        ${application.approved_amount.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Approved Rate</label>
                      <div className="text-lg font-medium text-green-600">
                        {application.approved_rate}%
                      </div>
                    </div>
                  </>
                )}
              </div>

              <h3 className="text-lg font-semibold mt-6 mb-3">Applicant Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Email</label>
                  <div className="text-base">{application.applicant_data?.email || '-'}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Phone</label>
                  <div className="text-base">{application.applicant_data?.phone || '-'}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Employment Status</label>
                  <div className="text-base">{application.applicant_data?.employment_status || '-'}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Annual Income</label>
                  <div className="text-base">
                    {application.applicant_data?.annual_income 
                      ? `$${Number(application.applicant_data.annual_income).toLocaleString()}`
                      : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Assessment & Actions */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Risk Assessment</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Overall Risk</span>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      MEDIUM
                    </span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="text-sm text-gray-600 mb-2">Risk Factors</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <span className="text-green-500 mr-2">✓</span>
                        Credit Score Good
                      </div>
                      <div className="flex items-center">
                        <span className="text-green-500 mr-2">✓</span>
                        Stable Employment
                      </div>
                      <div className="flex items-center text-orange-600">
                        <span className="mr-2">⚠️</span>
                        DTI Above Target
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Decision Actions</h2>
                <div className="space-y-2">
                  <button 
                    onClick={handleApprove}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✓ Approve Application
                  </button>
                  <button 
                    onClick={handleReject}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    ✗ Reject Application
                  </button>
                  <button className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    📝 Request More Info
                  </button>
                  <button className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    👤 Assign to Specialist
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg shadow p-6">
            <DocumentViewer applicationId={id!} />
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Review Tasks</h2>
            </div>
            <div className="divide-y">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No tasks assigned yet.
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={task.status === 'completed'} className="h-5 w-5 rounded" readOnly />
                          <h3 className="font-medium">{task.name}</h3>
                          {task.is_required && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Required</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 ml-8">{task.description}</p>
                        <div className="flex items-center gap-4 mt-2 ml-8 text-sm text-gray-500">
                          <span>👤 {task.assigned_role}</span>
                          {task.first_name && <span>Assigned: {task.first_name} {task.last_name}</span>}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        task.status === 'blocked' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'exceptions' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Exceptions & Issues</h2>
            </div>
            <div className="divide-y">
              {exceptions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  ✓ No exceptions. Everything looks good!
                </div>
              ) : (
                exceptions.map((exception) => (
                  <div key={exception.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getSeverityIcon(exception.severity)}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{exception.type.replace('_', ' ')}</h3>
                          {exception.resolved ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              Resolved
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                              Open
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{exception.message}</p>
                        <div className="text-xs text-gray-500 mt-2">
                          {new Date(exception.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'decisioning' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Decision History</h2>
            {decisions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No decisions recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {decisions.map((decision) => (
                  <div key={decision.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        decision.outcome === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {decision.outcome.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(decision.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">{decision.notes}</div>
                    {decision.decided_by_name && (
                      <div className="text-xs text-gray-500 mt-2">
                        Decided by: {decision.decided_by_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Application Timeline</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600">✓</span>
                  </div>
                  <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                </div>
                <div className="pb-8">
                  <div className="font-medium">Application Submitted</div>
                  <div className="text-sm text-gray-600">
                    {application.submitted_at ? new Date(application.submitted_at).toLocaleString() : 'Not submitted'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Underwriter Notes</h2>
            </div>
            <div className="p-6">
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-3"
                rows={4}
                placeholder="Add underwriter notes..."
              />
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Add Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
