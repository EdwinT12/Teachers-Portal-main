import { useEffect, useState } from 'react';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';
import { FileText, Check, X, Clock, AlertCircle, Calendar } from 'lucide-react';

const AbsenceRequestsManager = ({ classId, userId }) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [processing, setProcessing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});

  useEffect(() => {
    if (classId) {
      loadRequests();
    }
  }, [classId]);

  const loadRequests = async () => {
    try {
      setLoading(true);

      // Get students in the teacher's class
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId);

      if (studentsError) throw studentsError;

      const studentIds = students.map(s => s.id);

      if (studentIds.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // Get absence requests for these students
      const { data: requestsData, error: requestsError } = await supabase
        .from('absence_requests')
        .select(`
          *,
          students:student_id (
            id,
            student_name,
            classes:class_id (
              name
            )
          ),
          parent:parent_id (
            full_name,
            email
          )
        `)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      setRequests(requestsData || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Error loading absence requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId, studentId, absenceDate) => {
    const notes = reviewNotes[requestId] || '';
    
    setProcessing(requestId);

    try {
      // Find the column identifier for this date
      const dateObj = new Date(absenceDate);
      const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
      const day = dateObj.getDate().toString().padStart(2, '0');
      const columnId = `${monthShort}/${day}`;

      // Create or update attendance record with E (Excused) status
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', studentId)
        .eq('attendance_date', absenceDate)
        .single();

      let attendanceRecordId = null;

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('attendance_records')
          .update({ 
            status: 'E',
            column_identifier: columnId,
            synced_to_sheets: false
          })
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;
        attendanceRecordId = existingRecord.id;
      } else {
        // Create new record
        const { data: newRecord, error: insertError } = await supabase
          .from('attendance_records')
          .insert({
            student_id: studentId,
            teacher_id: userId,
            class_id: classId,
            attendance_date: absenceDate,
            status: 'E',
            column_identifier: columnId,
            synced_to_sheets: false
          })
          .select()
          .single();

        if (insertError) throw insertError;
        attendanceRecordId = newRecord.id;
      }

      // Update absence request status
      const { error: requestError } = await supabase
        .from('absence_requests')
        .update({
          status: 'approved',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          attendance_record_id: attendanceRecordId
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      toast.success('Absence request approved! Record marked as Excused (E)');
      loadRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Error approving absence request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId) => {
    const notes = reviewNotes[requestId] || '';
    
    if (!notes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(requestId);

    try {
      const { error } = await supabase
        .from('absence_requests')
        .update({
          status: 'rejected',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Absence request rejected');
      loadRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Error rejecting absence request');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      weekday: 'long'
    });
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { label: 'Pending', color: '#f59e0b', icon: Clock, bg: '#fef3c7' },
      'approved': { label: 'Approved', color: '#10b981', icon: Check, bg: '#d1fae5' },
      'rejected': { label: 'Rejected', color: '#ef4444', icon: X, bg: '#fee2e2' }
    };
    return statusMap[status] || statusMap['pending'];
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const reviewedRequests = requests.filter(r => r.status !== 'pending');

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
      {/* Pending Requests Section */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Clock style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
          Pending Review ({pendingRequests.length})
        </h3>

        {pendingRequests.length === 0 ? (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <FileText style={{ width: '40px', height: '40px', margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '14px' }}>No pending absence requests</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {pendingRequests.map((request) => (
              <div key={request.id} style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                border: '2px solid #fcd34d',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div>
                    <h4 style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '8px'
                    }}>
                      {request.students?.student_name}
                    </h4>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#64748b',
                      fontSize: '14px',
                      marginBottom: '4px'
                    }}>
                      <Calendar style={{ width: '16px', height: '16px' }} />
                      {formatDate(request.absence_date)}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Requested by: {request.parent?.full_name || 'Parent'} ({request.parent?.email})
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    background: '#fef3c7',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#d97706'
                  }}>
                    PENDING
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '8px'
                  }}>
                    Reason:
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#1e293b',
                    lineHeight: '1.6'
                  }}>
                    {request.reason === 'Other' ? request.custom_reason : request.reason}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '8px'
                  }}>
                    Review Notes (optional for approval, required for rejection)
                  </label>
                  <textarea
                    value={reviewNotes[request.id] || ''}
                    onChange={(e) => setReviewNotes({
                      ...reviewNotes,
                      [request.id]: e.target.value
                    })}
                    placeholder="Add any notes about this request..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    onClick={() => handleApprove(request.id, request.student_id, request.absence_date)}
                    disabled={processing === request.id}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: processing === request.id ? '#94a3b8' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: processing === request.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (processing !== request.id) {
                        e.target.style.background = '#059669';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (processing !== request.id) {
                        e.target.style.background = '#10b981';
                      }
                    }}
                  >
                    <Check style={{ width: '18px', height: '18px' }} />
                    Approve (Mark as E)
                  </button>
                  <button
                    onClick={() => handleReject(request.id)}
                    disabled={processing === request.id}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: processing === request.id ? '#94a3b8' : '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: processing === request.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (processing !== request.id) {
                        e.target.style.background = '#dc2626';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (processing !== request.id) {
                        e.target.style.background = '#ef4444';
                      }
                    }}
                  >
                    <X style={{ width: '18px', height: '18px' }} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviewed Requests Section */}
      {reviewedRequests.length > 0 && (
        <div>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FileText style={{ width: '24px', height: '24px', color: '#667eea' }} />
            Recently Reviewed ({reviewedRequests.length})
          </h3>

          <div style={{ display: 'grid', gap: '12px' }}>
            {reviewedRequests.slice(0, 10).map((request) => {
              const statusInfo = getStatusInfo(request.status);
              const StatusIcon = statusInfo.icon;

              return (
                <div key={request.id} style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e2e8f0'
                }}>
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
                        marginBottom: '6px'
                      }}>
                        {request.students?.student_name}
                      </h4>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {formatDate(request.absence_date)}
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      background: statusInfo.bg,
                      borderRadius: '6px',
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

                  {request.review_notes && (
                    <div style={{
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      borderLeft: '3px solid #667eea'
                    }}>
                      <span style={{ color: '#64748b', fontWeight: '600', fontSize: '12px' }}>Your Note:</span>
                      <p style={{ color: '#475569', margin: '4px 0 0 0', fontSize: '13px' }}>
                        {request.review_notes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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

export default AbsenceRequestsManager;