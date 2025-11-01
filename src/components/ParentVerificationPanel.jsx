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
    studentId: '',
    childName: '' // Added for better tracking
  });
  const [addingLink, setAddingLink] = useState(false);

  // For editing existing link
  const [editingLink, setEditingLink] = useState(null);
  const [editData, setEditData] = useState({
    studentId: ''
  });

  // For deleting links
  const [deletingLink, setDeletingLink] = useState(null);

  // For managing children modal
  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [selectedParentLinks, setSelectedParentLinks] = useState([]);

  // For showing link status
  const [linkStatus, setLinkStatus] = useState(null);

  // For filtering and search
  const [activeTab, setActiveTab] = useState('verified'); // 'verified' or 'pending'
  const [searchText, setSearchText] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  useEffect(() => {
    loadData();
    
    // Cleanup function to restore scroll on unmount
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = 'unset';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY) * -1);
      }
    };
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
        classId: '',
        studentId: '',
        childName: ''
      });
      setShowAddModal(false);
      // Restore body scroll and position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = 'unset';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
      
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
      studentId: link.student_id || ''
    });
  };

  /**
   * Cancel editing
   */
  const cancelEditing = () => {
    setEditingLink(null);
    setEditData({ studentId: '' });
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
          year_group: student.classes?.year_level?.toString() || '',
          child_name_submitted: student.student_name, // Update name for future matching
          updated_at: new Date().toISOString()
        })
        .eq('id', linkId);

      if (error) throw error;

      toast.success('✓ Parent-child link updated successfully');
      setEditingLink(null);
      setEditData({ studentId: '' });
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

  const getFilteredStudents = (classId) => {
    if (!classId) return students;
    
    return students.filter(s => s.class_id === classId);
  };

  /**
   * Filter verified links based on search and class filters
   */
  const getFilteredVerifiedLinks = () => {
    let filtered = [...verifiedLinks];

    // Filter by search text (parent name, email, or student name)
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(link => 
        link.parent?.full_name?.toLowerCase().includes(search) ||
        link.parent?.email?.toLowerCase().includes(search) ||
        link.students?.student_name?.toLowerCase().includes(search) ||
        link.child_name_submitted?.toLowerCase().includes(search)
      );
    }

    // Filter by class
    if (filterClass) {
      filtered = filtered.filter(link => 
        link.students?.classes?.id === filterClass
      );
    }

    return filtered;
  };

  /**
   * Group verified links by parent
   */
  const getGroupedVerifiedLinks = () => {
    const filtered = getFilteredVerifiedLinks();
    const grouped = {};

    filtered.forEach(link => {
      const parentId = link.parent_id;
      if (!grouped[parentId]) {
        grouped[parentId] = {
          parent: link.parent,
          parentId: parentId,
          children: []
        };
      }
      grouped[parentId].children.push(link);
    });

    return Object.values(grouped);
  };

  /**
   * Filter pending links based on search
   */
  const getFilteredPendingLinks = () => {
    let filtered = [...pendingLinks];

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(link => 
        link.parent?.full_name?.toLowerCase().includes(search) ||
        link.parent?.email?.toLowerCase().includes(search) ||
        link.child_name_submitted?.toLowerCase().includes(search)
      );
    }

    return filtered;
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setSearchText('');
    setFilterClass('');
  };

  /**
   * Open modal to manage children for a parent
   */
  const openChildrenModal = (parentGroup) => {
    setSelectedParentLinks(parentGroup.children);
    setShowChildrenModal(true);
  };

  /**
   * Close children modal
   */
  const closeChildrenModal = () => {
    setShowChildrenModal(false);
    setSelectedParentLinks([]);
    setEditingLink(null);
    setEditData({ studentId: '' });
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
      padding: window.innerWidth < 768 ? '16px' : '32px',
      maxWidth: '1400px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Header with Status Summary */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: window.innerWidth < 768 ? '20px' : '32px',
        gap: window.innerWidth < 768 ? '12px' : '24px',
        flexWrap: 'wrap'
      }}>
        <div style={{ width: '100%', maxWidth: '100%' }}>
          <h1 style={{
            fontSize: window.innerWidth < 768 ? '24px' : '32px',
            fontWeight: '800',
            color: '#1e293b',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: window.innerWidth < 768 ? '8px' : '12px',
            flexWrap: 'wrap'
          }}>
            <Users style={{ 
              width: window.innerWidth < 768 ? '24px' : '32px', 
              height: window.innerWidth < 768 ? '24px' : '32px', 
              color: '#667eea',
              flexShrink: 0
            }} />
            <span style={{ wordBreak: 'break-word' }}>Parent Verification</span>
          </h1>
          <p style={{
            fontSize: window.innerWidth < 768 ? '14px' : '16px',
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
            gap: window.innerWidth < 768 ? '8px' : '12px',
            flexWrap: 'wrap',
            width: '100%',
            justifyContent: window.innerWidth < 768 ? 'space-between' : 'flex-start'
          }}>
            {linkStatus.VALID > 0 && (
              <div style={{
                padding: window.innerWidth < 768 ? '10px 12px' : '12px 16px',
                background: '#f0fdf4',
                borderRadius: '8px',
                border: '2px solid #86efac',
                flex: window.innerWidth < 768 ? '1 1 calc(33.333% - 8px)' : '0 0 auto',
                minWidth: window.innerWidth < 768 ? '80px' : 'auto',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: window.innerWidth < 768 ? '20px' : '24px', 
                  fontWeight: '800', 
                  color: '#16a34a' 
                }}>
                  {linkStatus.VALID}
                </div>
                <div style={{ 
                  fontSize: window.innerWidth < 768 ? '10px' : '12px', 
                  color: '#15803d', 
                  fontWeight: '600',
                  whiteSpace: window.innerWidth < 768 ? 'nowrap' : 'normal'
                }}>
                  Valid Links
                </div>
              </div>
            )}
            {linkStatus.BROKEN_LINK > 0 && (
              <div style={{
                padding: window.innerWidth < 768 ? '10px 12px' : '12px 16px',
                background: '#fee2e2',
                borderRadius: '8px',
                border: '2px solid #fca5a5',
                flex: window.innerWidth < 768 ? '1 1 calc(33.333% - 8px)' : '0 0 auto',
                minWidth: window.innerWidth < 768 ? '80px' : 'auto',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: window.innerWidth < 768 ? '20px' : '24px', 
                  fontWeight: '800', 
                  color: '#dc2626' 
                }}>
                  {linkStatus.BROKEN_LINK}
                </div>
                <div style={{ 
                  fontSize: window.innerWidth < 768 ? '10px' : '12px', 
                  color: '#991b1b', 
                  fontWeight: '600',
                  whiteSpace: window.innerWidth < 768 ? 'nowrap' : 'normal'
                }}>
                  Broken Links
                </div>
              </div>
            )}
            {linkStatus.PENDING_VERIFICATION > 0 && (
              <div style={{
                padding: window.innerWidth < 768 ? '10px 12px' : '12px 16px',
                background: '#fef3c7',
                borderRadius: '8px',
                border: '2px solid #fcd34d',
                flex: window.innerWidth < 768 ? '1 1 calc(33.333% - 8px)' : '0 0 auto',
                minWidth: window.innerWidth < 768 ? '80px' : 'auto',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: window.innerWidth < 768 ? '20px' : '24px', 
                  fontWeight: '800', 
                  color: '#d97706' 
                }}>
                  {linkStatus.PENDING_VERIFICATION}
                </div>
                <div style={{ 
                  fontSize: window.innerWidth < 768 ? '10px' : '12px', 
                  color: '#b45309', 
                  fontWeight: '600',
                  whiteSpace: window.innerWidth < 768 ? 'nowrap' : 'normal'
                }}>
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
        gap: window.innerWidth < 768 ? '8px' : '12px',
        marginBottom: window.innerWidth < 768 ? '16px' : '24px',
        flexWrap: 'wrap',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => {
            setShowAddModal(true);
          }}
          style={{
            padding: window.innerWidth < 768 ? '10px 14px' : '12px 20px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: window.innerWidth < 768 ? '12px' : '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            flex: window.innerWidth < 768 ? '1 1 auto' : '0 0 auto',
            justifyContent: 'center',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#059669';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#10b981';
          }}
        >
          <Plus style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {window.innerWidth < 640 ? 'Add Link' : 'Add New Link'}
          </span>
        </button>

        <button
          onClick={handleRemapAll}
          style={{
            padding: window.innerWidth < 768 ? '10px 14px' : '12px 20px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: window.innerWidth < 768 ? '12px' : '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            flex: window.innerWidth < 768 ? '1 1 auto' : '0 0 auto',
            justifyContent: 'center',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#5568d3';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#667eea';
          }}
        >
          <RefreshCw style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {window.innerWidth < 640 ? 'Auto-Fix' : 'Auto-Fix Broken Links'}
          </span>
        </button>

        <button
          onClick={loadData}
          style={{
            padding: window.innerWidth < 768 ? '10px 14px' : '12px 20px',
            background: 'white',
            color: '#667eea',
            border: '2px solid #667eea',
            borderRadius: '8px',
            fontSize: window.innerWidth < 768 ? '12px' : '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            flex: window.innerWidth < 768 ? '0 0 auto' : '0 0 auto',
            justifyContent: 'center'
          }}
        >
          <RefreshCw style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          {window.innerWidth >= 640 && 'Refresh'}
        </button>
      </div>

      {/* Tabs for Pending vs Verified */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: window.innerWidth < 768 ? '16px' : '20px',
        borderBottom: '2px solid #e2e8f0',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => setActiveTab('verified')}
          style={{
            padding: window.innerWidth < 768 ? '10px 16px' : '12px 24px',
            background: 'transparent',
            color: activeTab === 'verified' ? '#667eea' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'verified' ? '3px solid #667eea' : '3px solid transparent',
            fontSize: window.innerWidth < 768 ? '14px' : '15px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          Verified Links ({verifiedLinks.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: window.innerWidth < 768 ? '10px 16px' : '12px 24px',
            background: 'transparent',
            color: activeTab === 'pending' ? '#f59e0b' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '3px solid #f59e0b' : '3px solid transparent',
            fontSize: window.innerWidth < 768 ? '14px' : '15px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          Pending {pendingLinks.length > 0 && (
            <span style={{
              background: '#f59e0b',
              color: 'white',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {pendingLinks.length}
            </span>
          )}
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: window.innerWidth < 768 ? '16px' : '20px',
        marginBottom: window.innerWidth < 768 ? '16px' : '20px',
        border: '2px solid #e2e8f0',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: window.innerWidth < 768 ? '12px' : '16px',
          marginBottom: '16px'
        }}>
          {/* Search Box */}
          <div style={{ gridColumn: window.innerWidth < 768 ? '1' : 'span 2' }}>
            <label style={{
              display: 'block',
              fontSize: window.innerWidth < 768 ? '13px' : '14px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '8px'
            }}>
              🔍 Search
            </label>
            <input
              type="text"
              placeholder="Search by parent name, email, or student name..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: window.innerWidth < 768 ? '10px 14px' : '12px 16px',
                fontSize: window.innerWidth < 768 ? '14px' : '15px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Class Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: window.innerWidth < 768 ? '13px' : '14px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '8px'
            }}>
              🏫 Filter by Class
            </label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              style={{
                width: '100%',
                padding: window.innerWidth < 768 ? '10px 14px' : '12px 16px',
                fontSize: window.innerWidth < 768 ? '14px' : '15px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                cursor: 'pointer',
                background: 'white',
                boxSizing: 'border-box',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none'
              }}
            >
              <option value="">All Classes</option>
              {classes
                .map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cls.year_level ? `(Year ${cls.year_level})` : ''}
                  </option>
                ))
              }
            </select>
          </div>
        </div>

        {/* Filter Summary and Clear */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            fontSize: window.innerWidth < 768 ? '13px' : '14px',
            color: '#64748b',
            fontWeight: '500'
          }}>
            {activeTab === 'verified' ? (
              <>
                Showing <strong style={{ color: '#1e293b' }}>{getFilteredVerifiedLinks().length}</strong> of{' '}
                <strong style={{ color: '#1e293b' }}>{verifiedLinks.length}</strong> verified links
              </>
            ) : (
              <>
                Showing <strong style={{ color: '#1e293b' }}>{getFilteredPendingLinks().length}</strong> of{' '}
                <strong style={{ color: '#1e293b' }}>{pendingLinks.length}</strong> pending requests
              </>
            )}
          </div>
          
          {(searchText || filterClass) && (
            <button
              onClick={clearFilters}
              style={{
                padding: '8px 16px',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f1f5f9';
              }}
            >
              <X style={{ width: '14px', height: '14px' }} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Add New Link Modal */}
      {showAddModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            zIndex: 1000,
            padding: window.innerWidth < 768 ? '16px' : '40px 20px',
            overflowY: 'auto'
          }}
          onClick={(e) => {
            // Close modal if clicking on backdrop
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              resetAddForm();
            }
          }}
        >
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: window.innerWidth < 768 ? '20px' : '32px',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}>
            <h2 style={{
              fontSize: window.innerWidth < 768 ? '20px' : '24px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: window.innerWidth < 768 ? '16px' : '24px',
              display: 'flex',
              alignItems: 'center',
              gap: window.innerWidth < 768 ? '8px' : '12px',
              flexWrap: 'wrap'
            }}>
              <Plus style={{ 
                width: window.innerWidth < 768 ? '20px' : '24px', 
                height: window.innerWidth < 768 ? '20px' : '24px', 
                color: '#10b981',
                flexShrink: 0 
              }} />
              <span style={{ wordBreak: 'break-word' }}>Add New Parent-Child Link</span>
            </h2>

            <div style={{ display: 'grid', gap: window.innerWidth < 768 ? '16px' : '20px' }}>
              {/* Parent Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: window.innerWidth < 768 ? '13px' : '14px',
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
                    padding: window.innerWidth < 768 ? '10px 14px' : '12px 16px',
                    fontSize: window.innerWidth < 768 ? '14px' : '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    cursor: 'pointer',
                    background: 'white',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none'
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
                  fontSize: window.innerWidth < 768 ? '11px' : '12px',
                  color: '#64748b',
                  marginTop: '4px'
                }}>
                  {allParents.length} parent{allParents.length !== 1 ? 's' : ''} available
                </div>
              </div>

              {/* Class Filter (Optional) */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: window.innerWidth < 768 ? '13px' : '14px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Filter by Class (Optional)
                </label>
                <select
                  value={newLink.classId || ''}
                  onChange={(e) => setNewLink({
                    ...newLink,
                    classId: e.target.value,
                    studentId: '' // Reset student when class changes
                  })}
                  style={{
                    width: '100%',
                    padding: window.innerWidth < 768 ? '10px 14px' : '12px 16px',
                    fontSize: window.innerWidth < 768 ? '14px' : '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    cursor: 'pointer',
                    background: 'white',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none'
                  }}
                >
                  <option value="">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.year_level ? `(Year ${cls.year_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: window.innerWidth < 768 ? '13px' : '14px',
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
                    padding: window.innerWidth < 768 ? '10px 14px' : '12px 16px',
                    fontSize: window.innerWidth < 768 ? '14px' : '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    cursor: 'pointer',
                    background: 'white',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none'
                  }}
                >
                  <option value="">-- Select Student --</option>
                  {getFilteredStudents(newLink.classId).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.student_name} - {student.classes?.name} (Year {student.classes?.year_level})
                    </option>
                  ))}
                </select>
                <div style={{
                  fontSize: window.innerWidth < 768 ? '11px' : '12px',
                  color: '#64748b',
                  marginTop: '4px'
                }}>
                  {getFilteredStudents(newLink.classId).length} student{getFilteredStudents(newLink.classId).length !== 1 ? 's' : ''} available
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
              gap: window.innerWidth < 768 ? '8px' : '12px',
              marginTop: window.innerWidth < 768 ? '20px' : '32px',
              justifyContent: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={resetAddForm}
                disabled={addingLink}
                style={{
                  padding: window.innerWidth < 768 ? '10px 18px' : '12px 24px',
                  background: 'white',
                  color: '#6b7280',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: window.innerWidth < 768 ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flex: window.innerWidth < 768 ? '1 1 auto' : '0 0 auto'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewLink}
                disabled={addingLink || !newLink.parentId || !newLink.studentId}
                style={{
                  padding: window.innerWidth < 768 ? '10px 18px' : '12px 24px',
                  background: (newLink.parentId && newLink.studentId) ? '#10b981' : '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: window.innerWidth < 768 ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: (newLink.parentId && newLink.studentId) ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: addingLink ? 0.5 : 1,
                  transition: 'all 0.2s',
                  flex: window.innerWidth < 768 ? '1 1 auto' : '0 0 auto',
                  justifyContent: 'center'
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
      {activeTab === 'pending' && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: window.innerWidth < 768 ? '16px' : '24px',
          marginBottom: window.innerWidth < 768 ? '16px' : '24px',
          border: '1px solid #e2e8f0',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <h2 style={{
            fontSize: window.innerWidth < 768 ? '18px' : '20px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: window.innerWidth < 768 ? '12px' : '16px',
            display: 'flex',
            alignItems: 'center',
            gap: window.innerWidth < 768 ? '8px' : '12px',
            flexWrap: 'wrap'
          }}>
            <AlertCircle style={{ 
              width: window.innerWidth < 768 ? '20px' : '24px', 
              height: window.innerWidth < 768 ? '20px' : '24px', 
              color: '#f59e0b',
              flexShrink: 0 
            }} />
            <span style={{ wordBreak: 'break-word' }}>Pending Verification</span>
          </h2>

          {getFilteredPendingLinks().length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <AlertCircle size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
              <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                {searchText || filterClass ? 'No matching pending requests' : 'No pending verification requests'}
              </p>
              <p style={{ fontSize: '14px', margin: 0 }}>
                {searchText || filterClass ? 'Try adjusting your filters' : 'All parent requests have been processed'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: window.innerWidth < 768 ? '12px' : '16px' }}>
              {getFilteredPendingLinks().map((link) => {
                const matchingStudents = getFilteredStudents(link.year_group);
                
                return (
                  <div
                    key={link.id}
                    style={{
                      padding: window.innerWidth < 768 ? '16px' : '20px',
                      background: '#fffbeb',
                      borderRadius: '12px',
                      border: '2px solid #fde047',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: window.innerWidth < 768 ? '12px' : '16px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: '1', minWidth: window.innerWidth < 768 ? '100%' : '250px' }}>
                        <h3 style={{
                          fontSize: window.innerWidth < 768 ? '15px' : '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '8px',
                          wordBreak: 'break-word'
                        }}>
                          {link.parent?.full_name || 'Unknown Parent'}
                        </h3>
                        <div style={{
                          fontSize: window.innerWidth < 768 ? '13px' : '14px',
                          color: '#64748b',
                          display: 'grid',
                          gap: '4px',
                          wordBreak: 'break-word'
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
                          <div style={{ fontSize: window.innerWidth < 768 ? '11px' : '12px', color: '#94a3b8' }}>
                            Submitted: {new Date(link.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div style={{ flex: '1', minWidth: window.innerWidth < 768 ? '100%' : '250px', width: '100%' }}>
                        <label style={{
                          display: 'block',
                          fontSize: window.innerWidth < 768 ? '13px' : '14px',
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
                            padding: window.innerWidth < 768 ? '8px 12px' : '10px 14px',
                            fontSize: window.innerWidth < 768 ? '13px' : '14px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            outline: 'none',
                            cursor: 'pointer',
                            background: 'white',
                            boxSizing: 'border-box',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            appearance: 'none'
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
                          fontSize: window.innerWidth < 768 ? '11px' : '12px',
                          color: '#64748b'
                        }}>
                          {matchingStudents.length} student{matchingStudents.length !== 1 ? 's' : ''} in Year {link.year_group}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: window.innerWidth < 768 ? '6px' : '8px',
                        alignItems: 'flex-start',
                        width: window.innerWidth < 768 ? '100%' : 'auto',
                        flexWrap: 'wrap'
                      }}>
                        <button
                          onClick={() => handleVerify(link.id, link.parent_id)}
                          disabled={processing === link.id || !selectedStudent[link.id]}
                          style={{
                            padding: window.innerWidth < 768 ? '8px 14px' : '10px 18px',
                            background: selectedStudent[link.id] ? '#10b981' : '#94a3b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: window.innerWidth < 768 ? '12px' : '14px',
                            fontWeight: '600',
                            cursor: selectedStudent[link.id] ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: processing === link.id ? 0.5 : 1,
                            flex: window.innerWidth < 768 ? '1 1 auto' : '0 0 auto',
                            justifyContent: 'center'
                          }}
                        >
                          <Check style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                          Verify
                        </button>
                        <button
                          onClick={() => handleReject(link.id)}
                          disabled={processing === link.id}
                          style={{
                            padding: window.innerWidth < 768 ? '8px 14px' : '10px 18px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: window.innerWidth < 768 ? '12px' : '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: processing === link.id ? 0.5 : 1,
                            flex: window.innerWidth < 768 ? '1 1 auto' : '0 0 auto',
                            justifyContent: 'center'
                          }}
                        >
                          <X style={{ width: '14px', height: '14px', flexShrink: 0 }} />
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
      )}

      {/* Verified Links Section */}
      {activeTab === 'verified' && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: window.innerWidth < 768 ? '16px' : '24px',
          border: '1px solid #e2e8f0',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <h2 style={{
            fontSize: window.innerWidth < 768 ? '18px' : '20px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: window.innerWidth < 768 ? '12px' : '16px',
            display: 'flex',
            alignItems: 'center',
            gap: window.innerWidth < 768 ? '8px' : '12px',
            flexWrap: 'wrap'
          }}>
            <Check style={{ 
              width: window.innerWidth < 768 ? '20px' : '24px', 
              height: window.innerWidth < 768 ? '20px' : '24px', 
              color: '#10b981',
              flexShrink: 0 
            }} />
            <span style={{ wordBreak: 'break-word' }}>Verified Parent-Child Relationships</span>
          </h2>

          {getGroupedVerifiedLinks().length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <Users size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
              <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                {searchText || filterClass ? 'No matching relationships found' : 'No verified links yet'}
              </p>
              <p style={{ fontSize: '14px', margin: 0 }}>
                {searchText || filterClass ? 'Try adjusting your filters' : 'Verified parent-child relationships will appear here'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: window.innerWidth < 768 ? '10px' : '12px'
            }}>
              {getGroupedVerifiedLinks().map((parentGroup) => {
                const allLinked = parentGroup.children.every(link => link.students);
                const hasbroken = parentGroup.children.some(link => !link.students);
                
                return (
                  <div
                    key={parentGroup.parentId}
                    style={{
                      padding: window.innerWidth < 768 ? '16px' : '20px',
                      background: hasbroken ? '#fef2f2' : '#f0fdf4',
                      borderRadius: '12px',
                      border: `2px solid ${hasbroken ? '#fca5a5' : '#86efac'}`,
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: window.innerWidth < 768 ? '12px' : '16px',
                      flexWrap: 'wrap'
                    }}>
                      {/* Parent Info */}
                      <div style={{ flex: '1', minWidth: window.innerWidth < 768 ? '100%' : '250px' }}>
                        <div style={{
                          fontSize: window.innerWidth < 768 ? '16px' : '18px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '8px',
                          wordBreak: 'break-word',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '20px' }}></span>
                          {parentGroup.parent?.full_name}
                        </div>
                        <div style={{
                          fontSize: window.innerWidth < 768 ? '13px' : '14px',
                          color: '#64748b',
                          marginBottom: '12px',
                          wordBreak: 'break-word'
                        }}>
                          {parentGroup.parent?.email}
                        </div>

                        {/* Children List */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: '12px'
                        }}>
                          <div style={{
                            fontSize: window.innerWidth < 768 ? '13px' : '14px',
                            fontWeight: '600',
                            color: '#475569',
                            marginBottom: '4px'
                          }}>
                            Children ({parentGroup.children.length}):
                          </div>
                          {parentGroup.children.map((link, index) => (
                            <div
                              key={link.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                background: 'white',
                                borderRadius: '8px',
                                border: `1px solid ${link.students ? '#d1fae5' : '#fee2e2'}`,
                                fontSize: window.innerWidth < 768 ? '13px' : '14px'
                              }}
                            >
                              <span style={{ fontSize: '16px' }}></span>
                              <span style={{
                                flex: 1,
                                fontWeight: '600',
                                color: link.students ? '#065f46' : '#991b1b'
                              }}>
                                {link.students?.student_name || '⚠️ Student Not Found'}
                              </span>
                              {link.students && (
                                <span style={{
                                  fontSize: window.innerWidth < 768 ? '11px' : '12px',
                                  color: '#64748b',
                                  background: '#f8fafc',
                                  padding: '2px 8px',
                                  borderRadius: '4px'
                                }}>
                                  {link.students.classes?.name}
                                </span>
                              )}
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: link.students ? '#d1fae5' : '#fee2e2',
                                color: link.students ? '#065f46' : '#991b1b'
                              }}>
                                {link.students ? '✓' : '✗'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: window.innerWidth < 768 ? 'stretch' : 'flex-end',
                        width: window.innerWidth < 768 ? '100%' : 'auto'
                      }}>
                        <button
                          onClick={() => openChildrenModal(parentGroup)}
                          style={{
                            padding: window.innerWidth < 768 ? '10px 16px' : '12px 20px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: window.innerWidth < 768 ? '13px' : '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#5568d3';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#667eea';
                          }}
                        >
                          <Edit2 style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                          Manage Children
                        </button>

                        {/* Summary Badge */}
                        <div style={{
                          padding: '6px 12px',
                          background: hasbroken ? '#fee2e2' : '#d1fae5',
                          color: hasbroken ? '#991b1b' : '#065f46',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          textAlign: 'center',
                          border: `2px solid ${hasbroken ? '#fca5a5' : '#86efac'}`
                        }}>
                          {allLinked ? `${parentGroup.children.length} Linked` : 
                           `${parentGroup.children.filter(l => l.students).length}/${parentGroup.children.length} Linked`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manage Children Modal */}
      {showChildrenModal && selectedParentLinks.length > 0 && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: window.innerWidth < 768 ? '16px' : '20px'
          }}
          onClick={(e) => {
            // Close modal if clicking on backdrop
            if (e.target === e.currentTarget) {
              closeChildrenModal();
            }
          }}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: window.innerWidth < 768 ? '20px' : '32px',
            maxWidth: '800px',
            width: '100%',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            boxSizing: 'border-box',
            margin: 'auto',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid #e2e8f0'
            }}>
              <h2 style={{
                fontSize: window.innerWidth < 768 ? '20px' : '24px',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Users style={{ width: '24px', height: '24px', color: '#667eea' }} />
                Manage Children
              </h2>
              <button
                onClick={closeChildrenModal}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
              >
                <X style={{ width: '20px', height: '20px', color: '#64748b' }} />
              </button>
            </div>

            {/* Parent Info */}
            <div style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '2px solid #e2e8f0'
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '20px' }}></span>
                {selectedParentLinks[0]?.parent?.full_name}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#64748b'
              }}>
                {selectedParentLinks[0]?.parent?.email}
              </div>
            </div>

            {/* Children List */}
            <div style={{
              display: 'grid',
              gap: '16px'
            }}>
              {selectedParentLinks.map((link) => (
                <div
                  key={link.id}
                  style={{
                    background: link.students ? '#f0fdf4' : '#fef2f2',
                    padding: '20px',
                    borderRadius: '12px',
                    border: `2px solid ${link.students ? '#86efac' : '#fca5a5'}`,
                    boxSizing: 'border-box'
                  }}
                >
                  {editingLink === link.id ? (
                    // Edit Mode
                    <div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#475569',
                        marginBottom: '16px'
                      }}>
                        Editing Child Link
                      </div>

                      <div style={{
                        marginBottom: '16px'
                      }}>
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
                              background: 'white',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="">-- Select Student --</option>
                            {getFilteredStudents('').map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.student_name} - {student.classes?.name} (Year {student.classes?.year_level})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Edit Action Buttons */}
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end'
                      }}>
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
                        <button
                          onClick={async () => {
                            await handleSaveEdit(link.id);
                            // Reload to update the modal
                            const updatedLinks = selectedParentLinks.map(l => 
                              l.id === link.id ? { ...l, students: students.find(s => s.id === editData.studentId) } : l
                            );
                            setSelectedParentLinks(updatedLinks);
                          }}
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
                          {processing === link.id ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display Mode
                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '700',
                            color: link.students ? '#065f46' : '#991b1b',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ fontSize: '20px' }}></span>
                            {link.students?.student_name || '⚠️ Student Not Found'}
                          </div>
                          {link.students && (
                            <>
                              <div style={{
                                fontSize: '14px',
                                color: '#64748b',
                                marginBottom: '4px'
                              }}>
                                🏫 {link.students.classes?.name} (Year {link.students.classes?.year_level})
                              </div>
                              {link.verified_at && (
                                <div style={{
                                  fontSize: '12px',
                                  color: '#94a3b8'
                                }}>
                                  ✓ Verified: {new Date(link.verified_at).toLocaleDateString()}
                                </div>
                              )}
                            </>
                          )}
                          {!link.students && (
                            <div style={{
                              fontSize: '13px',
                              color: '#991b1b',
                              background: '#fee2e2',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              marginTop: '8px'
                            }}>
                              ⚠ This student link is broken. Click Edit to reassign.
                            </div>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div style={{
                          padding: '6px 12px',
                          background: link.students ? '#d1fae5' : '#fee2e2',
                          color: link.students ? '#065f46' : '#991b1b',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          border: `2px solid ${link.students ? '#86efac' : '#fca5a5'}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {link.students ? '✓ LINKED' : '✗ BROKEN'}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        paddingTop: '12px',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <button
                          onClick={() => {
                            setEditingLink(link.id);
                            setEditData({
                              studentId: link.student_id || ''
                            });
                          }}
                          disabled={processing === link.id || deletingLink === link.id}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#5568d3'}
                          onMouseLeave={(e) => e.target.style.background = '#667eea'}
                        >
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                          Edit Link
                        </button>
                        <button
                          onClick={async () => {
                            await handleDeleteLink(
                              link.id,
                              link.parent?.full_name,
                              link.students?.student_name || link.child_name_submitted
                            );
                            // Remove from modal
                            const updatedLinks = selectedParentLinks.filter(l => l.id !== link.id);
                            if (updatedLinks.length === 0) {
                              closeChildrenModal();
                            } else {
                              setSelectedParentLinks(updatedLinks);
                            }
                          }}
                          disabled={processing === link.id || deletingLink === link.id}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                            opacity: deletingLink === link.id ? 0.5 : 1
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                          onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                          {deletingLink === link.id ? 'Deleting...' : 'Delete Link'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '2px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={closeChildrenModal}
                style={{
                  padding: '12px 24px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#5568d3'}
                onMouseLeave={(e) => e.target.style.background = '#667eea'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentVerificationPanel;
