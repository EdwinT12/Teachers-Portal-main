import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import BulkStudentImport from '../../components/BulkStudentImport';
import CatechismLessonTracker from './CatechismLessonTracker';
import WeeklyReport from '../../components/WeeklyReport';
import ParentVerificationPanel from '../../components/ParentVerificationPanel';
import DualRoleManager from '../../components/DualRoleManager';
import AdminAbsenceRequestsPanel from '../../components/AdminAbsenceRequestsPanel';
import EvaluationCriteriaSettings from '../../components/EvaluationCriteriaSettings';
import ParentEvaluationCriteriaSettings from '../../components/ParentEvaluationCriteriaSettings';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  BookOpen,
  AlertTriangle,
  Trash2,
  Check,
  X,
  FileSpreadsheet,
  Edit,
  LayoutDashboard,
  UserCheck,
  Calendar,
  FileText,
  BookMarked,
  Upload,
  Settings,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  PanelLeftClose
} from 'lucide-react';
 
const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assigningTeacher, setAssigningTeacher] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobile, setIsMobile] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showDualRoleModal, setShowDualRoleModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [sheetIds, setSheetIds] = useState({
    google_sheets_id: '',
    evaluation_sheets_id: ''
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select(`
          *,
          classes:default_class_id (
            id,
            name,
            year_level
          )
        `)
        .eq('role', 'teacher')
        .order('created_at', { ascending: false });

      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('year_level');

      if (classesError) throw classesError;
      setClasses(classesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const assignTeacherToClass = async (teacherId, classId) => {
    setAssigningTeacher(teacherId);
    try {
      const { data: teacherData, error: fetchError } = await supabase
        .from('profiles')
        .select('google_sheets_id, evaluation_sheets_id')
        .eq('id', teacherId)
        .single();

      if (fetchError) throw fetchError;

      const updateData = {
        default_class_id: classId
      };

      if (!teacherData.google_sheets_id) {
        updateData.google_sheets_id = '1kTbE3-JeukrhPMg46eEPqOagEK82olcLIUExqmKWhAs';
      }
      if (!teacherData.evaluation_sheets_id) {
        updateData.evaluation_sheets_id = '1tVWRqyYrTHbYFPh4Yo8NVjjrxE3ZRYcsce0nwT0mcDc';
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', teacherId);

      if (error) throw error;

      toast.success('Teacher assigned successfully with sheet IDs!');
      loadData();
    } catch (error) {
      console.error('Error assigning teacher:', error);
      toast.error('Failed to assign teacher');
    } finally {
      setAssigningTeacher(null);
    }
  };

  const removeTeacherAssignment = async (teacherId) => {
    if (!confirm('Are you sure you want to remove this teacher\'s class assignment?')) {
      return;
    }

    setAssigningTeacher(teacherId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_class_id: null })
        .eq('id', teacherId);

      if (error) throw error;

      toast.success('Teacher assignment removed');
      loadData();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('Failed to remove assignment');
    } finally {
      setAssigningTeacher(null);
    }
  };

  const handleOpenSheetModal = (teacher) => {
    setSelectedTeacher(teacher);
    setSheetIds({
      google_sheets_id: teacher.google_sheets_id || '1kTbE3-JeukrhPMg46eEPqOagEK82olcLIUExqmKWhAs',
      evaluation_sheets_id: teacher.evaluation_sheets_id || '1tVWRqyYrTHbYFPh4Yo8NVjjrxE3ZRYcsce0nwT0mcDc'
    });
    setShowSheetModal(true);
  };

  const handleSaveSheetIds = async () => {
    if (!selectedTeacher) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          google_sheets_id: sheetIds.google_sheets_id,
          evaluation_sheets_id: sheetIds.evaluation_sheets_id
        })
        .eq('id', selectedTeacher.id);

      if (error) throw error;

      toast.success('Sheet IDs updated successfully!');
      setShowSheetModal(false);
      loadData();
    } catch (error) {
      console.error('Error updating sheet IDs:', error);
      toast.error('Failed to update sheet IDs');
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <div style={{ textAlign: 'center', color: 'white' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '60px',
              height: '60px',
              border: '4px solid rgba(255,255,255,0.3)',
              borderTop: '4px solid white',
              borderRadius: '50%',
              margin: '0 auto 20px'
            }}
          />
          <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Loading Dashboard...</h3>
        </div>
      </motion.div>
    );
  }

  const unapprovedTeachers = teachers.filter(t => !t.default_class_id);
  const approvedTeachers = teachers.filter(t => t.default_class_id);

  const renderOverviewTab = () => (
    <>
      {/* Dual Role Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowDualRoleModal(true)}
        style={{
          width: '100%',
          padding: isMobile ? '12px' : '14px',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
          border: 'none',
          borderRadius: '12px',
          color: 'white',
          fontSize: isMobile ? '14px' : '15px',
          fontWeight: '700',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: isMobile ? '16px' : '20px',
          boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
        }}
      >
        <Users style={{ width: '20px', height: '20px' }} />
        Teacher & Parent
      </motion.button>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: isMobile ? '10px' : '12px',
        marginBottom: isMobile ? '16px' : '20px'
      }}>
        {[
          { label: 'Total Teachers', value: teachers.length, color: '#3b82f6', icon: Users },
          { label: 'Pending', value: unapprovedTeachers.length, color: '#f59e0b', icon: Clock },
          { label: 'Approved', value: approvedTeachers.length, color: '#10b981', icon: CheckCircle },
          { label: 'Total Classes', value: classes.length, color: '#8b5cf6', icon: BookOpen }
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              padding: isMobile ? '14px 10px' : '16px 12px',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              border: '2px solid #f1f5f9',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
              borderRadius: '10px',
              background: `${stat.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px'
            }}>
              <stat.icon style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: stat.color }} />
            </div>
            <div style={{
              fontSize: isMobile ? '22px' : '26px',
              fontWeight: '800',
              color: stat.color,
              marginBottom: '2px',
              lineHeight: 1
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: isMobile ? '10px' : '11px',
              color: '#64748b',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pending Teachers */}
      {unapprovedTeachers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            marginBottom: isMobile ? '16px' : '20px',
            overflow: 'hidden',
            border: '2px solid #fbbf24'
          }}
        >
          <div style={{
            padding: isMobile ? '14px 16px' : '16px 20px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderBottom: '2px solid #fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertTriangle style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#92400e' }} />
            <h2 style={{
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '700',
              color: '#92400e',
              margin: 0
            }}>
              Pending Approvals ({unapprovedTeachers.length})
            </h2>
          </div>

          <div style={{ padding: isMobile ? '12px' : '16px' }}>
            {unapprovedTeachers.map((teacher, index) => (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  background: 'white',
                  padding: isMobile ? '12px' : '14px',
                  borderRadius: '10px',
                  marginBottom: '10px',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{
                  marginBottom: '10px'
                }}>
                  <div style={{
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: '700',
                    color: '#1e293b',
                    marginBottom: '3px'
                  }}>
                    {teacher.full_name || 'N/A'}
                  </div>
                  <div style={{
                    fontSize: isMobile ? '12px' : '13px',
                    color: '#64748b',
                    marginBottom: '2px'
                  }}>
                    {teacher.email}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#94a3b8'
                  }}>
                    Joined {new Date(teacher.created_at).toLocaleDateString()}
                  </div>
                </div>

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      assignTeacherToClass(teacher.id, e.target.value);
                    }
                  }}
                  disabled={assigningTeacher === teacher.id}
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '12px 14px',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: assigningTeacher === teacher.id ? '#f1f5f9' : 'white',
                    color: '#334155',
                    marginBottom: '8px'
                  }}
                >
                  <option value="">
                    {assigningTeacher === teacher.id ? 'Assigning...' : 'Select a class...'}
                  </option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenSheetModal(teacher)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '8px 12px' : '10px 14px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <FileSpreadsheet style={{ width: '14px', height: '14px' }} />
                  View Sheet IDs
                </motion.button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Approved Teachers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          border: '2px solid #10b981'
        }}
      >
        <div style={{
          padding: isMobile ? '14px 16px' : '16px 20px',
          background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
          borderBottom: '2px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#065f46' }} />
          <h2 style={{
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: '700',
            color: '#065f46',
            margin: 0
          }}>
            Approved Teachers ({approvedTeachers.length})
          </h2>
        </div>

        {approvedTeachers.length === 0 ? (
          <div style={{
            padding: isMobile ? '32px 16px' : '40px 24px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: isMobile ? '13px' : '14px'
          }}>
            No approved teachers yet
          </div>
        ) : (
          <div style={{ padding: isMobile ? '12px' : '16px' }}>
            {approvedTeachers.map((teacher, index) => (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  background: 'white',
                  padding: isMobile ? '12px' : '14px',
                  borderRadius: '10px',
                  marginBottom: '10px',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '10px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '3px'
                    }}>
                      {teacher.full_name || 'N/A'}
                    </div>
                    <div style={{
                      fontSize: isMobile ? '12px' : '13px',
                      color: '#64748b',
                      marginBottom: '6px',
                      wordBreak: 'break-all'
                    }}>
                      {teacher.email}
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '700',
                      background: '#d1fae5',
                      color: '#065f46',
                      border: '1px solid #10b981'
                    }}>
                      {teacher.classes?.name || 'N/A'}
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => removeTeacherAssignment(teacher.id)}
                    disabled={assigningTeacher === teacher.id}
                    style={{
                      padding: isMobile ? '8px' : '10px',
                      background: '#fee2e2',
                      border: '1.5px solid #ef4444',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Trash2 style={{ width: isMobile ? '16px' : '18px', height: isMobile ? '16px' : '18px', color: '#dc2626' }} />
                  </motion.button>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  background: teacher.status === 'active' ? '#d1fae5' : '#fee2e2',
                  borderRadius: '6px',
                  border: `1px solid ${teacher.status === 'active' ? '#10b981' : '#ef4444'}`,
                  marginBottom: '8px'
                }}>
                  {teacher.status === 'active' ? (
                    <Check style={{ width: '12px', height: '12px', color: '#065f46' }} />
                  ) : (
                    <X style={{ width: '12px', height: '12px', color: '#dc2626' }} />
                  )}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: teacher.status === 'active' ? '#065f46' : '#dc2626',
                    textTransform: 'capitalize'
                  }}>
                    {teacher.status}
                  </span>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenSheetModal(teacher)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '8px 12px' : '10px 14px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <FileSpreadsheet style={{ width: '14px', height: '14px' }} />
                  View Sheet IDs
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </>
  );

  // Sidebar navigation items
  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'parents', label: 'Parents', icon: UserCheck },
    { id: 'absence-requests', label: 'Absence Requests', icon: Calendar },
    { id: 'weekly-report', label: 'Weekly Report', icon: FileText },
    { id: 'catechism-tracker', label: 'Log Catechism', icon: BookMarked },
    { id: 'update-sheets', label: 'Update Sheets', icon: Upload },
    { id: 'evaluation-criteria', label: 'Teacher Criteria', icon: Settings },
    { id: 'parent-criteria', label: 'Parent Criteria', icon: Settings }
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      display: 'flex',
      overflow: 'hidden',
      paddingTop: isMobile ? '56px' : '64px' // Account for fixed AppBar
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { 
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        body {
          overscroll-behavior: none;
          overflow-x: hidden;
          margin: 0;
          padding: 0;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* Mobile Menu Button - Floating in corner */}
      {isMobile && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 901,
            width: '56px',
            height: '56px',
            background: showMobileSidebar 
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
        >
          {showMobileSidebar ? (
            <X style={{ width: '28px', height: '28px', color: 'white' }} />
          ) : (
            <PanelLeftOpen style={{ width: '28px', height: '28px', color: 'white' }} />
          )}
        </motion.button>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {(!isMobile || (isMobile && showMobileSidebar)) && (
          <motion.div
            initial={isMobile ? { x: -280 } : false}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              top: isMobile ? '56px' : '64px', // Position below AppBar
              left: 0,
              width: sidebarCollapsed && !isMobile ? '80px' : '280px',
              height: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 64px)', // Full height minus AppBar
              background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
              borderRight: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 900, // Lower than AppBar (1000)
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isMobile ? '4px 0 24px rgba(0, 0, 0, 0.3)' : '2px 0 16px rgba(102, 126, 234, 0.15)',
              transition: 'width 0.3s ease',
              flexShrink: 0,
              overflowY: 'auto'
            }}
          >
            {/* Sidebar Header */}
            <div style={{
              padding: '24px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              overflow: 'hidden'
            }}>
              {(!sidebarCollapsed || isMobile) && (
                <>
                  <h2 style={{
                    margin: 0,
                    fontSize: '24px',
                    fontWeight: '800',
                    color: 'white',
                    whiteSpace: 'nowrap'
                  }}>
                    Admin Panel
                  </h2>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {user?.email}
                  </p>
                </>
              )}
              {sidebarCollapsed && !isMobile && (
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  fontSize: '20px',
                  fontWeight: '800',
                  color: 'white'
                }}>
                  A
                </div>
              )}
            </div>

            {/* Navigation Items */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 12px'
            }}>
              {sidebarItems.map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ x: sidebarCollapsed && !isMobile ? 0 : 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (isMobile) setShowMobileSidebar(false);
                  }}
                  title={sidebarCollapsed && !isMobile ? item.label : ''}
                  style={{
                    width: '100%',
                    padding: sidebarCollapsed && !isMobile ? '14px' : '14px 16px',
                    marginBottom: '8px',
                    background: activeTab === item.id 
                      ? 'rgba(255, 255, 255, 0.25)' 
                      : 'transparent',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: sidebarCollapsed && !isMobile ? 'center' : 'flex-start',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    textAlign: 'left',
                    boxShadow: activeTab === item.id ? '0 4px 16px rgba(0, 0, 0, 0.1)' : 'none',
                    overflow: 'hidden'
                  }}
                >
                  <item.icon style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                  {(!sidebarCollapsed || isMobile) && <span style={{ flex: 1 }}>{item.label}</span>}
                </motion.button>
              ))}
            </div>

            {/* Sidebar Footer */}
            <div style={{
              padding: '16px 12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <motion.button
                whileHover={{ x: sidebarCollapsed && !isMobile ? 0 : 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSignOut}
                title={sidebarCollapsed && !isMobile ? 'Sign Out' : ''}
                style={{
                  width: '100%',
                  padding: sidebarCollapsed && !isMobile ? '14px' : '14px 16px',
                  background: 'rgba(6, 2, 255, 1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(252, 165, 165, 0.4)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed && !isMobile ? 'center' : 'flex-start',
                  gap: '12px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)'
                }}
              >
                <LogOut style={{ width: '20px', height: '20px' }} />
                {(!sidebarCollapsed || isMobile) && 'Sign Out'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      {isMobile && showMobileSidebar && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowMobileSidebar(false)}
          style={{
            position: 'fixed',
            top: '56px', // Below AppBar
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 899 // Below sidebar
          }}
        />
      )}

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginLeft: !isMobile && !sidebarCollapsed ? '280px' : !isMobile && sidebarCollapsed ? '80px' : '0',
        transition: 'margin-left 0.3s ease',
        width: '100%',
        height: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 64px)'
      }}>
        {/* Top Bar */}
        <div style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: isMobile ? '16px 20px' : '20px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          flexShrink: 0
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              margin: 0,
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: '800',
              color: '#0f172a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {sidebarItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#64748b',
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              Manage teachers, students, and track progress
            </p>
          </div>

          {!isMobile && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                marginLeft: '16px',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {sidebarCollapsed ? (
                <>
                  <PanelLeftOpen style={{ width: '20px', height: '20px' }} />
                  <span>Expand</span>
                </>
              ) : (
                <>
                  <PanelLeftClose style={{ width: '20px', height: '20px' }} />
                  <span>Collapse</span>
                </>
              )}
            </motion.button>
          )}
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '20px' : '40px',
          background: '#f8fafc'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && renderOverviewTab()}
              {activeTab === 'parents' && <ParentVerificationPanel />}
              {activeTab === 'absence-requests' && <AdminAbsenceRequestsPanel />}
              {activeTab === 'weekly-report' && <WeeklyReport />}
              {activeTab === 'catechism-tracker' && <CatechismLessonTracker />}
              {activeTab === 'update-sheets' && <BulkStudentImport />}
              {activeTab === 'evaluation-criteria' && <EvaluationCriteriaSettings />}
              {activeTab === 'parent-criteria' && <ParentEvaluationCriteriaSettings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Sheet IDs Modal */}
      <AnimatePresence>
        {showSheetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
            onClick={() => setShowSheetModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: isMobile ? '24px' : '32px',
                maxWidth: '600px',
                width: '100%',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileSpreadsheet style={{ width: '24px', height: '24px', color: 'white' }} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: isMobile ? '18px' : '22px',
                      fontWeight: '800',
                      color: '#1e293b',
                      margin: 0
                    }}>
                      Google Sheet IDs
                    </h2>
                    <p style={{
                      fontSize: '13px',
                      color: '#64748b',
                      margin: 0
                    }}>
                      {selectedTeacher?.full_name}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSheetModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X style={{ width: '18px', height: '18px', color: '#64748b' }} />
                </motion.button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  📊 Attendance Sheet ID
                </label>
                <input
                  type="text"
                  value={sheetIds.google_sheets_id}
                  onChange={(e) => setSheetIds({ ...sheetIds, google_sheets_id: e.target.value })}
                  placeholder="Enter Google Sheets ID for attendance"
                  style={{
                    width: '100%',
                    padding: isMobile ? '12px 14px' : '14px 16px',
                    borderRadius: '10px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#334155',
                    background: 'white',
                    fontFamily: 'monospace'
                  }}
                />
                <p style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  margin: '6px 0 0 0'
                }}>
                  Used for attendance tracking
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  ⭐ Evaluation Sheet ID
                </label>
                <input
                  type="text"
                  value={sheetIds.evaluation_sheets_id}
                  onChange={(e) => setSheetIds({ ...sheetIds, evaluation_sheets_id: e.target.value })}
                  placeholder="Enter Google Sheets ID for evaluations"
                  style={{
                    width: '100%',
                    padding: isMobile ? '12px 14px' : '14px 16px',
                    borderRadius: '10px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#334155',
                    background: 'white',
                    fontFamily: 'monospace'
                  }}
                />
                <p style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  margin: '6px 0 0 0'
                }}>
                  Used for lesson evaluations
                </p>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSheetModal(false)}
                  style={{
                    flex: 1,
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px 20px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveSheetIds}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px 20px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Check style={{ width: '16px', height: '16px' }} />
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dual Role Manager Modal */}
      <DualRoleManager 
        isOpen={showDualRoleModal} 
        onClose={() => setShowDualRoleModal(false)} 
      />
    </div>
  );
};

export default AdminDashboard;