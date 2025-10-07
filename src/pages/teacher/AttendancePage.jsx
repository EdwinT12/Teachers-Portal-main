import { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext'; 
import supabase from '../../utils/supabase';
import { batchSyncAttendance } from '../../utils/googleSheetsAPI';
import toast from 'react-hot-toast';  
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  ArrowLeft,
  Save,
  RefreshCw,
  Check,
  Loader,
  HelpCircle,
  Church
} from 'lucide-react';

const AttendancePage = () => {
  const { classId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // Helper function to find nearest Sunday
  const getNearestSunday = (dateString) => {
    const date = new Date(dateString + 'T12:00:00');
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0) {
      return dateString;
    }
    
    const daysToPrevSunday = dayOfWeek;
    const daysToNextSunday = 7 - dayOfWeek;
    
    let nearestSunday;
    if (daysToPrevSunday <= daysToNextSunday) {
      nearestSunday = new Date(date);
      nearestSunday.setDate(date.getDate() - daysToPrevSunday);
    } else {
      nearestSunday = new Date(date);
      nearestSunday.setDate(date.getDate() + daysToNextSunday);
    }
    
    const year = nearestSunday.getFullYear();
    const month = String(nearestSunday.getMonth() + 1).padStart(2, '0');
    const day = String(nearestSunday.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    return getNearestSunday(todayString);
  });
  const [isMobile, setIsMobile] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (classId && user) {
      loadClassAndStudents();
    } else if (!classId && user) {
      navigate('/teacher');
    }
  }, [classId, user]);

  const loadClassAndStudents = async () => {
    setLoading(true);
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('row_number');

      if (studentsError) throw studentsError;
      setStudents(studentsData);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('student_id, status, synced_to_sheets')
        .eq('class_id', classId)
        .eq('attendance_date', selectedDate);

      if (attendanceError && attendanceError.code !== 'PGRST116') {
        throw attendanceError;
      }

      const attendanceMap = {};
      if (attendanceData) {
        attendanceData.forEach(record => {
          attendanceMap[record.student_id] = {
            status: record.status,
            synced: record.synced_to_sheets
          };
        });
      }
      setAttendance(attendanceMap);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: { status, synced: false }
    }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const records = [];
      
      for (const student of students) {
        const attendanceStatus = attendance[student.id];
        if (attendanceStatus?.status) {
          records.push({
            student_id: student.id,
            teacher_id: user.id,
            class_id: classId,
            attendance_date: selectedDate,
            status: attendanceStatus.status,
            column_identifier: formatDateForSheet(selectedDate),
            synced_to_sheets: false
          });
        }
      }

      if (records.length === 0) {
        toast.error('Please mark attendance for at least one student');
        setSaving(false);
        return;
      }

      const { data: savedRecords, error: saveError } = await supabase
        .from('attendance_records')
        .upsert(records, {
          onConflict: 'student_id,attendance_date',
          returning: 'representation'
        })
        .select();

      if (saveError) throw saveError;

      toast.success('Attendance saved!');

      try {
        await batchSyncAttendance(savedRecords);
        toast.success('Synced to Google Sheets!');
        
        const updatedAttendance = { ...attendance };
        savedRecords.forEach(record => {
          if (updatedAttendance[record.student_id]) {
            updatedAttendance[record.student_id].synced = true;
          }
        });
        setAttendance(updatedAttendance);
        
      } catch (syncError) {
        console.error('Sync error:', syncError);
        toast.error('Saved locally. Sync failed.');
      }

    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const formatDateForSheet = (dateString) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  };

  const getStatusConfig = (status) => {
    const configs = {
      P: { label: 'Present', icon: CheckCircle2, color: '#10b981', bg: '#d1fae5', border: '#6ee7b7' },
      L: { label: 'Late', icon: Clock, color: '#f59e0b', bg: '#fef3c7', border: '#fcd34d' },
      UM: { label: 'Unattended Mass', icon: Church, color: '#8b5cf6', bg: '#ede9fe', border: '#c4b5fd' },
      E: { label: 'Excused', icon: AlertCircle, color: '#3b82f6', bg: '#dbeafe', border: '#93c5fd' },
      U: { label: 'Unexcused', icon: XCircle, color: '#ef4444', bg: '#fee2e2', border: '#fca5a5' }
    };
    return configs[status] || configs.P;
  };

  const stats = {
    total: students.length,
    marked: Object.values(attendance).filter(a => a?.status).length,
    synced: Object.values(attendance).filter(a => a?.synced).length,
    present: Object.values(attendance).filter(a => a?.status === 'P').length
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
          <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Loading Class...</h3>
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: isMobile ? '16px 12px 40px' : '40px 24px 60px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      overflowX: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          maxWidth: '800px',
          margin: '0 auto 24px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: isMobile ? '20px' : '28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/teacher')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
          >
            <ArrowLeft style={{ color: 'white', width: '20px', height: '20px' }} />
          </motion.button>

          <div style={{ textAlign: 'center', flex: 1, margin: '0 16px' }}>
            <h1 style={{
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: '800',
              color: '#1e293b',
              margin: '0 0 4px 0',
              lineHeight: 1.2
            }}>
              {classInfo?.name}
            </h1>
            <p style={{
              fontSize: '13px',
              color: '#64748b',
              margin: 0,
              fontWeight: '500'
            }}>
              Year {classInfo?.year_level} Attendance
            </p>
          </div>

          <div style={{ width: '44px' }} />
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            const nearestSunday = getNearestSunday(e.target.value);
            setSelectedDate(nearestSunday);
            loadClassAndStudents();
          }}
          max="2026-06-30"
          min="2025-09-01"
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '12px',
            border: '2px solid #e2e8f0',
            fontSize: '15px',
            fontWeight: '600',
            color: '#334155',
            background: 'white',
            cursor: 'pointer'
          }}
        />

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: isMobile ? '8px' : '12px',
          marginTop: '16px'
        }}>
          {[
            { label: 'Total', value: stats.total, color: '#64748b' },
            { label: 'Marked', value: stats.marked, color: '#3b82f6' },
            { label: 'Present', value: stats.present, color: '#10b981' },
            { label: 'Synced', value: stats.synced, color: '#8b5cf6' }
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'white',
              borderRadius: '12px',
              padding: isMobile ? '10px 8px' : '12px',
              textAlign: 'center',
              border: '2px solid #f1f5f9'
            }}>
              <div style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '800',
                color: stat.color,
                marginBottom: '2px'
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: isMobile ? '10px' : '11px',
                color: '#94a3b8',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Students List */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <AnimatePresence>
          {students.map((student, index) => {
            const studentAttendance = attendance[student.id];
            const currentStatus = studentAttendance?.status;
            
            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  padding: isMobile ? '16px' : '20px',
                  marginBottom: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  border: currentStatus ? `2px solid ${getStatusConfig(currentStatus).border}` : '2px solid #f1f5f9'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: isMobile ? '16px' : '17px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '4px'
                    }}>
                      {student.student_name}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      {student.house}
                    </div>
                  </div>

                  {studentAttendance?.synced && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        background: '#d1fae5',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Check style={{ width: '14px', height: '14px', color: '#10b981' }} />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981' }}>
                        Synced
                      </span>
                    </motion.div>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: isMobile ? '6px' : '8px'
                }}>
                  {['P', 'L', 'UM', 'E', 'U'].map((status) => {
                    const config = getStatusConfig(status);
                    const isSelected = currentStatus === status;
                    const Icon = config.icon;
                    
                    return (
                      <motion.button
                        key={status}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAttendanceChange(student.id, status)}
                        style={{
                          background: isSelected ? config.color : 'white',
                          border: `2px solid ${isSelected ? config.color : '#e2e8f0'}`,
                          borderRadius: '12px',
                          padding: isMobile ? '10px 6px' : '12px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Icon style={{
                          width: isMobile ? '18px' : '20px',
                          height: isMobile ? '18px' : '20px',
                          color: isSelected ? 'white' : config.color
                        }} />
                        <span style={{
                          fontSize: isMobile ? '10px' : '11px',
                          fontWeight: '700',
                          color: isSelected ? 'white' : config.color
                        }}>
                          {status}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Save Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          maxWidth: '800px',
          margin: '24px auto 0',
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={saveAttendance}
          disabled={saving || stats.marked === 0}
          style={{
            width: '100%',
            maxWidth: '400px',
            background: saving || stats.marked === 0
              ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: '16px',
            padding: '18px 32px',
            fontSize: '17px',
            fontWeight: '800',
            color: 'white',
            cursor: saving || stats.marked === 0 ? 'not-allowed' : 'pointer',
            boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
        >
          {saving ? (
            <>
              <Loader style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
              Saving...
            </>
          ) : (
            <>
              <Save style={{ width: '20px', height: '20px' }} />
              Save & Sync ({stats.marked}/{stats.total})
            </>
          )}
        </motion.button>
      </motion.div>

      {/* Floating Legend Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowLegend(!showLegend)}
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
      >
        <HelpCircle style={{ width: '28px', height: '28px', color: 'white' }} />
      </motion.button>

      {/* Legend Popup */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            style={{
              position: 'fixed',
              bottom: '170px',
              right: '20px',
              background: 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
              zIndex: 999,
              minWidth: isMobile ? '280px' : '320px'
            }}
          >
            <h3 style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Status Legend
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '12px'
            }}>
              {['P', 'L', 'UM', 'E', 'U'].map((status) => {
                const config = getStatusConfig(status);
                const Icon = config.icon;
                return (
                  <div key={status} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: config.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon style={{ width: '22px', height: '22px', color: config.color }} />
                    </div>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#475569'
                    }}>
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendancePage;
