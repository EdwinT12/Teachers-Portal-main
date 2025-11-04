import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../utils/supabase';
import {
  getAllTeachersVisibility,
  adminBulkUpdateVisibility,
  adminUpdateTeacherVisibility,
  adminResetTeacherVisibility
} from '../utils/evaluationVisibilityUtils';
import toast from 'react-hot-toast';
import {
  Settings,
  Users,
  Lock,
  Unlock,
  RotateCcw,
  Check,
  X,
  Loader,
  Award,
  Heart,
  BookOpen,
  Zap,
  ChevronDown,
  Search,
  Save,
  Globe
} from 'lucide-react';

const EvaluationCriteriaSettings = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Bulk settings state
  const [bulkSettings, setBulkSettings] = useState({
    show_homework: true,
    show_discipline: false,
    show_participation: false,
    show_behaviour: false
  });
  const [bulkOverride, setBulkOverride] = useState(false);

  const categories = [
    { key: 'show_homework', label: 'Homework', icon: BookOpen, color: '#f59e0b' },
    { key: 'show_discipline', label: 'Discipline', icon: Award, color: '#3b82f6' },
    { key: 'show_participation', label: 'Active Participation', icon: Zap, color: '#8b5cf6' },
    { key: 'show_behaviour', label: 'Behaviour', icon: Heart, color: '#10b981' }
  ];

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const data = await getAllTeachersVisibility();
      setTeachers(data);
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('Failed to load teacher settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSetting = async (teacherId, settingKey, currentValue) => {
    const teacher = teachers.find(t => t.teacher_id === teacherId);
    if (!teacher) return;

    const newSettings = {
      show_homework: teacher.show_homework,
      show_discipline: teacher.show_discipline,
      show_participation: teacher.show_participation,
      show_behaviour: teacher.show_behaviour,
      [settingKey]: !currentValue
    };

    // Optimistically update UI
    setTeachers(prev => prev.map(t => 
      t.teacher_id === teacherId 
        ? { ...t, [settingKey]: !currentValue }
        : t
    ));

    const success = await adminUpdateTeacherVisibility(teacherId, newSettings, teacher.admin_override);
    if (!success) {
      // Revert on failure
      setTeachers(prev => prev.map(t => 
        t.teacher_id === teacherId 
          ? { ...t, [settingKey]: currentValue }
          : t
      ));
    }
  };

  const handleToggleOverride = async (teacherId, currentOverride) => {
    const teacher = teachers.find(t => t.teacher_id === teacherId);
    if (!teacher) return;

    const settings = {
      show_homework: teacher.show_homework,
      show_discipline: teacher.show_discipline,
      show_participation: teacher.show_participation,
      show_behaviour: teacher.show_behaviour
    };

    // Optimistically update UI
    setTeachers(prev => prev.map(t => 
      t.teacher_id === teacherId 
        ? { ...t, admin_override: !currentOverride }
        : t
    ));

    const success = await adminUpdateTeacherVisibility(teacherId, settings, !currentOverride);
    if (!success) {
      // Revert on failure
      setTeachers(prev => prev.map(t => 
        t.teacher_id === teacherId 
          ? { ...t, admin_override: currentOverride }
          : t
      ));
    }
  };

  const handleResetTeacher = async (teacherId) => {
    const success = await adminResetTeacherVisibility(teacherId);
    if (success) {
      loadTeachers();
    }
  };

  const handleBulkUpdate = async () => {
    setSaving(true);
    const success = await adminBulkUpdateVisibility(bulkSettings, bulkOverride);
    setSaving(false);

    if (success) {
      setShowBulkModal(false);
      loadTeachers();
    }
  };

  const filteredTeachers = teachers.filter(teacher => {
    if (!searchQuery) return true;
    const name = teacher.profiles?.full_name || '';
    const email = teacher.profiles?.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const stats = {
    total: teachers.length,
    withHomework: teachers.filter(t => t.show_homework).length,
    withDiscipline: teachers.filter(t => t.show_discipline).length,
    withParticipation: teachers.filter(t => t.show_participation).length,
    withBehaviour: teachers.filter(t => t.show_behaviour).length,
    locked: teachers.filter(t => t.admin_override).length
  };

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center'
      }}>
        <Loader style={{ 
          width: '48px', 
          height: '48px', 
          color: '#667eea',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p style={{ color: '#64748b', fontSize: '16px', fontWeight: '600' }}>
          Loading teacher settings...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Settings style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
            <div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '800',
                color: '#1e293b',
                margin: 0,
                marginBottom: '4px'
              }}>
                Evaluation Criteria Settings
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                Configure which evaluation criteria teachers can use
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBulkModal(true)}
            style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
          >
            <Globe style={{ width: '18px', height: '18px' }} />
            Bulk Update All Teachers
          </motion.button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Users style={{ width: '16px', height: '16px', color: '#667eea' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                Total Teachers
              </span>
            </div>
            <p style={{
              fontSize: '24px',
              fontWeight: '800',
              color: '#1e293b',
              margin: 0
            }}>
              {stats.total}
            </p>
          </div>

          <div style={{
            padding: '12px 16px',
            background: '#fef3c7',
            borderRadius: '12px',
            border: '1.5px solid #f59e0b30'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <BookOpen style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                With Homework
              </span>
            </div>
            <p style={{
              fontSize: '24px',
              fontWeight: '800',
              color: '#92400e',
              margin: 0
            }}>
              {stats.withHomework}
            </p>
          </div>

          <div style={{
            padding: '12px 16px',
            background: '#dbeafe',
            borderRadius: '12px',
            border: '1.5px solid #3b82f630'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Award style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af' }}>
                With Discipline
              </span>
            </div>
            <p style={{
              fontSize: '24px',
              fontWeight: '800',
              color: '#1e40af',
              margin: 0
            }}>
              {stats.withDiscipline}
            </p>
          </div>

          <div style={{
            padding: '12px 16px',
            background: '#fef3c7',
            borderRadius: '12px',
            border: '1.5px solid #f59e0b30'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Lock style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                Locked by Admin
              </span>
            </div>
            <p style={{
              fontSize: '24px',
              fontWeight: '800',
              color: '#92400e',
              margin: 0
            }}>
              {stats.locked}
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            color: '#64748b'
          }} />
          <input
            type="text"
            placeholder="Search teachers by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 14px 14px 44px',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: '#1e293b',
              background: 'white'
            }}
          />
        </div>
      </motion.div>

      {/* Bulk Update Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowBulkModal(false)}
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
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: '32px',
                maxWidth: '600px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Globe style={{ width: '24px', height: '24px', color: '#667eea' }} />
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: 0
                  }}>
                    Bulk Update All Teachers
                  </h3>
                </div>
                <button
                  onClick={() => setShowBulkModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px'
                  }}
                >
                  <X style={{ width: '24px', height: '24px' }} />
                </button>
              </div>

              <p style={{
                fontSize: '14px',
                color: '#64748b',
                marginBottom: '24px',
                lineHeight: '1.6'
              }}>
                Configure the default evaluation criteria for all teachers. This will override individual teacher settings.
              </p>

              {/* Criteria Toggles */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '24px'
              }}>
                {categories.map(category => {
                  const Icon = category.icon;
                  const isEnabled = bulkSettings[category.key];

                  return (
                    <motion.div
                      key={category.key}
                      whileHover={{ scale: 1.02 }}
                      style={{
                        padding: '16px',
                        background: isEnabled ? `${category.color}10` : '#f8fafc',
                        border: `2px solid ${isEnabled ? category.color : '#e2e8f0'}`,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => setBulkSettings(prev => ({
                        ...prev,
                        [category.key]: !prev[category.key]
                      }))}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: isEnabled ? category.color : '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon style={{ 
                            width: '20px', 
                            height: '20px', 
                            color: isEnabled ? 'white' : '#64748b' 
                          }} />
                        </div>
                        <div>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: '#1e293b',
                            marginBottom: '2px'
                          }}>
                            {category.label}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b'
                          }}>
                            {isEnabled ? 'Visible to all teachers' : 'Hidden from all teachers'}
                          </div>
                        </div>
                      </div>

                      <motion.div
                        animate={{
                          background: isEnabled ? category.color : '#cbd5e1'
                        }}
                        style={{
                          width: '48px',
                          height: '28px',
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        <motion.div
                          animate={{
                            x: isEnabled ? 20 : 0
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 30
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                        />
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Override Toggle */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                style={{
                  padding: '16px',
                  background: bulkOverride ? '#fef3c7' : '#f8fafc',
                  border: `2px solid ${bulkOverride ? '#f59e0b' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  marginBottom: '24px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setBulkOverride(!bulkOverride)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: bulkOverride ? '#f59e0b' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {bulkOverride ? (
                      <Lock style={{ width: '20px', height: '20px', color: 'white' }} />
                    ) : (
                      <Unlock style={{ width: '20px', height: '20px', color: '#64748b' }} />
                    )}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '2px'
                    }}>
                      Lock Settings
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>
                      {bulkOverride ? 'Teachers cannot modify their settings' : 'Teachers can customize their settings'}
                    </div>
                  </div>
                </div>

                <motion.div
                  animate={{
                    background: bulkOverride ? '#f59e0b' : '#cbd5e1'
                  }}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px',
                    cursor: 'pointer'
                  }}
                >
                  <motion.div
                    animate={{
                      x: bulkOverride ? 20 : 0
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30
                    }}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </motion.div>
              </motion.div>

              {/* Warning */}
              <div style={{
                padding: '12px',
                background: '#fef3c7',
                border: '1.5px solid #f59e0b',
                borderRadius: '12px',
                marginBottom: '24px'
              }}>
                <p style={{
                  fontSize: '13px',
                  color: '#92400e',
                  margin: 0,
                  lineHeight: '1.6',
                  fontWeight: '500'
                }}>
                  ⚠️ <strong>Warning:</strong> This will apply these settings to all {stats.total} teachers, overriding any individual customizations.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowBulkModal(false)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.5 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpdate}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: saving ? '#94a3b8' : 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'white',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: saving ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  {saving ? (
                    <>
                      <Loader style={{ 
                        width: '18px', 
                        height: '18px',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save style={{ width: '18px', height: '18px' }} />
                      Apply to All Teachers
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teachers List */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
        gap: '16px'
      }}>
        {filteredTeachers.map((teacher, index) => (
          <motion.div
            key={teacher.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              border: teacher.admin_override ? '2px solid #f59e0b' : '1.5px solid #e2e8f0'
            }}
          >
            {/* Teacher Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '1.5px solid #e2e8f0'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '700',
                color: 'white',
                flexShrink: 0
              }}>
                {(teacher.profiles?.full_name || 'T')
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0,
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {teacher.profiles?.full_name || 'Unknown Teacher'}
                </h3>
                <p style={{
                  fontSize: '13px',
                  color: '#64748b',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {teacher.profiles?.email || 'No email'}
                </p>
              </div>
              {teacher.admin_override && (
                <Lock style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
              )}
            </div>

            {/* Criteria Toggles */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '16px'
            }}>
              {categories.map(category => {
                const Icon = category.icon;
                const isEnabled = teacher[category.key];

                return (
                  <div
                    key={category.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: isEnabled ? `${category.color}10` : '#f8fafc',
                      borderRadius: '10px',
                      border: `1.5px solid ${isEnabled ? category.color : '#e2e8f0'}30`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isEnabled ? category.color : '#e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Icon style={{ 
                          width: '16px', 
                          height: '16px', 
                          color: isEnabled ? 'white' : '#64748b' 
                        }} />
                      </div>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {category.label}
                      </span>
                    </div>

                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleToggleSetting(teacher.teacher_id, category.key, isEnabled)}
                      animate={{
                        background: isEnabled ? category.color : '#cbd5e1'
                      }}
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px',
                        cursor: 'pointer'
                      }}
                    >
                      <motion.div
                        animate={{
                          x: isEnabled ? 20 : 0
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      />
                    </motion.div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleToggleOverride(teacher.teacher_id, teacher.admin_override)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: teacher.admin_override ? '#fef3c7' : '#f1f5f9',
                  border: `1.5px solid ${teacher.admin_override ? '#f59e0b' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: teacher.admin_override ? '#92400e' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {teacher.admin_override ? (
                  <>
                    <Unlock style={{ width: '14px', height: '14px' }} />
                    Unlock
                  </>
                ) : (
                  <>
                    <Lock style={{ width: '14px', height: '14px' }} />
                    Lock
                  </>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleResetTeacher(teacher.teacher_id)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#f1f5f9',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <RotateCcw style={{ width: '14px', height: '14px' }} />
                Reset
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredTeachers.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#64748b'
        }}>
          <Users style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            opacity: 0.5
          }} />
          <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            No teachers found
          </p>
          <p style={{ fontSize: '14px', margin: 0 }}>
            {searchQuery ? 'Try a different search query' : 'No teachers have been set up yet'}
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EvaluationCriteriaSettings;