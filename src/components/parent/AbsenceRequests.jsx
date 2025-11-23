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
    studentIds: [], // Changed to array to support multiple selections
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

      // No need to set default - let user select children

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading absence requests');
    } finally {
      setLoading(false);
    }
  };

  // Function to get teachers and admins for email notification
  const getEmailRecipients = async (classId, className = 'Unknown Class') => {
    try {
      // Get ALL teachers assigned to this class (including multiple teachers per class)
      // NOTE: Multiple teachers can have the same default_class_id, so this query
      // will return ALL teachers who teach this class
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, status, role, default_class_id')
        .eq('default_class_id', classId)
        .eq('role', 'teacher')
        .eq('status', 'active')
        .order('full_name');

      if (teachersError) {
        console.error('Error fetching teachers:', teachersError);
      }

      // Get all admins (they receive notifications for all classes)
      const { data: adminsData, error: adminsError } = await supabase
        .from('profiles')
        .select('id, email, full_name, status, role')
        .eq('role', 'admin')
        .eq('status', 'active')
        .order('full_name');

      if (adminsError) {
        console.error('Error fetching admins:', adminsError);
      }

      // Combine and deduplicate recipients (using Map to avoid duplicates)
      const recipients = new Map();

      // Add ALL teachers for this class
      if (teachersData && teachersData.length > 0) {
        teachersData.forEach(teacher => {
          if (teacher.email) {
            recipients.set(teacher.id, {
              email: teacher.email,
              name: teacher.full_name || 'Teacher',
              role: 'teacher',
              classId: teacher.default_class_id
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

      // Get recipients for this specific student's class
      const recipients = await getEmailRecipients(student.class_id, className);

      if (recipients.length === 0) {
        console.warn(`No email recipients found for ${student.student_name}'s class: ${className}`);
        return [];
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

        try {
          const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
          );
          return { success: true, email: recipient.email, name: recipient.name, role: recipient.role };
        } catch (emailError) {
          console.error(`Failed to send email to ${recipient.email}:`, emailError);
          return { success: false, email: recipient.email, name: recipient.name, role: recipient.role, error: emailError };
        }
      });

      const results = await Promise.all(emailPromises);
      return results;
    } catch (error) {
      console.error('Error sending email notifications:', error);
      // Don't throw - we don't want email failures to break the request submission
      return [];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.studentIds.length === 0 || !formData.absenceDate || !formData.reason) {
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
        parentName = user.email || 'Parent/Guardian';
      } else if (parentProfile?.full_name) {
        parentName = parentProfile.full_name;
      } else if (parentProfile?.email) {
        parentName = parentProfile.email;
      } else {
        parentName = user.email || 'Parent/Guardian';
      }

      if (editingRequest) {
        // Editing mode only works for single student (keep original behavior)
        const studentId = formData.studentIds[0];
        const parentChild = linkedChildren.find(c => c.students?.id === studentId);
        const student = parentChild?.students;
        const studentIds = linkedChildren.map(c => c.students?.id).filter(Boolean);

        const { error } = await supabase
          .from('absence_requests')
          .update({
            student_id: studentId,
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
        // Create new requests for all selected students
        const requestsToInsert = [];
        const studentsForEmail = [];

        for (const studentId of formData.studentIds) {
          const parentChild = linkedChildren.find(c => c.students?.id === studentId);
          const student = parentChild?.students;

          if (student) {
            requestsToInsert.push({
              parent_id: parentChild.parent_id,
              student_id: studentId,
              student_name: student.student_name,
              class_id: student.class_id,
              absence_date: formData.absenceDate,
              reason: formData.reason,
              custom_reason: formData.reason === 'Other' ? formData.customReason : null,
              status: 'pending'
            });

            studentsForEmail.push({
              ...student,
              class_id: student.class_id || student.classes?.id,
              className: student.classes?.name || 'Unknown Class'
            });
          }
        }

        // Insert all requests
        const { error } = await supabase
          .from('absence_requests')
          .insert(requestsToInsert);

        if (error) {
          if (error.code === '23505') {
            toast.error('One or more absence requests already exist for this date');
          } else {
            throw error;
          }
          return;
        }

        // Send email notifications for all students
        const emailResults = [];
        for (const student of studentsForEmail) {
          if (student.class_id) {
            try {
              const result = await sendEmailNotifications({
                student: student,
                className: student.className,
                absenceDate: formData.absenceDate,
                reason: formData.reason,
                customReason: formData.customReason,
                parentName: parentName
              });

              const successfulEmails = result?.filter(r => r.success).length || 0;
              emailResults.push({
                studentName: student.student_name,
                className: student.className,
                success: true,
                recipientCount: result?.length || 0,
                successfulEmails: successfulEmails,
                failedEmails: (result?.length || 0) - successfulEmails
              });
            } catch (emailError) {
              console.error(`Failed to send emails for ${student.student_name}:`, emailError);
              emailResults.push({
                studentName: student.student_name,
                className: student.className,
                success: false,
                error: emailError,
                recipientCount: 0,
                successfulEmails: 0,
                failedEmails: 0
              });
            }
          } else {
            console.warn(`Skipping email for ${student.student_name} - no class_id found`);
          }
        }

        const studentCount = formData.studentIds.length;
        const successCount = emailResults.filter(r => r.success).length;
        const totalRecipients = emailResults.reduce((sum, r) => sum + (r.recipientCount || 0), 0);

        // Show appropriate success message
        if (studentCount === 1) {
          toast.success(`Absence request submitted and ${totalRecipients} teacher(s)/admin(s) notified!`);
        } else {
          if (successCount === emailResults.length) {
            toast.success(`${studentCount} absence requests submitted! ${totalRecipients} teacher(s)/admin(s) notified across ${successCount} classes.`);
          } else if (successCount > 0) {
            toast.success(`${studentCount} absence requests submitted! ${successCount}/${emailResults.length} classes notified successfully.`);
          } else {
            toast.success(`${studentCount} absence requests submitted! (Email notifications failed - please contact admin)`);
          }
        }
      }

      setShowForm(false);
      setFormData({
        studentIds: [],
        absenceDate: '',
        reason: '',
        customReason: ''
      });
      loadData();
      if (onRequestSubmitted) onRequestSubmitted();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error(editingRequest ? 'Error updating absence request' : 'Error submitting absence requests');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (request) => {
    setEditingRequest(request);
    setFormData({
      studentIds: [request.student_id], // Edit mode: single student only
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

  const isMobile = window.innerWidth < 768;

  return (
    <div style={{
      padding: isMobile ? '0' : '0'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: isMobile ? '12px' : '16px',
        padding: isMobile ? '16px' : '20px',
        marginBottom: isMobile ? '16px' : '24px',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px', marginBottom: '12px' }}>
          <div style={{
            width: isMobile ? '36px' : '40px',
            height: isMobile ? '36px' : '40px',
            minWidth: isMobile ? '36px' : '40px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <FileText style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: 'white' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: 'white',
              margin: 0,
              lineHeight: '1.3'
            }}>Absence Requests</h2>
            <p style={{
              fontSize: isMobile ? '12px' : '13px',
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0,
              lineHeight: '1.4'
            }}>Notify the class teachers' when your child will be absent</p>
          </div>
        </div>

        {!showForm && (
          <button
            onClick={() => {
              setEditingRequest(null);
              setFormData({
                studentIds: [],
                absenceDate: '',
                reason: '',
                customReason: ''
              });
              setShowForm(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: isMobile ? '12px 16px' : '14px 20px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              width: '100%'
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
          background: '#f8fafc',
          borderRadius: isMobile ? '12px' : '16px',
          padding: isMobile ? '16px' : '24px',
          marginBottom: isMobile ? '16px' : '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: isMobile ? '12px' : '8px'
          }}>
            {editingRequest ? 'Edit Absence Request' : 'Submit New Absence Request'}
          </h3>
          {!editingRequest && linkedChildren.length > 1 && (
            <div style={{
              padding: isMobile ? '10px' : '12px',
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              borderRadius: '8px',
              marginBottom: isMobile ? '12px' : '16px',
              border: 'none',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.15)'
            }}>
              <p style={{
                fontSize: isMobile ? '12px' : '13px',
                color: '#1e40af',
                margin: 0,
                display: 'flex',
                alignItems: 'flex-start',
                gap: isMobile ? '6px' : '8px',
                lineHeight: '1.5'
              }}>
                <span style={{ fontSize: isMobile ? '14px' : '16px', flexShrink: 0 }}>💡</span>
                <span>
                  <strong>Tip:</strong> {isMobile ? 'Select multiple children for the same absence!' : 'If multiple children will be absent for the same reason (e.g., family holiday), you can select all of them at once to save time!'}
                </span>
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: isMobile ? '14px' : '16px' }}>
              {/* Student Selection - Multiple Checkboxes */}
              <div style={{
                background: 'white',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  marginBottom: isMobile ? '10px' : '12px',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '8px' : '0'
                }}>
                  <label style={{
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}>
                    {editingRequest ? 'Child' : 'Select Children'} * {formData.studentIds.length > 0 && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: 'white',
                        marginLeft: '6px',
                        background: '#667eea',
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        {formData.studentIds.length}
                      </span>
                    )}
                  </label>
                  {linkedChildren.length > 1 && !editingRequest && (
                    <div style={{ display: 'flex', gap: '6px', width: isMobile ? '100%' : 'auto' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = linkedChildren.map(c => c.students?.id).filter(Boolean);
                          setFormData(prev => ({ ...prev, studentIds: allIds }));
                        }}
                        style={{
                          padding: isMobile ? '6px 12px' : '4px 12px',
                          background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                          color: '#4338ca',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          flex: isMobile ? 1 : 'auto'
                        }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, studentIds: [] }))}
                        style={{
                          padding: isMobile ? '6px 12px' : '4px 12px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          flex: isMobile ? 1 : 'auto'
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                <div style={{
                  borderRadius: '8px',
                  padding: 0,
                  background: 'transparent',
                  display: 'grid',
                  gap: isMobile ? '8px' : '10px'
                }}>
                  {linkedChildren.map(child => {
                    const isSelected = formData.studentIds.includes(child.students?.id);
                    const isDisabled = editingRequest && !isSelected;

                    return (
                      <label
                        key={child.students?.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isMobile ? '10px' : '12px',
                          padding: isMobile ? '10px' : '12px',
                          background: isSelected
                            ? 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%)'
                            : isDisabled ? '#f1f5f9' : '#f8fafc',
                          borderRadius: '8px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          border: `2px solid ${isSelected ? '#667eea' : '#e2e8f0'}`,
                          transition: 'all 0.2s',
                          opacity: isDisabled ? 0.5 : 1,
                          boxShadow: isSelected ? '0 2px 4px rgba(102, 126, 234, 0.15)' : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected && !isDisabled) {
                            e.currentTarget.style.background = '#f1f5f9';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected && !isDisabled) {
                            e.currentTarget.style.background = '#f8fafc';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            if (!editingRequest) {
                              const studentId = child.students?.id;
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  studentIds: [...prev.studentIds, studentId]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  studentIds: prev.studentIds.filter(id => id !== studentId)
                                }));
                              }
                            }
                          }}
                          style={{
                            width: isMobile ? '20px' : '18px',
                            height: isMobile ? '20px' : '18px',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            accentColor: '#667eea',
                            flexShrink: 0
                          }}
                        />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: isMobile ? '13px' : '14px',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>
                          {child.students?.student_name}
                        </div>
                        <div style={{
                          fontSize: isMobile ? '11px' : '12px',
                          color: '#64748b',
                          marginTop: '2px'
                        }}>
                          {child.students?.classes?.name}
                        </div>
                      </div>
                    </label>
                    );
                  })}
                </div>
                {formData.studentIds.length === 0 && (
                  <div style={{
                    fontSize: '12px',
                    color: '#ef4444',
                    marginTop: '6px'
                  }}>
                    Please select at least one child
                  </div>
                )}
              </div>

              {/* Date Selection */}
              <div style={{
                background: 'white',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: isMobile ? '8px' : '6px'
                }}>
                  Absence Date *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={formData.absenceDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, absenceDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: isMobile ? '13px' : '14px',
                      color: '#1e293b',
                      background: '#f8fafc'
                    }}
                    required
                  />
                </div>
              </div>

              {/* Reason Selection */}
              <div style={{
                background: 'white',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: isMobile ? '8px' : '6px'
                }}>
                  Reason for Absence *
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: isMobile ? '13px' : '14px',
                    color: '#1e293b',
                    background: '#f8fafc',
                    colorScheme: 'light'
                  }}
                  required
                >
                  <option value="" style={{ color: '#1e293b', background: 'white' }}>Select a reason...</option>
                  {absenceReasons.map(reason => (
                    <option key={reason.id} value={reason.reason} style={{ color: '#1e293b', background: 'white' }}>
                      {reason.reason}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Reason */}
              {formData.reason === 'Other' && (
                <div style={{
                  background: 'white',
                  borderRadius: '10px',
                  padding: isMobile ? '12px' : '16px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: isMobile ? '8px' : '6px'
                  }}>
                    ✏️ Please Specify *
                  </label>
                  <textarea
                    value={formData.customReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, customReason: e.target.value }))}
                    placeholder="Please provide details about the absence..."
                    rows={isMobile ? 3 : 3}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: isMobile ? '13px' : '14px',
                      color: '#1e293b',
                      resize: 'vertical',
                      background: '#f8fafc'
                    }}
                    required
                  />
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div style={{
              display: 'flex',
              gap: isMobile ? '8px' : '12px',
              marginTop: isMobile ? '16px' : '24px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRequest(null);
                }}
                style={{
                  flex: 1,
                  padding: isMobile ? '10px 16px' : '12px 20px',
                  background: 'white',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: isMobile ? '10px 16px' : '12px 20px',
                  background: submitting
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: submitting ? 'none' : '0 4px 6px rgba(102, 126, 234, 0.3)'
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
          fontSize: isMobile ? '15px' : '16px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: isMobile ? '12px' : '16px',
          padding: isMobile ? '0 4px' : '0'
        }}>
          {requests.length === 0 ? 'No Requests Yet' : `Your Requests (${requests.length})`}
        </h3>

        {requests.length === 0 ? (
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: isMobile ? '12px' : '16px',
            padding: isMobile ? '32px 20px' : '48px 24px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <Calendar style={{
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              marginBottom: '16px',
              color: '#94a3b8'
            }} />
            <p style={{
              color: '#64748b',
              margin: 0,
              fontSize: isMobile ? '13px' : '14px',
              lineHeight: '1.5'
            }}>
              You haven't submitted any absence requests yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: isMobile ? '12px' : '16px' }}>
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
                    borderRadius: isMobile ? '10px' : '12px',
                    padding: isMobile ? '14px' : '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)'
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
                    marginBottom: isMobile ? '10px' : '12px',
                    gap: isMobile ? '8px' : '12px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{
                        fontSize: isMobile ? '14px' : '16px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {displayInfo.studentName}
                      </h4>
                      <p style={{
                        fontSize: isMobile ? '12px' : '13px',
                        color: displayInfo.isOrphaned ? '#92400e' : '#64748b',
                        margin: 0,
                        fontStyle: displayInfo.isOrphaned ? 'italic' : 'normal'
                      }}>
                        {displayInfo.className}
                      </p>
                    </div>
                    <div style={{
                      padding: isMobile ? '5px 10px' : '6px 12px',
                      borderRadius: '6px',
                      background: statusInfo.bg,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0
                    }}>
                      <StatusIcon style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: statusInfo.color }} />
                      <span style={{
                        fontSize: isMobile ? '11px' : '12px',
                        fontWeight: '600',
                        color: statusInfo.color,
                        whiteSpace: 'nowrap'
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gap: isMobile ? '6px' : '8px',
                    fontSize: isMobile ? '13px' : '14px',
                    background: '#f8fafc',
                    padding: isMobile ? '10px' : '12px',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#64748b', fontWeight: '600', fontSize: isMobile ? '12px' : '13px' }}>📅 Date:</span>
                      <span style={{ color: '#1e293b', fontSize: isMobile ? '12px' : '13px' }}>{formatDate(request.absence_date)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#64748b', fontWeight: '600', fontSize: isMobile ? '12px' : '13px' }}>📋 Reason:</span>
                      <span style={{ color: '#1e293b', fontSize: isMobile ? '12px' : '13px', flex: 1 }}>
                        {request.reason === 'Other' ? request.custom_reason : request.reason}
                      </span>
                    </div>
                    {request.reviewed_at && (
                      <>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#64748b', fontWeight: '600', fontSize: isMobile ? '12px' : '13px' }}>Reviewed by:</span>
                          <span style={{ color: '#1e293b', fontSize: isMobile ? '12px' : '13px' }}>{request.reviewer?.full_name || 'Teacher'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#64748b', fontWeight: '600', fontSize: isMobile ? '12px' : '13px' }}>Reviewed on:</span>
                          <span style={{ color: '#1e293b', fontSize: isMobile ? '12px' : '13px' }}>{formatDate(request.reviewed_at)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {request.review_notes && (
                    <div style={{
                      marginTop: isMobile ? '8px' : '10px',
                      padding: isMobile ? '10px' : '12px',
                      background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                      borderRadius: '8px',
                      borderLeft: '3px solid #8b5cf6'
                    }}>
                      <span style={{ color: '#5b21b6', fontWeight: '600', fontSize: isMobile ? '11px' : '12px' }}>💬 Teacher's Note:</span>
                      <p style={{ color: '#6b21a8', margin: '4px 0 0 0', fontSize: isMobile ? '12px' : '13px', lineHeight: '1.4' }}>
                        {request.review_notes}
                      </p>
                    </div>
                  )}

                  {/* Action buttons for pending requests */}
                  {request.status === 'pending' && (
                    <div style={{
                      marginTop: isMobile ? '12px' : '16px',
                      paddingTop: isMobile ? '12px' : '16px',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      gap: isMobile ? '6px' : '8px'
                    }}>
                      <button
                        onClick={() => handleEdit(request)}
                        disabled={deletingRequest === request.id}
                        style={{
                          flex: 1,
                          padding: isMobile ? '8px 12px' : '10px 16px',
                          background: 'white',
                          color: '#667eea',
                          border: '2px solid #667eea',
                          borderRadius: '8px',
                          fontSize: isMobile ? '12px' : '14px',
                          fontWeight: '600',
                          cursor: deletingRequest === request.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: isMobile ? '4px' : '6px',
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
                        <Edit2 style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
                        {!isMobile && 'Edit'}
                      </button>
                      <button
                        onClick={() => handleDelete(request)}
                        disabled={deletingRequest === request.id}
                        style={{
                          flex: 1,
                          padding: isMobile ? '8px 12px' : '10px 16px',
                          background: 'white',
                          color: '#ef4444',
                          border: '2px solid #ef4444',
                          borderRadius: '8px',
                          fontSize: isMobile ? '12px' : '14px',
                          fontWeight: '600',
                          cursor: deletingRequest === request.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: isMobile ? '4px' : '6px',
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
                              width: isMobile ? '14px' : '16px',
                              height: isMobile ? '14px' : '16px',
                              border: '2px solid #ef444440',
                              borderTop: '2px solid #ef4444',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }}></div>
                            {!isMobile && 'Withdrawing...'}
                          </>
                        ) : (
                          <>
                            <Trash2 style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
                            {!isMobile && 'Withdraw'}
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