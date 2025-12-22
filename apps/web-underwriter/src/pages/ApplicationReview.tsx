import React, { useState, useEffect } from 'react'
import { authenticatedFetch } from '../utils/auth'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, AlertCircle, PlayCircle } from 'lucide-react'
import EnrichmentHistory from '../components/EnrichmentHistory'

type Application = {
  id: string
  application_number: string
  status: string
  stage: string
  requested_amount: number
  requested_term_months: number
  purpose: string
  applicant_data: Record<string, any>
  product_name: string
  broker_name: string
  created_at: string
  submitted_at: string
  organization_id: string
}

type RiskMetrics = {
  dti_ratio: number
  ltv_ratio: number
  payment_to_income: number
  risk_score: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  factors: string[]
}

type Note = {
  id: string
  user_name: string
  content: string
  created_at: string
  is_internal: boolean
}

type Task = {
  id: string
  name: string
  description: string
  task_type: string
  status: string
  sequence_order: number
  is_required: boolean
  created_at: string
  started_at?: string
  completed_at?: string
}

export const ApplicationReview: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [application, setApplication] = useState<Application | null>(null)
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [decisionType, setDecisionType] = useState<'approve' | 'decline' | 'counter' | 'request_info'>('approve')
  const [decisionNotes, setDecisionNotes] = useState('')
  const [counterAmount, setCounterAmount] = useState('')
  const [counterTerm, setCounterTerm] = useState('')
  const [counterRate, setCounterRate] = useState('')
  const [newNote, setNewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      fetchApplicationData()
    }
  }, [id])

  const fetchApplicationData = async () => {
    try {
      const [appRes, riskRes, notesRes, tasksRes] = await Promise.all([
        authenticatedFetch(`/api/underwriter/applications/${id}`),
        authenticatedFetch(`/api/underwriter/applications/${id}/risk`),
        authenticatedFetch(`/api/underwriter/applications/${id}/notes`),
        authenticatedFetch(`/api/applications/${id}/tasks`)
      ])

      if (appRes.ok) {
        setApplication(await appRes.json())
      }
      if (riskRes.ok) {
        setRiskMetrics(await riskRes.json())
      }
      if (notesRes.ok) {
        const data = await notesRes.json()
        setNotes(data.items || [])
      }
      if (tasksRes.ok) {
        setTasks(await tasksRes.json())
      }
    } catch (error) {
      console.error('Error fetching application:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDecision = async () => {
    if (!application) return

    setSubmitting(true)
    try {
      const payload: any = {
        application_id: application.id,
        decision: decisionType,
        notes: decisionNotes
      }

      if (decisionType === 'counter') {
        payload.counter_offer = {
          amount: parseFloat(counterAmount),
          term_months: parseInt(counterTerm),
          rate: parseFloat(counterRate)
        }
      }

      const response = await authenticatedFetch('/api/underwriter/decision', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        alert('Decision submitted successfully!')
        setShowDecisionModal(false)
        fetchApplicationData()
      } else {
        const error = await response.json()
        alert('Error: ' + (error.error || 'Failed to submit decision'))
      }
    } catch (error) {
      console.error('Error submitting decision:', error)
      alert('Failed to submit decision')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !application) return

    try {
      const response = await authenticatedFetch('/api/underwriter/notes', {
        method: 'POST',
        body: JSON.stringify({
          application_id: application.id,
          content: newNote,
          is_internal: true
        })
      })

      if (response.ok) {
        setNewNote('')
        fetchApplicationData()
      }
    } catch (error) {
      console.error('Error adding note:', error)
    }
  }

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const response = await authenticatedFetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        fetchApplicationData()
      }
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'in_progress':
        return <PlayCircle className="w-4 h-4 text-blue-600" />
      case 'blocked':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'blocked': return 'bg-red-100 text-red-800'
      case 'skipped': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-500">Loading application...</div></div>
  }

  if (!application) {
    return <div className="p-6"><div className="text-red-600">Application not found</div></div>
  }

  const applicantData = application.applicant_data || {}

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate('/queue')} className="text-blue-600 hover:text-blue-700 mb-2 text-sm">
                ← Back to Queue
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{application.application_number}</h1>
              <p className="text-gray-600">
                {applicantData.first_name} {applicantData.last_name} • ${Number(application.requested_amount).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setDecisionType('approve'); setShowDecisionModal(true); }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => { setDecisionType('counter'); setShowDecisionModal(true); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                💱 Counter
              </button>
              <button
                onClick={() => { setDecisionType('decline'); setShowDecisionModal(true); }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                ✗ Decline
              </button>
              <button
                onClick={() => { setDecisionType('request_info'); setShowDecisionModal(true); }}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                📧 Request Info
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="col-span-2 space-y-6">
          {/* Risk Assessment */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>🎯</span> Risk Assessment
            </h2>
            {riskMetrics ? (
              <div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{riskMetrics.dti_ratio}%</div>
                    <div className="text-sm text-gray-600">DTI Ratio</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{riskMetrics.ltv_ratio}%</div>
                    <div className="text-sm text-gray-600">LTV Ratio</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{riskMetrics.payment_to_income}%</div>
                    <div className="text-sm text-gray-600">Payment/Income</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{riskMetrics.risk_score}</div>
                    <div className="text-sm text-gray-600">Risk Score</div>
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${
                  riskMetrics.risk_level === 'LOW' ? 'bg-green-50 border border-green-200' :
                  riskMetrics.risk_level === 'MEDIUM' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <div className="font-semibold mb-2">Risk Level: {riskMetrics.risk_level}</div>
                  <div className="text-sm space-y-1">
                    {riskMetrics.factors.map((factor, idx) => (
                      <div key={idx}>• {factor}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">Risk metrics not available</div>
            )}
          </div>

          {/* Applicant Information */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>👤</span> Applicant Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="font-medium">Name:</span> {applicantData.first_name} {applicantData.last_name}</div>
              <div><span className="font-medium">Email:</span> {applicantData.email}</div>
              <div><span className="font-medium">Phone:</span> {applicantData.phone}</div>
              <div><span className="font-medium">DOB:</span> {applicantData.date_of_birth}</div>
              <div><span className="font-medium">SSN:</span> {applicantData.ssn}</div>
              <div className="col-span-2"><span className="font-medium">Address:</span> {applicantData.address}, {applicantData.city}, {applicantData.state} {applicantData.zip_code}</div>
            </div>
          </div>

          {/* Employment & Income */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>💼</span> Employment & Income
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="font-medium">Status:</span> {applicantData.employment_status}</div>
              <div><span className="font-medium">Employer:</span> {applicantData.employer_name}</div>
              <div><span className="font-medium">Job Title:</span> {applicantData.job_title}</div>
              <div><span className="font-medium">Years Employed:</span> {applicantData.employment_length}</div>
              <div><span className="font-medium">Annual Income:</span> ${Number(applicantData.annual_income || 0).toLocaleString()}</div>
              <div><span className="font-medium">Other Income:</span> ${Number(applicantData.other_income || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Liabilities */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>💳</span> Liabilities
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="font-medium">Monthly Mortgage/Rent:</span> ${Number(applicantData.monthly_mortgage || 0).toLocaleString()}</div>
              <div><span className="font-medium">Car Payment:</span> ${Number(applicantData.monthly_car_payment || 0).toLocaleString()}</div>
              <div><span className="font-medium">Credit Card Debt:</span> ${Number(applicantData.credit_card_debt || 0).toLocaleString()}</div>
              <div><span className="font-medium">Student Loans:</span> ${Number(applicantData.student_loans || 0).toLocaleString()}</div>
              <div><span className="font-medium">Other Debts:</span> ${Number(applicantData.other_debts || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Data Enrichment History */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>🔍</span> Data Enrichment History
            </h2>
            <EnrichmentHistory applicationId={id || ''} />
          </div>

          {/* Loan Details */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>💰</span> Loan Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="font-medium">Requested Amount:</span> ${Number(application.requested_amount).toLocaleString()}</div>
              <div><span className="font-medium">Term:</span> {application.requested_term_months} months</div>
              <div><span className="font-medium">Purpose:</span> {application.purpose}</div>
              <div><span className="font-medium">Product:</span> {application.product_name}</div>
              <div><span className="font-medium">Broker:</span> {application.broker_name}</div>
              <div><span className="font-medium">Submitted:</span> {new Date(application.submitted_at || application.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold mb-3">Status</h3>
            <span className={`px-3 py-2 rounded-full text-sm font-medium inline-block ${
              application.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
              application.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
              application.status === 'approved' ? 'bg-green-100 text-green-800' :
              application.status === 'declined' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {application.status}
            </span>
          </div>

          {/* Tasks */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>✅</span> Tasks ({tasks.filter(t => t.status === 'completed').length}/{tasks.length})
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="text-sm text-gray-500">No tasks for this application</div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        {getStatusIcon(task.status)}
                        <div>
                          <div className="text-sm font-medium">{task.name}</div>
                          {task.description && (
                            <div className="text-xs text-gray-500">{task.description}</div>
                          )}
                        </div>
                      </div>
                      {task.is_required && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Required</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <div className="flex-1"></div>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'in_progress')}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Start
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => updateTaskStatus(task.id, 'completed')}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => updateTaskStatus(task.id, 'blocked')}
                            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Block
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold mb-3">Internal Notes</h3>
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="border-l-4 border-blue-500 pl-3 py-2 bg-gray-50 rounded">
                  <div className="text-sm font-medium">{note.user_name}</div>
                  <div className="text-sm text-gray-700 mt-1">{note.content}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(note.created_at).toLocaleString()}</div>
                </div>
              ))}
              {notes.length === 0 && <div className="text-sm text-gray-500">No notes yet</div>}
            </div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add internal note..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
              rows={3}
            />
            <button
              onClick={handleAddNote}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Add Note
            </button>
          </div>
        </div>
      </div>

      {/* Decision Modal */}
      {showDecisionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">
                  {decisionType === 'approve' ? '✓ Approve Application' :
                   decisionType === 'decline' ? '✗ Decline Application' :
                   decisionType === 'counter' ? '💱 Counter Offer' :
                   '📧 Request More Information'}
                </h2>
                <button onClick={() => setShowDecisionModal(false)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {decisionType === 'counter' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Counter Amount ($)</label>
                    <input
                      type="number"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="25000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Term (months)</label>
                    <input
                      type="number"
                      value={counterTerm}
                      onChange={(e) => setCounterTerm(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="36"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={counterRate}
                      onChange={(e) => setCounterRate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="7.5"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {decisionType === 'request_info' ? 'What information do you need?' : 'Decision Notes'}
                </label>
                <textarea
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={6}
                  placeholder={
                    decisionType === 'approve' ? 'Optional: Add any approval conditions or notes...' :
                    decisionType === 'decline' ? 'Required: Explain the reason for decline...' :
                    decisionType === 'counter' ? 'Optional: Explain the counter offer...' :
                    'Specify what documents or information are needed...'
                  }
                  required={decisionType === 'decline' || decisionType === 'request_info'}
                />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  onClick={() => setShowDecisionModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecision}
                  disabled={submitting || (decisionType === 'decline' && !decisionNotes.trim())}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Decision'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
