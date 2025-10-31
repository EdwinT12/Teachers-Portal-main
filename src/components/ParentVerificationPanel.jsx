import { useEffect, useState } from 'react';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';
import { Users, Check, X, AlertCircle, Plus, Edit2, Trash2, Filter, RefreshCw } from 'lucide-react';

const ParentVerificationPanel = () => {
  const [loading, setLoading] = useState(true);
  const [pendingLinks, setPendingLinks] = useState([]);
  const [verifiedLinks, setVerifiedLinks] = useState([]);
  const [allParents, setAllParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState({});
  const [selectedYear, setSelectedYear] = useState({});
  const [processing, setProcessing] = useState(null);
  
  // For adding new link
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLink, setNewLink] = useState({
    parentId: '',
    yearGroup: '',
    studentId: '',
    childName: '' // Added for better tracking
  });
  const [addingLink, setAddingLink] = useState(false);

  // For editing existing link
  const [editingLink, setEditingLink] = useState(null);
  const [editData, setEditData] = useState({
    yearGroup: '',
    studentId: ''
  });

  // For deleting links
  const [deletingLink, setDeletingLink] = useState(null);

  // For showing link status
  const [linkStatus, setLinkStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('year_level')
        .order('name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Load all students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          *,
          classes:class_id (
            id,
            name,
            year_level
          )
        `)
        .order('student_name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Load all parents (for add functionality)
      const { data: parentsData, error: parentsError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'parent')
        .order('full_name');

      if (parentsError) throw parentsError;
      setAllParents(parentsData || []);

      // Load pending parent-child links
      const { data: pendingData, error: pendingError } = await supabase
        .from('parent_children')
        .select(`
          *,
          parent:parent_id (
            id,
            full_name,
            email
          )
        `)
        .eq('verified', false)
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;
      setPendingLinks(pendingData || []);

      // Load verified links (recent 50 for editing)
      const { data: verifiedData, error: verifiedError } = await supabase
        .from('parent_children')
        .select(`
          *,
          parent:parent_id (
            id,
            full_name,
            email
          ),
          students:student_id (
            id,
            student_name,
            classes:class_id (
              id,
              name,
              year_level
            )
          )
        `)
        .eq('verified', true)
        .order('verified_at', { ascending: false })
        .limit(50);

      if (verifiedError) throw verifiedError;
      setVerifiedLinks(verifiedData || []);

      // Check link status
      await checkLinkStatus();

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading parent verification data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check the status of all parent-child links
   */
  const checkLinkStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('v_parent_child_status')
        .select('link_status');

      if (error) throw error;

      // Count by status
      const statusCount = data.reduce((acc, item) => {
        acc[item.link_status] = (acc[item.link_status] || 0) + 1;
        return acc;
      }, {});

      setLinkStatus(statusCount);
    } catch (error) {
      console.error('Error checking link status:', error);
    }
  };

  /**
   * Enhanced verify function that also sets class_id and updates child_name_submitted
   */
  const handleVerify = async (linkId, parentId) => {
    const studentId = selectedStudent[linkId];
    
    if (!studentId) {
      toast.error('Please select a student to link');
      return;
    }

    setProcessing(linkId);

    try {
      // Get the student's details
      const student = students.find(s => s.id === studentId);
      if (!student) {
        throw new Error('Selected student not found');
      }

      // Update with student_id, class_id, AND overwrite child_name_submitted with actual student name
      const { error } = await supabase
        .from('parent_children')
        .update({
          student_id: studentId,
          class_id: student.class_id, // ← Important: Set class_id for future remapping
          child_name_submitted: student.student_name, // ← Overwrite with actual student name for perfect future matching
          verified: true,
          verified_at: new Date().toISOString(),
          verified_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', linkId);

      if (error) throw error;

      toast.success('✓ Parent verified and linked to student (name updated for future accuracy)');
      await loadData();

    } catch (error) {
      console.error('Error verifying parent:', error);
      toast.error('Error verifying parent');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (linkId) => {
    if (!window.confirm('Are you sure you want to reject this link request?')) {
      return;
    }

    setProcessing(linkId);

    try {
      const { error } = await supabase
        .from('parent_children')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      toast.success('Link request rejected');
      await loadData();

    } catch (error) {
      console.error('Error rejecting link:', error);
      toast.error('Error rejecting link request');
    } finally {
      setProcessing(null);
    }
  };

  /**
   * Add new parent-child link
   */
  const handleAddNewLink = async () => {
    if (!newLink.parentId || !newLink.studentId) {
      toast.error('Please select both parent and student');
      return;
    }

    setAddingLink(true);

    try {
      // Get student details
      const student = students.find(s => s.id === newLink.studentId);
      if (!student) {
        throw new Error('Selected student not found');
      }

      // Get parent details
      const parent = allParents.find(p => p.id === newLink.parentId);
      if (!parent) {
        throw new Error('Selected parent not found');
      }

      // Check if link already exists
      const { data: existingLinks, error: checkError } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', newLink.parentId)
        .eq('student_id', newLink.studentId);

      if (checkError) throw checkError;

      if (existingLinks && existingLinks.length > 0) {
        toast.error('This parent-child link already exists');
        return;
      }

      // Create new parent-child link
      const { error } = await supabase
        .from('parent_children')
        .insert({
          parent_id: newLink.parentId,
          student_id: newLink.studentId,
          class_id: student.class_id,
          year_group: student.classes?.year_level?.toString() || '',
          child_name_submitted: student.student_name,
          verified: true,
          verified_at: new Date().toISOString(),
          verified_by: (await supabase.auth.getUser()).data.user?.id,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success(`✓ Successfully linked ${parent.full_name} to ${student.student_name}`);
      
      // Reset form and close modal
      setNewLink({
        parentId: '',
        yearGroup: '',
        studentId: '',
        childName: ''
      });
      setShowAddModal(false);
      
      await loadData();

    } catch (error) {
      console.error('Error adding new link:', error);
      toast.error(error.message || 'Error creating parent-child link');
    } finally {
      setAddingLink(false);
    }
  };

  /**
   * Reset add form
   */
  const resetAddForm = () => {
    setNewLink({
      parentId: '',
      yearGroup: '',
      studentId: '',
      childName: ''
    });
    setShowAddModal(false);
  };

  /**
   * Start editing a verified link
   */
  const startEditing = (link) => {
    setEditingLink(link.id);
    setEditData({
      yearGroup: link.students?.classes?.year_level?.toString() || '',
      studentId: link.student_id || ''
    });
  };

  /**
   * Cancel editing
   */
  const cancelEditing = () => {
    setEditingLink(null);
    setEditData({ yearGroup: '', studentId: '' });
  };

  /**
   * Save edited link
   */
  const handleSaveEdit = async (linkId) => {
    if (!editData.studentId) {
      toast.error('Please select a student');
      return;
    }

    setProcessing(linkId);

    try {
      // Get the selected student's details
      const student = students.find(s => s.id === editData.studentId);
      if (!student) {
        throw new Error('Selected student not found');
      }

      // Update the parent_children record
      const { error } = await supabase
        .from('parent_children')
        .update({
          student_id: editData.studentId,
          class_id: student.class_id,
          year_group: student.classes?.year_level?.toString() || editData.yearGroup,
          child_name_submitted: student.student_name, // Update name for future matching
          updated_at: new Date().toISOString()
        })
        .eq('id', linkId);

      if (error) throw error;

      toast.success('✓ Parent-child link updated successfully');
      setEditingLink(null);
      setEditData({ yearGroup: '', studentId: '' });
      await loadData();

    } catch (error) {
      console.error('Error updating link:', error);
      toast.error('Error updating parent-child link');
    } finally {
      setProcessing(null);
    }
  };

  /**
   * Delete a parent-child link
   */
  const handleDeleteLink = async (linkId, parentName, childName) => {
    if (!window.confirm(`Are you sure you want to delete the link between "${parentName}" and "${childName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeletingLink(linkId);

    try {
      const { error } = await supabase
        .from('parent_children')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      toast.success('✓ Parent-child link deleted successfully');
      await loadData();

    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Error deleting parent-child link');
    } finally {
      setDeletingLink(null);
    }
  };

  /**
   * Remap all broken links
   */
  const handleRemapAll = async () => {
    if (!window.confirm('Attempt to automatically fix all broken parent-child links?')) {
      return;
    }

    try {
      toast.loading('Remapping links...', { id: 'remap' });

      const { data, error } = await supabase.rpc('remap_parent_student_links');

      if (error) throw error;

      const result = data[0];

      toast.dismiss('remap');

      if (result.remapped_count > 0) {
        toast.success(
          `✓ Re-linked ${result.remapped_count} parent-child relationship${result.remapped_count > 1 ? 's' : ''}`,
          { duration: 5000 }
        );
      }

      if (result.failed_count > 0) {
        toast.error(
          `⚠ ${result.failed_count} relationship${result.failed_count > 1 ? 's' : ''} need manual attention`,
          { duration: 7000 }
        );
      }

      // Show detailed results in console
      console.log('Remap Results:', result.details);

      await loadData();

    } catch (error) {
      toast.dismiss('remap');
      console.error('Error remapping links:', error);
      toast.error('Failed to remap links. Check console for details.');
    }
  };

  const getFilteredStudents = (yearGroup) => {
    if (!yearGroup) return students;
    
    return students.filter(s => s.classes?.year_level === parseInt(yearGroup));
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px',
        minHeight: '400px'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            margin: '0 auto 16px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading verification panel...</p>
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
  }

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header with Status Summary */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px',
        gap: '24px',
        flexWrap: 'wrap'
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#1e293b',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Users style={{ width: '32px', height: '32px', color: '#667eea' }} />
            Parent Verification
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#64748b',
            margin: 0
          }}>
            Review and approve parent-child link requests
          </p>
        </div>

        {/* Status Cards */}
        {linkStatus && (
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {linkStatus.VALID > 0 && (
              <div style={{
                padding: '12px 16px',
                background: '#f0fdf4',
                borderRadius: '8px',
                border: '2px solid #86efac'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a' }}>
                  {linkStatus.VALID}
                </div>
                <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
                  Valid Links
                </div>
              </div>
            )}
            {linkStatus.BROKEN_LINK > 0 && (
              <div style={{
                padding: '12px 16px',
                background: '#fee2e2',
                borderRadius: '8px',
                border: '2px solid #fca5a5'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626' }}>
                  {linkStatus.BROKEN_LINK}
                </div>
                <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '600' }}>
                  Broken Links
                </div>
              </div>
            )}
            {linkStatus.PENDING_VERIFICATION > 0 && (
              <div style={{
                padding: '12px 16px',
                background: '#fef3c7',
                borderRadius: '8px',
                border: '2px solid #fcd34d'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706' }}>
                  {linkStatus.PENDING_VERIFICATION}
                </div>
                <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '600' }}>
                  Pending
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '12px 20px',
            background: '#10b981',
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
            e.target.style.background = '#059669';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#10b981';
          }}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          Add New Link
        </button>

        <button
          onClick={handleRemapAll}
          style={{
            padding: '12px 20px',
            background: '#667eea',
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
            e.target.style.background = '#5568d3';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#667eea';
          }}
        >
          <RefreshCw style={{ width: '16px', height: '16px' }} />
          Auto-Fix Broken Links
        </button>

        <button
          onClick={loadData}
          style={{
            padding: '12px 20px',
            background: 'white',
            color: '#667eea',
            border: '2px solid #667eea',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <RefreshCw style={{ width: '16px', height: '16px' }} />
          Refresh
        </button>
      </div>

      {/* Add New Link Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Plus style={{ width: '24px', height: '24px', color: '#10b981' }} />
              Add New Parent-Child Link
            </h2>

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Parent Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Select Parent *
                </label>
                <select
                  value={newLink.parentId}
                  onChange={(e) => setNewLink({
                    ...newLink,
                    parentId: e.target.value
                  })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    cursor: 'pointer',
                    background: 'white'
                  }}
                >
                  <option value="">-- Select Parent --</option>
                  {allParents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.full_name} ({parent.email})
                    </option>
                  ))}
                </select>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '4px'
                }}>
                  {allParents.length} parent{allParents.length !== 1 ? 's' : ''} available
                </div>
              </div>

              {/* Year Group Filter (Optional) */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Filter by Year Group (Optional)
                </label>
                <select
                  value={newLink.yearGroup}
                  onChange={(e) => setNewLink({
                    ...newLink,
                    yearGroup: e.target.value,
                    studentId: '' // Reset student when year changes
                  })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    cursor: 'pointer',
                    background: 'white'
                  }}
                >
                  <option value="">All Years</option>
                  {[...new Set(students.map(s => s.classes?.year_level).filter(Boolean))]
                    .sort((a, b) => a - b)
                    .map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))
                  }
                </select>
              </div>

              {/* Student Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Select Student *
                </label>
                <select
                  value={newLink.studentId}
                  onChange={(e) => {
                    const studentId = e.target.value;
                    const student = students.find(s => s.id === studentId);
                    setNewLink({
                      ...newLink,
                      studentId,
                      childName: student ? student.student_name : ''
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    cursor: 'pointer',
                    background: 'white'
                  }}
                >
                  <option value="">-- Select Student --</option>
                  {getFilteredStudents(newLink.yearGroup).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.student_name} - {student.classes?.name} (Year {student.classes?.year_level})
                    </option>
                  ))}
                </select>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '4px'
                }}>
                  {getFilteredStudents(newLink.yearGroup).length} student{getFilteredStudents(newLink.yearGroup).length !== 1 ? 's' : ''} available
                  {newLink.yearGroup && ` in Year ${newLink.yearGroup}`}
                </div>
              </div>

              {/* Preview */}
              {newLink.parentId && newLink.studentId && (
                <div style={{
                  padding: '16px',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  border: '2px solid #86efac'
                }}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#15803d',
                    marginBottom: '8px'
                  }}>
                    Link Preview:
                  </h4>
                  <div style={{
                    fontSize: '13px',
                    color: '#166534'
                  }}>
                    <strong>{allParents.find(p => p.id === newLink.parentId)?.full_name}</strong> will be linked to <strong>{students.find(s => s.id === newLink.studentId)?.student_name}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '32px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={resetAddForm}
                disabled={addingLink}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  color: '#6b7280',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewLink}
                disabled={addingLink || !newLink.parentId || !newLink.studentId}
                style={{
                  padding: '12px 24px',
                  background: (newLink.parentId && newLink.studentId) ? '#10b981' : '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (newLink.parentId && newLink.studentId) ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: addingLink ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {addingLink ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff40',
                      borderTop: '2px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Check style={{ width: '16px', height: '16px' }} />
                    Create Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Verification Section */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
          Pending Verification ({pendingLinks.length})
        </h2>

        {pendingLinks.length === 0 ? (
          <p style={{
            color: '#64748b',
            fontSize: '14px',
            textAlign: 'center',
            padding: '40px'
          }}>
            No pending verification requests
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {pendingLinks.map((link) => {
              const matchingStudents = getFilteredStudents(link.year_group);
              
              return (
                <div
                  key={link.id}
                  style={{
                    padding: '20px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '2px solid #e2e8f0'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '8px'
                      }}>
                        {link.parent?.full_name || 'Unknown Parent'}
                      </h3>
                      <div style={{
                        fontSize: '14px',
                        color: '#64748b',
                        display: 'grid',
                        gap: '4px'
                      }}>
                        <div>
                          <span style={{ fontWeight: '600' }}>Email:</span> {link.parent?.email}
                        </div>
                        <div>
                          <span style={{ fontWeight: '600' }}>Child Name:</span> {link.child_name_submitted}
                        </div>
                        <div>
                          <span style={{ fontWeight: '600' }}>Year Group:</span> Year {link.year_group}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          Submitted: {new Date(link.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '250px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '8px'
                      }}>
                        Select Student to Link
                      </label>
                      <select
                        value={selectedStudent[link.id] || ''}
                        onChange={(e) => setSelectedStudent({
                          ...selectedStudent,
                          [link.id]: e.target.value
                        })}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          outline: 'none',
                          cursor: 'pointer',
                          background: 'white'
                        }}
                      >
                        <option value="">-- Select Student --</option>
                        {matchingStudents.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.student_name} - {student.classes?.name}
                          </option>
                        ))}
                      </select>
                      <div style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        color: '#64748b'
                      }}>
                        {matchingStudents.length} student{matchingStudents.length !== 1 ? 's' : ''} in Year {link.year_group}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start'
                    }}>
                      <button
                        onClick={() => handleVerify(link.id, link.parent_id)}
                        disabled={processing === link.id || !selectedStudent[link.id]}
                        style={{
                          padding: '10px 18px',
                          background: selectedStudent[link.id] ? '#10b981' : '#94a3b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: selectedStudent[link.id] ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          opacity: processing === link.id ? 0.5 : 1
                        }}
                      >
                        <Check style={{ width: '16px', height: '16px' }} />
                        Verify
                      </button>
                      <button
                        onClick={() => handleReject(link.id)}
                        disabled={processing === link.id}
                        style={{
                          padding: '10px 18px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          opacity: processing === link.id ? 0.5 : 1
                        }}
                      >
                        <X style={{ width: '16px', height: '16px' }} />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Verified Links Section */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Check style={{ width: '24px', height: '24px', color: '#10b981' }} />
          Recently Verified Links ({verifiedLinks.length})
        </h2>

        {verifiedLinks.length === 0 ? (
          <p style={{
            color: '#64748b',
            fontSize: '14px',
            textAlign: 'center',
            padding: '40px'
          }}>
            No verified links yet
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gap: '12px'
          }}>
            {verifiedLinks.map((link) => (
              <div
                key={link.id}
                style={{
                  padding: '20px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0'
                }}
              >
                {editingLink === link.id ? (
                  // Edit Mode
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '16px'
                    }}>
                      <div>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '4px'
                        }}>
                          Editing: {link.parent?.full_name}
                        </h4>
                        <div style={{
                          fontSize: '13px',
                          color: '#64748b'
                        }}>
                          {link.parent?.email}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 2fr auto',
                      gap: '16px',
                      alignItems: 'end'
                    }}>
                      {/* Year Group Selector */}
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#475569',
                          marginBottom: '8px'
                        }}>
                          Year Group
                        </label>
                        <select
                          value={editData.yearGroup}
                          onChange={(e) => setEditData({
                            ...editData,
                            yearGroup: e.target.value,
                            studentId: '' // Reset student selection when year changes
                          })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            fontSize: '14px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            outline: 'none',
                            cursor: 'pointer',
                            background: 'white'
                          }}
                        >
                          <option value="">All Years</option>
                          {[...new Set(students.map(s => s.classes?.year_level).filter(Boolean))]
                            .sort((a, b) => a - b)
                            .map(year => (
                              <option key={year} value={year}>Year {year}</option>
                            ))
                          }
                        </select>
                      </div>

                      {/* Student Selector */}
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#475569',
                          marginBottom: '8px'
                        }}>
                          Select New Student
                        </label>
                        <select
                          value={editData.studentId}
                          onChange={(e) => setEditData({
                            ...editData,
                            studentId: e.target.value
                          })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            fontSize: '14px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            outline: 'none',
                            cursor: 'pointer',
                            background: 'white'
                          }}
                        >
                          <option value="">-- Select Student --</option>
                          {getFilteredStudents(editData.yearGroup).map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.student_name} - {student.classes?.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Action Buttons */}
                      <div style={{
                        display: 'flex',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => handleSaveEdit(link.id)}
                          disabled={processing === link.id || !editData.studentId}
                          style={{
                            padding: '10px 16px',
                            background: editData.studentId ? '#10b981' : '#94a3b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: editData.studentId ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: processing === link.id ? 0.5 : 1
                          }}
                        >
                          <Check style={{ width: '14px', height: '14px' }} />
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={processing === link.id}
                          style={{
                            padding: '10px 16px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <X style={{ width: '14px', height: '14px' }} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Display Mode
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '4px'
                      }}>
                        {link.parent?.full_name} → {link.students?.student_name || '⚠️ Student Not Found'}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#64748b'
                      }}>
                        {link.parent?.email} • {link.students?.classes?.name || `Year ${link.year_group}`}
                      </div>
                      {link.verified_at && (
                        <div style={{
                          fontSize: '12px',
                          color: '#94a3b8',
                          marginTop: '4px'
                        }}>
                          Verified: {new Date(link.verified_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      {/* Status Badge */}
                      <div style={{
                        padding: '6px 12px',
                        background: link.students ? '#d1fae5' : '#fee2e2',
                        color: link.students ? '#065f46' : '#991b1b',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        {link.students ? 'LINKED' : 'BROKEN'}
                      </div>

                      {/* Action Buttons */}
                      <div style={{
                        display: 'flex',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => startEditing(link)}
                          disabled={processing === link.id || deletingLink === link.id}
                          style={{
                            padding: '8px 12px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#5568d3';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#667eea';
                          }}
                        >
                          <Edit2 style={{ width: '12px', height: '12px' }} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteLink(
                            link.id, 
                            link.parent?.full_name, 
                            link.students?.student_name || link.child_name_submitted
                          )}
                          disabled={processing === link.id || deletingLink === link.id}
                          style={{
                            padding: '8px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            opacity: deletingLink === link.id ? 0.5 : 1
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#dc2626';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#ef4444';
                          }}
                        >
                          <Trash2 style={{ width: '12px', height: '12px' }} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentVerificationPanel;