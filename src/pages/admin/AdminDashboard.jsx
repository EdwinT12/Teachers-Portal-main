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
  Edit
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      paddingTop: isMobile ? '80px' : '100px',
      paddingBottom: isMobile ? '100px' : '60px',
      paddingLeft: isMobile ? '16px' : '60px',
      paddingRight: isMobile ? '16px' : '60px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      boxSizing: 'border-box',
      width: '100%',
      overflow: 'hidden'
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
      `}</style>

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

      <div style={{
        maxWidth: '100%',
        margin: '0 auto',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            marginBottom: isMobile ? '20px' : '24px'
          }}
        >
          <h1 style={{
            fontSize: isMobile ? '28px' : '36px',
            fontWeight: '800',
            color: 'white',
            margin: '0 0 8px 0',
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
            Admin Dashboard
          </h1>
          <p style={{
            fontSize: isMobile ? '14px' : '16px',
            color: 'rgba(255,255,255,0.9)',
            margin: 0,
            textAlign: 'center',
            fontWeight: '500'
          }}>
            Manage teachers, students, track progress, and log catechism lessons
          </p>
        </motion.div>

        {/* Tabs - Overview, Weekly Report, Catechism, Update Sheets */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            display: 'flex',
            gap: isMobile ? '6px' : '8px',
            marginBottom: isMobile ? '16px' : '20px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '4px'
          }}
        >
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'parents', label: 'Parents' },
            { id: 'absence-requests', label: 'Absence Requests' },
            { id: 'weekly-report', label: 'Weekly Report' },
            { id: 'catechism-tracker', label: 'Log Catechism' },
            { id: 'update-sheets', label: 'Update Sheets' },
            { id: 'evaluation-criteria', label: 'Evaluation Criteria' }
          ].map((tab) => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: isMobile ? '10px 16px' : '12px 20px',
                background: activeTab === tab.id 
                  ? 'rgba(255,255,255,0.95)' 
                  : 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(20px)',
                color: activeTab === tab.id ? '#1e293b' : 'white',
                border: activeTab === tab.id ? '2px solid white' : '2px solid rgba(255,255,255,0.3)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: '700',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                boxShadow: activeTab === tab.id ? '0 4px 16px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'parents' && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '2px solid #f1f5f9'
              }}>
                <ParentVerificationPanel />
              </div>
            )}

            {activeTab === 'absence-requests' && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '2px solid #f1f5f9'
              }}>
                <AdminAbsenceRequestsPanel />
              </div>
            )}

            {activeTab === 'weekly-report' && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '2px solid #f1f5f9'
              }}>
                <WeeklyReport />
              </div>
            )}
            {activeTab === 'catechism-tracker' && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '2px solid #f1f5f9'
              }}>
                <CatechismLessonTracker />
              </div>
            )}
            {activeTab === 'update-sheets' && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '2px solid #f1f5f9'
              }}>
                <BulkStudentImport />
              </div>
            )}
            {activeTab === 'evaluation-criteria' && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '2px solid #f1f5f9'
              }}>
                <EvaluationCriteriaSettings />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dual Role Manager Modal */}
      <DualRoleManager 
        isOpen={showDualRoleModal} 
        onClose={() => setShowDualRoleModal(false)} 
      />
    </div>
  );
};

export default AdminDashboard;