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
  Check,
  Loader,
  HelpCircle,
  Church,
  X,
  ChevronDown
} from 'lucide-react';

const AttendancePage = () => {
  const { classId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(classId);
  
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

  const formatDateForConfirmation = (dateString) => {
    const date = new Date(dateString + 'T12:00:00');
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    
    const suffix = (day) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    return `Sunday ${day}${suffix(day)} of ${month} ${year}`;
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
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

  // Check if user is admin and load all classes if they are
  useEffect(() => {
    const checkAdminAndLoadClasses = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        
        const isUserAdmin = profile.role === 'admin';
        setIsAdmin(isUserAdmin);

        if (isUserAdmin) {
          const { data: classesData, error: classesError } = await supabase
            .from('classes')
            .select('*')
            .order('year_level');

          if (classesError) throw classesError;
          setAllClasses(classesData || []);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    checkAdminAndLoadClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClassId && user) {
      loadClassAndStudents();
    } else if (!selectedClassId && user) {
      navigate('/teacher');
    }
  }, [selectedClassId, user, selectedDate]);

  const handleClassChange = (newClassId) => {
    setSelectedClassId(newClassId);
    setAttendance({});
  };

  const loadClassAndStudents = async () => {
    setLoading(true);
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', selectedClassId)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', selectedClassId)
        .order('row_number');

      if (studentsError) throw studentsError;
      setStudents(studentsData);

      setAttendance({});

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('student_id, status, synced_to_sheets')
        .eq('class_id', selectedClassId)
        .eq('attendance_date', selectedDate);

      if (attendanceError && attendanceError.code !== 'PGRST116') {
        throw attendanceError;
      }

      const attendanceMap = {};
      if (attendanceData && attendanceData.length > 0) {
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
    setAttendance(prev => {
      const currentStatus = prev[studentId]?.status;
      
      if (currentStatus === status) {
        const newState = { ...prev };
        delete newState[studentId];
        return newState;
      }
      
      return {
        ...prev,
        [studentId]: { status, synced: false }
      };
    });
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    const nearestSunday = getNearestSunday(newDate);
    setSelectedDate(nearestSunday);
  };

  const handleSaveClick = () => {
    if (stats.marked === 0) return;
    setShowConfirmation(true);
  };

  const saveAttendance = async () => {
    setShowConfirmation(false);
    setSaving(true);
    try {
      const records = [];
      
      for (const student of students) {
        const attendanceStatus = attendance[student.id];
        if (attendanceStatus?.status) {
          records.push({
            student_id: student.id,
            teacher_id: user.id,
            class_id: selectedClassId,
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
      paddingTop: isMobile ? '80px' : '100px',
      paddingBottom: isMobile ? '100px' : '60px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      boxSizing: 'border-box',
      display: 'flex',
      justifyContent: 'center'
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
        width: isMobile ? '100%' : '600px',
        padding: isMobile ? '0 30px' : '0 20px',
        boxSizing: 'border-box'
      }}>
        {/* Confirmation Modal */}
        <AnimatePresence>
          {showConfirmation && (
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
              onClick={() => setShowConfirmation(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'white',
                  borderRadius: '24px',
                  padding: isMobile ? '24px' : '32px',
                  maxWidth: '480px',
                  width: '100%',
                  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Calendar style={{ width: '28px', height: '28px', color: 'white' }} />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowConfirmation(false)}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '12px',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <X style={{ width: '20px', height: '20px', color: '#64748b' }} />
                  </motion.button>
                </div>

                <h2 style={{
                  fontSize: isMobile ? '22px' : '26px',
                  fontWeight: '800',
                  color: '#1e293b',
                  margin: '0 0 12px 0'
                }}>
                  Confirm Save & Sync
                </h2>

                <p style={{
                  fontSize: '15px',
                  color: '#64748b',
                  lineHeight: '1.6',
                  margin: '0 0 24px 0'
                }}>
                  You are about to save and sync attendance data for:
                </p>

                <div style={{
                  background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '24px',
                  border: '2px solid #667eea30'
                }}>
                  <p style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#667eea',
                    margin: 0,
                    textAlign: 'center'
                  }}>
                    {formatDateForConfirmation(selectedDate)}
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowConfirmation(false)}
                    style={{
                      flex: 1,
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '14px 24px',
                      fontSize: '15px',
                      fontWeight: '700',
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={saveAttendance}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '14px 24px',
                      fontSize: '15px',
                      fontWeight: '700',
                      color: 'white',
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Check style={{ width: '18px', height: '18px' }} />
                    Confirm
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            width: '100%',
            marginBottom: isMobile ? '24px' : '32px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: isMobile ? '20px' : '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? '16px' : '24px'
          }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/teacher')}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                width: isMobile ? '44px' : '52px',
                height: isMobile ? '44px' : '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                flexShrink: 0
              }}
            >
              <ArrowLeft style={{ color: 'white', width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px' }} />
            </motion.button>

            <div style={{ textAlign: 'center', flex: 1, margin: '0 12px', minWidth: 0 }}>
              <h1 style={{
                fontSize: isMobile ? '22px' : '32px',
                fontWeight: '800',
                color: '#1e293b',
                margin: '0 0 4px 0',
                lineHeight: 1.2
              }}>
                {classInfo?.name}
              </h1>
              <p style={{
                fontSize: isMobile ? '14px' : '16px',
                color: '#64748b',
                margin: 0,
                fontWeight: '500'
              }}>
                Year {classInfo?.year_level} Attendance
              </p>
            </div>

            <div style={{ width: isMobile ? '44px' : '52px', flexShrink: 0 }} />
          </div>

          {/* Admin Class Selector */}
          {isAdmin && allClasses.length > 0 && (
            <div style={{ marginBottom: isMobile ? '16px' : '20px', position: 'relative' }}>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: isMobile ? '14px 40px 14px 16px' : '16px 44px 16px 16px',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  fontSize: isMobile ? '15px' : '16px',
                  fontWeight: '600',
                  color: '#334155',
                  background: 'white',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              >
                {allClasses
                  .filter((cls, index, self) => 
                    index === self.findIndex((c) => c.name === cls.name)
                  )
                  .map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
              </select>
              <ChevronDown 
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20px',
                  height: '20px',
                  color: '#64748b',
                  pointerEvents: 'none'
                }}
              />
            </div>
          )}

          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            max="2026-06-30"
            min="2025-09-01"
            style={{
              width: '100%',
              padding: isMobile ? '14px 16px' : '16px',
              borderRadius: '12px',
              border: '2px solid #e2e8f0',
              fontSize: isMobile ? '16px' : '16px',
              fontWeight: '600',
              color: '#334155',
              background: 'white',
              cursor: 'pointer',
              textAlign: 'center',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
            }}
          />

          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: isMobile ? '10px' : '12px',
            marginTop: isMobile ? '16px' : '20px'
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
                padding: isMobile ? '12px 8px' : '14px 12px',
                textAlign: 'center',
                border: '2px solid #f1f5f9'
              }}>
                <div style={{
                  fontSize: isMobile ? '22px' : '26px',
                  fontWeight: '800',
                  color: stat.color,
                  marginBottom: '4px',
                  lineHeight: 1
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: '#94a3b8',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  lineHeight: 1.2
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Students List */}
        <div style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: isMobile ? '12px' : '20px'
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
                    borderRadius: '16px',
                    padding: isMobile ? '16px' : '20px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    border: currentStatus ? `2px solid ${getStatusConfig(currentStatus).border}` : '2px solid #f1f5f9',
                    height: '100%'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                    gap: '8px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: isMobile ? '16px' : '17px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '4px'
                      }}>
                        {student.student_name}
                      </div>
                      <div style={{
                        fontSize: isMobile ? '13px' : '14px',
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
                          padding: isMobile ? '4px 10px' : '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0
                        }}
                      >
                        <Check style={{ width: isMobile ? '13px' : '14px', height: isMobile ? '13px' : '14px', color: '#10b981' }} />
                        <span style={{ fontSize: isMobile ? '11px' : '11px', fontWeight: '700', color: '#10b981' }}>
                          Synced
                        </span>
                      </motion.div>
                    )}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: isMobile ? '8px' : '10px'
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
                            borderRadius: '10px',
                            padding: isMobile ? '12px 4px' : '14px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s ease',
                            minWidth: 0,
                            minHeight: isMobile ? '50px' : '56px'
                          }}
                        >
                          <Icon style={{
                            width: isMobile ? '18px' : '20px',
                            height: isMobile ? '18px' : '20px',
                            color: isSelected ? 'white' : config.color,
                            flexShrink: 0
                          }} />
                          <span style={{
                            fontSize: isMobile ? '11px' : '12px',
                            fontWeight: '700',
                            color: isSelected ? 'white' : config.color,
                            lineHeight: 1
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
            width: '100%',
            marginTop: '24px',
            marginBottom: isMobile ? '80px' : '24px',
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveClick}
            disabled={saving || stats.marked === 0}
            style={{
              width: '100%',
              background: saving || stats.marked === 0
                ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '16px',
              padding: isMobile ? '16px 24px' : '18px 32px',
              fontSize: isMobile ? '15px' : '17px',
              fontWeight: '800',
              color: 'white',
              cursor: saving || stats.marked === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '8px' : '12px',
              minHeight: isMobile ? '56px' : 'auto'
            }}
          >
            {saving ? (
              <>
                <Loader style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                Saving...
              </>
            ) : (
              <>
                <Save style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap' }}>Save & Sync ({stats.marked}/{stats.total})</span>
              </>
            )}
          </motion.button>
        </motion.div>
      </div>

      {/* Floating Legend Button */}
      <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowLegend(!showLegend)}
          style={{
            position: 'fixed',
            bottom: isMobile ? '20px' : '30px',
            right: isMobile ? '20px' : '30px',
          width: isMobile ? '56px' : '60px',
          height: isMobile ? '56px' : '60px',
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
        <AnimatePresence mode="wait">
          {showLegend ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X style={{ width: isMobile ? '26px' : '30px', height: isMobile ? '26px' : '30px', color: 'white' }} />
            </motion.div>
          ) : (
            <motion.div
              key="help"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <HelpCircle style={{ width: isMobile ? '26px' : '30px', height: isMobile ? '26px' : '30px', color: 'white' }} />
            </motion.div>
          )}
        </AnimatePresence>
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
              bottom: isMobile ? '78px' : '100px',
              right: isMobile ? '12px' : '12px',
              background: 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: isMobile ? '16px' : '20px',
              padding: isMobile ? '18px' : '22px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
              zIndex: 999,
              minWidth: isMobile ? '280px' : '320px',
              maxWidth: 'calc(100vw - 24px)'
            }}
          >
            <h3 style={{
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: isMobile ? '12px' : '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '0 0 14px 0'
            }}>
              Status Legend
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: isMobile ? '12px' : '14px'
            }}>
              {['P', 'L', 'UM', 'E', 'U'].map((status) => {
                const config = getStatusConfig(status);
                const Icon = config.icon;
                return (
                  <div key={status} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '12px' : '14px'
                  }}>
                    <div style={{
                      width: isMobile ? '40px' : '44px',
                      height: isMobile ? '40px' : '44px',
                      borderRadius: isMobile ? '10px' : '12px',
                      background: config.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: config.color }} />
                    </div>
                    <span style={{
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      color: '#475569'
                    }}>
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p style={{
              fontSize: '12px',
              color: '#94a3b8',
              marginTop: '14px',
              marginBottom: 0,
              fontWeight: '500'
            }}>
              💡 Tip: Click the same status again to deselect
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

  );
};

export default AttendancePage;