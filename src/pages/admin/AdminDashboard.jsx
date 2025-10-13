import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import BulkStudentImport from '../../components/BulkStudentImport';
import UnifiedEvaluationSetup from '../../components/UnifiedEvaluationSetup';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  BookOpen,
  AlertTriangle,
  Trash2,
  Check,
  X
} from 'lucide-react';
 
const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assigningTeacher, setAssigningTeacher] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobile, setIsMobile] = useState(false);

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
      const { error } = await supabase
        .from('profiles')
        .update({ default_class_id: classId })
        .eq('id', teacherId);

      if (error) throw error;

      toast.success('Teacher assigned successfully!');
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
      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '10px' : '16px',
        marginBottom: isMobile ? '20px' : '24px'
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
              padding: isMobile ? '16px 12px' : '20px',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              border: '2px solid #f1f5f9',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: '12px',
              background: `${stat.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <stat.icon style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: stat.color }} />
            </div>
            <div style={{
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: '800',
              color: stat.color,
              marginBottom: '4px',
              lineHeight: 1
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: isMobile ? '11px' : '13px',
              color: '#64748b',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
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
            marginBottom: isMobile ? '16px' : '24px',
            overflow: 'hidden',
            border: '2px solid #fbbf24'
          }}
        >
          <div style={{
            padding: isMobile ? '16px' : '20px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderBottom: '2px solid #fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertTriangle style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#92400e' }} />
            <h2 style={{
              fontSize: isMobile ? '16px' : '18px',
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
                  padding: isMobile ? '12px' : '16px',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{
                  marginBottom: '12px'
                }}>
                  <div style={{
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: '700',
                    color: '#1e293b',
                    marginBottom: '4px'
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
                    fontSize: '11px',
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
                    borderRadius: '10px',
                    border: '2px solid #e2e8f0',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: assigningTeacher === teacher.id ? '#f1f5f9' : 'white',
                    color: '#334155'
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
          padding: isMobile ? '16px' : '20px',
          background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
          borderBottom: '2px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CheckCircle style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#065f46' }} />
          <h2 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#065f46',
            margin: 0
          }}>
            Approved Teachers ({approvedTeachers.length})
          </h2>
        </div>

        {approvedTeachers.length === 0 ? (
          <div style={{
            padding: isMobile ? '32px 16px' : '48px 24px',
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
                  padding: isMobile ? '12px' : '16px',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '4px'
                    }}>
                      {teacher.full_name || 'N/A'}
                    </div>
                    <div style={{
                      fontSize: isMobile ? '12px' : '13px',
                      color: '#64748b',
                      marginBottom: '6px'
                    }}>
                      {teacher.email}
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
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
                  padding: '8px 10px',
                  background: teacher.status === 'active' ? '#d1fae5' : '#fee2e2',
                  borderRadius: '8px',
                  border: `1px solid ${teacher.status === 'active' ? '#10b981' : '#ef4444'}`
                }}>
                  {teacher.status === 'active' ? (
                    <Check style={{ width: '14px', height: '14px', color: '#065f46' }} />
                  ) : (
                    <X style={{ width: '14px', height: '14px', color: '#dc2626' }} />
                  )}
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: teacher.status === 'active' ? '#065f46' : '#dc2626',
                    textTransform: 'capitalize'
                  }}>
                    {teacher.status}
                  </span>
                </div>
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
      boxSizing: 'border-box'
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

      <div style={{
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            marginBottom: isMobile ? '20px' : '32px'
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
            Manage teachers, students, and evaluation system
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            display: 'flex',
            gap: isMobile ? '6px' : '8px',
            marginBottom: isMobile ? '20px' : '24px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '8px'
          }}
        >
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'import-attendance', label: '📥 Attendance' },
            { id: 'evaluation-setup', label: '⭐ Evaluation' }
          ].map((tab) => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: isMobile ? '12px 20px' : '14px 24px',
                background: activeTab === tab.id 
                  ? 'rgba(255,255,255,0.95)' 
                  : 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(20px)',
                color: activeTab === tab.id ? '#1e293b' : 'white',
                border: activeTab === tab.id ? '2px solid white' : '2px solid rgba(255,255,255,0.3)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '15px',
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
            {activeTab === 'import-attendance' && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '24px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '2px solid #f1f5f9'
              }}>
                <BulkStudentImport />
              </div>
            )}
            {activeTab === 'evaluation-setup' && (
              <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '24px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '2px solid #f1f5f9'
              }}>
                <UnifiedEvaluationSetup />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminDashboard;