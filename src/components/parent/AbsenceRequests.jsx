import { useEffect, useState } from 'react';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import emailjs from '@emailjs/browser';
import { FileText, Plus, Calendar, Check, X, Clock, AlertCircle, AlertTriangle, Edit2, Trash2 } from 'lucide-react';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_77lcszr';
const EMAILJS_TEMPLATE_ID = 'template_9o80v1o'; // Updated to match your EmailJS template
const EMAILJS_PUBLIC_KEY = 'fWof-EcizNlRVj-Lw';

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

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

  // Function to get teachers and admins for email notification
  const getEmailRecipients = async (classId) => {
    try {
      console.log('Getting email recipients for class:', classId);
      
      // Get teachers with this as their default class
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, status, role')
        .eq('default_class_id', classId)
        .eq('role', 'teacher')
        .eq('status', 'active');

      if (teachersError) {
        console.error('Error fetching teachers:', teachersError);
      } else {
        console.log('Teachers found:', teachersData);
      }

      // Get all admins
      const { data: adminsData, error: adminsError } = await supabase
        .from('profiles')
        .select('id, email, full_name, status, role')
        .eq('role', 'admin')
        .eq('status', 'active');

      if (adminsError) {
        console.error('Error fetching admins:', adminsError);
      } else {
        console.log('Admins found:', adminsData);
      }

      // Combine and deduplicate recipients
      const recipients = new Map();

      // Add teachers
      if (teachersData && teachersData.length > 0) {
        teachersData.forEach(teacher => {
          if (teacher.email) {
            recipients.set(teacher.id, {
              email: teacher.email,
              name: teacher.full_name || 'Teacher',
              role: 'teacher'
            });
          }
        });
      }

      // Add admins
      if (adminsData && adminsData.length > 0) {
        adminsData.forEach(admin => {
          if (admin.email) {
            recipients.set(admin.id, {
              email: admin.email,
              name: admin.full_name || 'Admin',
              role: 'admin'
            });
          }
        });
      }

      const recipientsList = Array.from(recipients.values());
      console.log('Total recipients to email:', recipientsList.length, recipientsList);
      
      return recipientsList;
    } catch (error) {
      console.error('Error getting email recipients:', error);
      return [];
    }
  };

  // Function to send email notifications
  const sendEmailNotifications = async (requestData) => {
    try {
      const { student, className, absenceDate, reason, customReason, parentName } = requestData;
      
      console.log('📤 Sending email notifications...');
      console.log('Request data:', { 
        studentName: student?.student_name, 
        classId: student?.class_id,
        className, 
        absenceDate, 
        reason: reason === 'Other' ? customReason : reason,
        parentName 
      });
      
      // Get recipients
      const recipients = await getEmailRecipients(student.class_id);
      
      if (recipients.length === 0) {
        console.warn('⚠️ No email recipients found for class:', student.class_id);
        toast.error('No teachers or admins found to notify');
        return;
      }

      // Format the date nicely
      const formattedDate = new Date(absenceDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Determine the final reason text
      const reasonText = reason === 'Other' ? customReason : reason;

      // Send email to each recipient
      const emailPromises = recipients.map(async (recipient) => {
        const templateParams = {
          to_email: recipient.email,
          to_name: recipient.name,
          recipient_role: recipient.role,
          student_name: student.student_name,
          class_name: className,
          absence_date: formattedDate,
          reason: reasonText,
          parent_name: parentName,
          submission_time: new Date().toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short'
          })
        };

        console.log(`📧 Sending to ${recipient.email} with params:`, templateParams);
        console.log(`Using Service: ${EMAILJS_SERVICE_ID}, Template: ${EMAILJS_TEMPLATE_ID}`);

        try {
          const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
          );
          console.log(`✅ Email sent successfully to ${recipient.email}`, response);
          return { success: true, email: recipient.email };
        } catch (emailError) {
          console.error(`❌ Failed to send email to ${recipient.email}:`);
          console.error('Error status:', emailError.status);
          console.error('Error text:', emailError.text);
          console.error('Full error:', emailError);
          return { success: false, email: recipient.email, error: emailError };
        }
      });

      const results = await Promise.all(emailPromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        console.log(`✅ Successfully sent ${successCount} notification email(s)`);
        toast.success(`Notification sent to ${successCount} recipient(s)`);
      }
      if (failCount > 0) {
        console.warn(`⚠️ Failed to send ${failCount} notification email(s)`);
        const failedEmails = results.filter(r => !r.success).map(r => r.email);
        console.warn('Failed emails:', failedEmails);
      }

      return results;
    } catch (error) {
      console.error('❌ Error sending email notifications:', error);
      toast.error('Failed to send email notifications');
      // Don't throw - we don't want email failures to break the request submission
      return [];
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
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to submit absence requests');
        return;
      }

      // Get parent profile for name from profiles table
      let parentName = 'Parent/Guardian';
      
      const { data: parentProfile, error: parentError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      if (parentError) {
        console.log('Could not fetch from profiles:', parentError.message);
        // Fallback: use email from auth user
        parentName = user.email || 'Parent/Guardian';
      } else if (parentProfile?.full_name) {
        parentName = parentProfile.full_name;
        console.log('Parent name found:', parentName);
      } else if (parentProfile?.email) {
        parentName = parentProfile.email;
        console.log('Using parent email as name:', parentName);
      } else {
        // Fallback to user email
        parentName = user.email || 'Parent/Guardian';
        console.log('Using auth email as fallback:', parentName);
      }
      
      if (editingRequest) {
        // Update existing request - check that it belongs to this parent's linked children
        const studentIds = linkedChildren.map(c => c.students?.id).filter(Boolean);
        
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
          .eq('id', editingRequest.id)
          .in('student_id', studentIds);

        if (error) {
          if (error.code === '23505') {
            toast.error('An absence request already exists for this date');
          } else {
            console.error('Update error:', error);
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

        // Send email notifications for new requests
        // Get class_id - it might be directly on student or we need to get it from the classes object
        const classId = student?.class_id || student?.classes?.id;
        
        console.log('📧 Preparing to send email notifications');
        console.log('Student object:', student);
        console.log('Class ID for email:', classId);
        
        if (classId) {
          await sendEmailNotifications({
            student: { ...student, class_id: classId },
            className: student?.classes?.name || 'Unknown Class',
            absenceDate: formData.absenceDate,
            reason: formData.reason,
            customReason: formData.customReason,
            parentName: parentName
          });
        } else {
          console.error('❌ Cannot send emails - no class_id found for student');
          toast.error('Could not notify teachers - class information missing');
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

  const handleDelete = async (request) => {
    if (!window.confirm('Are you sure you want to withdraw this absence request?')) {
      return;
    }

    setDeletingRequest(request.id);

    try {
      const studentIds = linkedChildren.map(c => c.students?.id).filter(Boolean);
      
      const { error } = await supabase
        .from('absence_requests')
        .delete()
        .eq('id', request.id)
        .in('student_id', studentIds);

      if (error) throw error;

      toast.success('Absence request withdrawn successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Error withdrawing absence request');
    } finally {
      setDeletingRequest(null);
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'approved':
        return { 
          icon: Check, 
          label: 'Approved', 
          color: '#10b981', 
          bg: '#d1fae5' 
        };
      case 'rejected':
        return { 
          icon: X, 
          label: 'Rejected', 
          color: '#ef4444', 
          bg: '#fee2e2' 
        };
      default:
        return { 
          icon: Clock, 
          label: 'Pending', 
          color: '#f59e0b', 
          bg: '#fef3c7' 
        };
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        color: '#64748b'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '3px solid #e2e8f0',
          borderTop: '3px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginRight: '12px'
        }}></div>
        Loading absence requests...
      </div>
    );
  }

  if (!linkedChildren || linkedChildren.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <AlertCircle style={{ 
          width: '48px', 
          height: '48px', 
          marginBottom: '16px',
          color: '#94a3b8'
        }} />
        <p>No linked children found. Please link your children first to submit absence requests.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0
            }}>Absence Requests</h2>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              margin: 0
            }}>Notify the school when your child will be absent</p>
          </div>
        </div>
        
        {!showForm && (
          <button
            onClick={() => {
              setEditingRequest(null);
              setFormData({
                studentId: linkedChildren[0]?.students?.id || '',
                absenceDate: '',
                reason: '',
                customReason: ''
              });
              setShowForm(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
            }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            New Request
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '20px'
          }}>
            {editingRequest ? 'Edit Absence Request' : 'Submit New Absence Request'}
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Student Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Select Child *
                </label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b',
                    background: 'white',
                    colorScheme: 'light'
                  }}
                  required
                >
                  <option value="" style={{ color: '#1e293b', background: 'white' }}>Select a child...</option>
                  {linkedChildren.map(child => (
                    <option key={child.students?.id} value={child.students?.id} style={{ color: '#1e293b', background: 'white' }}>
                      {child.students?.student_name} - {child.students?.classes?.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Absence Date *
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '18px',
                    height: '18px',
                    color: '#64748b'
                  }} />
                  <input
                    type="date"
                    value={formData.absenceDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, absenceDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#1e293b'
                    }}
                    required
                  />
                </div>
              </div>

              {/* Reason Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Reason for Absence *
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b',
                    background: 'white',
                    colorScheme: 'light'
                  }}
                  required
                >
                  <option value="" style={{ color: '#1e293b', background: 'white' }}>Select a reason...</option>
                  {absenceReasons.map(reason => (
                    <option key={reason.id} value={reason.reason_text} style={{ color: '#1e293b', background: 'white' }}>
                      {reason.reason_text}
                    </option>
                  ))}
                  <option value="Other" style={{ color: '#1e293b', background: 'white' }}>Other (please specify)</option>
                </select>
              </div>

              {/* Custom Reason */}
              {formData.reason === 'Other' && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Please Specify *
                  </label>
                  <textarea
                    value={formData.customReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, customReason: e.target.value }))}
                    placeholder="Please provide details about the absence..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#1e293b',
                      resize: 'vertical'
                    }}
                    required
                  />
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRequest(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: 'white',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: submitting 
                    ? '#94a3b8' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {submitting ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Submitting...
                  </>
                ) : (
                  editingRequest ? 'Update Request' : 'Submit Request'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      <div>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '16px'
        }}>
          {requests.length === 0 ? 'No Requests Yet' : `Your Requests (${requests.length})`}
        </h3>

        {requests.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px 20px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <Calendar style={{ 
              width: '48px', 
              height: '48px', 
              marginBottom: '16px',
              color: '#94a3b8'
            }} />
            <p style={{ color: '#64748b', margin: 0 }}>
              You haven't submitted any absence requests yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {requests.map(request => {
              const statusInfo = getStatusInfo(request.status);
              const StatusIcon = statusInfo.icon;
              
              // Get display info - handle both orphaned and normal requests
              const displayInfo = request.student_id && request.students ? {
                studentName: request.students.student_name,
                className: request.students.classes?.name || 'Unknown Class',
                isOrphaned: false
              } : {
                studentName: request.student_name || 'Unknown Student',
                className: 'Class data needs update',
                isOrphaned: true
              };
              
              return (
                <div
                  key={request.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {displayInfo.isOrphaned && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '8px 12px',
                      background: '#fef3c7',
                      borderRadius: '6px',
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