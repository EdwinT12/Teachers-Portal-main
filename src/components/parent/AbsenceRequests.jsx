import { useEffect, useState } from 'react';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { FileText, Plus, Calendar, Check, X, Clock, AlertCircle, AlertTriangle, Edit2, Trash2 } from 'lucide-react';

const AbsenceRequests = ({ linkedChildren, onRequestSubmitted }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [absenceReasons, setAbsenceReasons] = useState([]);
  const [editingRequest, setEditingRequest] = useState(null);
  const [deletingRequest, setDeletingRequest] = useState(null);
  
  const [formData, setFormData] = useState({
    studentId: '',
    absenceDate: '',
    reason: '',
    customReason: ''
  });

  useEffect(() => {
    loadData();
  }, [linkedChildren]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load absence reasons
      const { data: reasonsData, error: reasonsError } = await supabase
        .from('absence_reasons')
        .select('*')
        .eq('active', true)
        .order('display_order');

      if (reasonsError) throw reasonsError;
      setAbsenceReasons(reasonsData || []);

      // Load existing requests
      if (linkedChildren && linkedChildren.length > 0) {
        const studentIds = linkedChildren.map(c => c.students?.id).filter(Boolean);
        
        const { data: requestsData, error: requestsError } = await supabase
          .from('absence_requests')
          .select(`
            *,
            students:student_id (
              id,
              student_name,
              classes:class_id (
                id,
                name
              )
            ),
            reviewer:reviewed_by (
              full_name
            )
          `)
          .in('student_id', studentIds)
          .order('created_at', { ascending: false });

        if (requestsError) throw requestsError;
        
        // Also load any orphaned requests that match by student_name
        // (in case student_id is null but we can still show the request)
        const studentNames = linkedChildren.map(c => c.students?.student_name).filter(Boolean);
        const { data: orphanedData, error: orphanedError } = await supabase
          .from('absence_requests')
          .select('*')
          .is('student_id', null)
          .in('student_name', studentNames);

        if (!orphanedError && orphanedData && orphanedData.length > 0) {
          // Combine regular and orphaned requests
          setRequests([...(requestsData || []), ...orphanedData]);
        } else {
          setRequests(requestsData || []);
        }
      }

      // Set default student if not set
      if (linkedChildren && linkedChildren.length > 0 && !formData.studentId) {
        setFormData(prev => ({
          ...prev,
          studentId: linkedChildren[0].students?.id || ''
        }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading absence requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.studentId || !formData.absenceDate || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.reason === 'Other' && !formData.customReason.trim()) {
      toast.error('Please provide a custom reason');
      return;
    }

    // Check if date is in the past or too far in the future
    const selectedDate = new Date(formData.absenceDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      toast.error('Cannot submit absence request for past dates');
      return;
    }

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    if (selectedDate > maxDate) {
      toast.error('Cannot submit absence request more than 3 months in advance');
      return;
    }

    setSubmitting(true);

    try {
      const parentChild = linkedChildren.find(c => c.students?.id === formData.studentId);
      const student = parentChild?.students;
      
      if (editingRequest) {
        // Update existing request
        const { error } = await supabase
          .from('absence_requests')
          .update({
            student_id: formData.studentId,
            student_name: student?.student_name,
            class_id: student?.class_id,
            absence_date: formData.absenceDate,
            reason: formData.reason,
            custom_reason: formData.reason === 'Other' ? formData.customReason : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRequest.id);

        if (error) {
          if (error.code === '23505') {
            toast.error('An absence request already exists for this date');
          } else {
            throw error;
          }
          return;
        }

        toast.success('Absence request updated successfully!');
        setEditingRequest(null);
      } else {
        // Create new request
        const { error } = await supabase
          .from('absence_requests')
          .insert({
            parent_id: parentChild.parent_id,
            student_id: formData.studentId,
            student_name: student?.student_name,
            class_id: student?.class_id,
            absence_date: formData.absenceDate,
            reason: formData.reason,
            custom_reason: formData.reason === 'Other' ? formData.customReason : null,
            status: 'pending'
          });

        if (error) {
          if (error.code === '23505') {
            toast.error('An absence request already exists for this date');
          } else {
            throw error;
          }
          return;
        }

        toast.success('Absence request submitted successfully!');
      }
      
      setShowForm(false);
      setFormData({
        studentId: linkedChildren[0]?.students?.id || '',
        absenceDate: '',
        reason: '',
        customReason: ''
      });
      loadData();
      if (onRequestSubmitted) onRequestSubmitted();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error(editingRequest ? 'Error updating absence request' : 'Error submitting absence request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (request) => {
    setEditingRequest(request);
    setFormData({
      studentId: request.student_id,
      absenceDate: request.absence_date,
      reason: request.reason,
      customReason: request.custom_reason || ''
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setFormData({
      studentId: linkedChildren[0]?.students?.id || '',
      absenceDate: '',
      reason: '',
      customReason: ''
    });
    setShowForm(false);
  };

  const handleDelete = async (request) => {
    if (!window.confirm(`Are you sure you want to withdraw the absence request for ${formatDate(request.absence_date)}?\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeletingRequest(request.id);

    try {
      const { error } = await supabase
        .from('absence_requests')
        .delete()
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Absence request withdrawn successfully');
      loadData();
      if (onRequestSubmitted) onRequestSubmitted();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Error withdrawing absence request');
    } finally {
      setDeletingRequest(null);
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { label: 'Pending Review', color: '#f59e0b', icon: Clock, bg: '#fef3c7' },
      'approved': { label: 'Approved', color: '#10b981', icon: Check, bg: '#d1fae5' },
      'rejected': { label: 'Rejected', color: '#ef4444', icon: X, bg: '#fee2e2' }
    };
    return statusMap[status] || statusMap['pending'];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // NEW: Check if a request is orphaned (no student_id but has student_name)
  const isOrphaned = (request) => {
    return !request.student_id && request.student_name;
  };

  // NEW: Get display info for a request (handling both regular and orphaned)
  const getRequestDisplayInfo = (request) => {
    if (request.students?.student_name) {
      // Regular request with full student info
      return {
        studentName: request.students.student_name,
        className: request.students.classes?.name || 'Unknown Class',
        isOrphaned: false
      };
    } else if (request.student_name) {
      // Orphaned request - use stored name
      return {
        studentName: request.student_name,
        className: 'Class info unavailable',
        isOrphaned: true
      };
    } else {
      // Broken request
      return {
        studentName: 'Unknown Student',
        className: 'Unknown Class',
        isOrphaned: false,
        isBroken: true
      };
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          margin: '0 auto 16px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading absence requests...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#1e293b',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <FileText style={{ width: '28px', height: '28px', color: '#667eea' }} />
          Absence Requests
        </h2>
        <button
          onClick={() => {
            if (showForm && editingRequest) {
              handleCancelEdit();
            } else {
              setShowForm(!showForm);
            }
          }}
          style={{
            padding: '12px 20px',
            background: showForm ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!showForm) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          {showForm ? (
            <>
              <X style={{ width: '18px', height: '18px' }} />
              Cancel
            </>
          ) : (
            <>
              <Plus style={{ width: '18px', height: '18px' }} />
              New Request
            </>
          )}
        </button>
      </div>

      {/* NEW: Warning if there are orphaned requests */}
      {requests.some(r => isOrphaned(r)) && (
        <div style={{
          backgroundColor: '#fef3c7',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #f59e0b',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#92400e',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <AlertTriangle style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Note:</strong> Some of your absence requests need to be remapped after a recent student data update. 
            Please contact an administrator to run the bulk import process to restore the student links.
          </div>
        </div>
      )}

      {/* Submission Form */}
      {showForm && (
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '2px solid #e2e8f0'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {editingRequest ? (
              <>
                <Edit2 style={{ width: '20px', height: '20px', color: '#667eea' }} />
                Edit Absence Request
              </>
            ) : (
              <>
                <Plus style={{ width: '20px', height: '20px', color: '#667eea' }} />
                Submit Absence Request
              </>
            )}
          </h3>

          <form onSubmit={handleSubmit}>
            {/* Student Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Student *
              </label>
              <select
                required
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                {linkedChildren.map((child) => (
                  <option key={child.students?.id} value={child.students?.id}>
                    {child.students?.student_name} - {child.students?.classes?.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Absence Date *
              </label>
              <input
                type="date"
                required
                value={formData.absenceDate}
                onChange={(e) => setFormData({ ...formData, absenceDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* Reason Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Reason *
              </label>
              <select
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value, customReason: '' })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">Select a reason</option>
                {absenceReasons.map((reason) => (
                  <option key={reason.id} value={reason.reason}>
                    {reason.reason}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Reason (if Other selected) */}
            {formData.reason === 'Other' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Please specify *
                </label>
                <textarea
                  required
                  value={formData.customReason}
                  onChange={(e) => setFormData({ ...formData, customReason: e.target.value })}
                  placeholder="Please provide details..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px',
                background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {submitting ? (editingRequest ? 'Updating...' : 'Submitting...') : (editingRequest ? 'Update Request' : 'Submit Request')}
            </button>
          </form>
        </div>
      )}

      {/* Requests List */}
      <div>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '16px'
        }}>
          Your Requests
        </h3>

        {requests.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <FileText style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '14px' }}>No absence requests yet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {requests.map((request) => {
              const statusInfo = getStatusInfo(request.status);
              const StatusIcon = statusInfo.icon;
              const displayInfo = getRequestDisplayInfo(request);
              
              return (
                <div key={request.id} style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  border: displayInfo.isOrphaned ? '2px solid #fbbf24' : '2px solid #e2e8f0'
                }}>
                  {/* NEW: Orphaned request warning */}
                  {displayInfo.isOrphaned && (
                    <div style={{
                      backgroundColor: '#fef3c7',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      fontSize: '12px',
                      color: '#92400e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertTriangle style={{ width: '14px', height: '14px' }} />
                      Needs remapping after data update
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '4px'
                      }}>
                        {displayInfo.studentName}
                      </h4>
                      <p style={{
                        fontSize: '13px',
                        color: displayInfo.isOrphaned ? '#92400e' : '#64748b',
                        margin: 0,
                        fontStyle: displayInfo.isOrphaned ? 'italic' : 'normal'
                      }}>
                        {displayInfo.className}
                      </p>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: statusInfo.bg,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <StatusIcon style={{ width: '16px', height: '16px', color: statusInfo.color }} />
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: statusInfo.color
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gap: '8px',
                    fontSize: '14px'
                  }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Date:</span>
                      <span style={{ color: '#1e293b' }}>{formatDate(request.absence_date)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Reason:</span>
                      <span style={{ color: '#1e293b' }}>
                        {request.reason === 'Other' ? request.custom_reason : request.reason}
                      </span>
                    </div>
                    {request.reviewed_at && (
                      <>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontWeight: '600' }}>Reviewed by:</span>
                          <span style={{ color: '#1e293b' }}>{request.reviewer?.full_name || 'Teacher'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontWeight: '600' }}>Reviewed on:</span>
                          <span style={{ color: '#1e293b' }}>{formatDate(request.reviewed_at)}</span>
                        </div>
                      </>
                    )}
                    {request.review_notes && (
                      <div style={{
                        marginTop: '8px',
                        padding: '12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        borderLeft: '3px solid #667eea'
                      }}>
                        <span style={{ color: '#64748b', fontWeight: '600', fontSize: '12px' }}>Teacher's Note:</span>
                        <p style={{ color: '#475569', margin: '4px 0 0 0', fontSize: '13px' }}>
                          {request.review_notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons for pending requests */}
                  {request.status === 'pending' && (
                    <div style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <button
                        onClick={() => handleEdit(request)}
                        disabled={deletingRequest === request.id}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: 'white',
                          color: '#667eea',
                          border: '2px solid #667eea',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: deletingRequest === request.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                          opacity: deletingRequest === request.id ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (deletingRequest !== request.id) {
                            e.target.style.background = '#667eea';
                            e.target.style.color = 'white';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'white';
                          e.target.style.color = '#667eea';
                        }}
                      >
                        <Edit2 style={{ width: '16px', height: '16px' }} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(request)}
                        disabled={deletingRequest === request.id}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: 'white',
                          color: '#ef4444',
                          border: '2px solid #ef4444',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: deletingRequest === request.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                          opacity: deletingRequest === request.id ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (deletingRequest !== request.id) {
                            e.target.style.background = '#ef4444';
                            e.target.style.color = 'white';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'white';
                          e.target.style.color = '#ef4444';
                        }}
                      >
                        {deletingRequest === request.id ? (
                          <>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              border: '2px solid #ef444440',
                              borderTop: '2px solid #ef4444',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }}></div>
                            Withdrawing...
                          </>
                        ) : (
                          <>
                            <Trash2 style={{ width: '16px', height: '16px' }} />
                            Withdraw
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default AbsenceRequests;