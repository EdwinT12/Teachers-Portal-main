import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { 
  Calendar,
  Users,
  TrendingUp,
  ArrowLeft,
  ChevronDown,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader,
  Download
} from 'lucide-react';
import AttendanceGrid from '../../components/AttendanceGrid';
import AttendanceSummary from '../../components/AttendanceSummary';
import ClassAnalytics from '../../components/ClassAnalytics';

const ExtendedDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [summaryData, setSummaryData] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('grid');
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkAdminAndLoadClasses = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, default_class_id')
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
          
          if (classesData && classesData.length > 0) {
            setSelectedClassId(classesData[0].id);
          }
        } else {
          if (profile.default_class_id) {
            setSelectedClassId(profile.default_class_id);
            
            const { data: classData, error: classError } = await supabase
              .from('classes')
              .select('*')
              .eq('id', profile.default_class_id)
              .single();

            if (!classError && classData) {
              setAllClasses([classData]);
            }
          }
        }
      } catch (error) {
        console.error('Error loading classes:', error);
        toast.error('Failed to load class data');
      }
    };

    checkAdminAndLoadClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassData();
    }
  }, [selectedClassId]);

  const loadClassData = async () => {
    setLoading(true);
    try {
      // Load class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', selectedClassId)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      // Load students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', selectedClassId)
        .order('student_name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Load ALL attendance records for this class
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('class_id', selectedClassId)
        .order('attendance_date');

      if (attendanceError && attendanceError.code !== 'PGRST116') {
        throw attendanceError;
      }

      // Extract unique dates and format as weeks
      const uniqueDates = [...new Set((attendanceRecords || []).map(r => r.attendance_date))];
      const sortedDates = uniqueDates.sort();
      
      const formattedWeeks = sortedDates.map(date => ({
        date: date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      }));
      setWeeks(formattedWeeks);

      // Create attendance map
      const attendanceMap = {};
      (attendanceRecords || []).forEach(record => {
        const key = `${record.student_id}-${record.attendance_date}`;
        attendanceMap[key] = record;
      });
      setAttendanceData(attendanceMap);

      // Calculate summary data
      calculateSummary(studentsData, formattedWeeks, attendanceMap);

    } catch (error) {
      console.error('Error loading class data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (studentsData, weeksData, attendanceMap) => {
    if (!studentsData || !weeksData || studentsData.length === 0 || weeksData.length === 0) {
      setSummaryData(null);
      return;
    }

    const studentStats = studentsData.map(student => {
      let present = 0;
      let late = 0;
      let absent = 0;
      let excused = 0;
      let unattendedMass = 0;
      let totalSessions = weeksData.length;

      weeksData.forEach(week => {
        const key = `${student.id}-${week.date}`;
        const record = attendanceMap[key];
        
        if (record) {
          switch (record.status) {
            case 'P': present++; break;
            case 'L': late++; break;
            case 'U': absent++; break;
            case 'E': excused++; break;
            case 'UM': unattendedMass++; break;
          }
        }
      });

      const attendancePercentage = totalSessions > 0
        ? (((present + late) / totalSessions) * 100).toFixed(1)
        : '0.0';

      return {
        studentId: student.id,
        studentName: student.student_name,
        present,
        late,
        absent,
        excused,
        unattendedMass,
        totalSessions,
        attendancePercentage
      };
    });

    studentStats.sort((a, b) => parseFloat(b.attendancePercentage) - parseFloat(a.attendancePercentage));

    const totalRecords = studentStats.reduce((sum, s) => sum + s.totalSessions, 0);
    const totalPresent = studentStats.reduce((sum, s) => sum + s.present + s.late, 0);
    const overallAttendance = totalRecords > 0
      ? ((totalPresent / totalRecords) * 100).toFixed(1)
      : '0.0';

    setSummaryData({
      totalStudents: studentsData.length,
      totalWeeks: weeksData.length,
      overallAttendance,
      studentStats
    });
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    setShowClassDropdown(false);
    setAttendanceData({});
  };

  const handleDataUpdate = () => {
    loadClassData();
  };

  const exportToCSV = () => {
    if (!summaryData || !summaryData.studentStats || summaryData.studentStats.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Student Name', 'Present', 'Late', 'Absent', 'Excused', 'Unattended Mass', 'Total Sessions', 'Attendance %'];
    
    const rows = summaryData.studentStats.map(student => [
      student.studentName,
      student.present,
      student.late,
      student.absent,
      student.excused,
      student.unattendedMass,
      student.totalSessions,
      student.attendancePercentage
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${classInfo?.name || 'class'}_attendance_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('Attendance data exported!');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <Loader style={{ 
          width: '48px', 
          height: '48px', 
          color: '#10b981',
          animation: 'spin 1s linear infinite' 
        }} />
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

  if (!selectedClassId) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <AlertTriangle style={{ 
            width: '48px', 
            height: '48px', 
            color: '#f59e0b',
            margin: '0 auto 16px'
          }} />
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>
            No Class Selected
          </h2>
          <p style={{ color: '#666', margin: '0 0 20px 0' }}>
            Please select a class to view attendance data
          </p>
          <button
            onClick={() => navigate('/teacher')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      paddingTop: isMobile ? '72px' : '88px',
      paddingBottom: isMobile ? '80px' : '40px'
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: isMobile ? '0 16px' : '0 24px'
      }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: isMobile ? '20px' : '32px'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <button
              onClick={() => navigate('/teacher')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: isMobile ? '8px 16px' : '10px 20px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                color: '#374151',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#10b981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
              {!isMobile && 'Back'}
            </button>

            <h1 style={{
              fontSize: isMobile ? '22px' : '32px',
              fontWeight: '800',
              color: '#1a1a1a',
              margin: 0
            }}>
              Extended Dashboard
            </h1>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {isAdmin && allClasses.length > 0 && (
              <div style={{ position: 'relative', flex: isMobile ? '1' : '0 0 auto' }}>
                <button
                  onClick={() => setShowClassDropdown(!showClassDropdown)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: isMobile ? '12px 16px' : '12px 20px',
                    backgroundColor: 'white',
                    border: '2px solid #10b981',
                    borderRadius: '12px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    minWidth: isMobile ? '100%' : '250px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0fdf4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users style={{ width: '18px', height: '18px', color: '#10b981' }} />
                    <span>{classInfo?.name || 'Select Class'}</span>
                  </div>
                  <ChevronDown 
                    style={{ 
                      width: '18px', 
                      height: '18px',
                      transform: showClassDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }} 
                  />
                </button>

                <AnimatePresence>
                  {showClassDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '8px',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}
                    >
                      {allClasses.map((cls) => (
                        <button
                          key={cls.id}
                          onClick={() => handleClassChange(cls.id)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            backgroundColor: cls.id === selectedClassId ? '#f0fdf4' : 'white',
                            border: 'none',
                            borderBottom: '1px solid #f3f4f6',
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: cls.id === selectedClassId ? '600' : '500',
                            color: cls.id === selectedClassId ? '#10b981' : '#374151',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (cls.id !== selectedClassId) {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (cls.id !== selectedClassId) {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          {cls.name}
                          {cls.id === selectedClassId && (
                            <CheckCircle2 
                              style={{ 
                                width: '16px', 
                                height: '16px',
                                color: '#10b981',
                                float: 'right',
                                marginTop: '2px'
                              }} 
                            />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div style={{ 
              display: 'flex', 
              gap: '8px',
              flex: isMobile ? '1' : '0 0 auto'
            }}>
              <button
                onClick={exportToCSV}
                disabled={!summaryData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: isMobile ? '12px 16px' : '12px 20px',
                  backgroundColor: summaryData ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: summaryData ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  flex: isMobile ? '1' : '0 0 auto'
                }}
                onMouseEnter={(e) => {
                  if (summaryData) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (summaryData) {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                  }
                }}
              >
                <Download style={{ width: '16px', height: '16px' }} />
                {!isMobile && 'Export CSV'}
              </button>
            </div>
          </div>
        </motion.div>

        {summaryData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: isMobile ? '12px' : '16px',
              marginBottom: isMobile ? '20px' : '32px'
            }}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: isMobile ? '16px' : '20px',
              border: '2px solid #10b981',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#d1fae5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <TrendingUp style={{ width: '20px', height: '20px', color: '#10b981' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '12px',
                    color: '#666',
                    margin: '0 0 4px 0',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Overall
                  </p>
                  <p style={{
                    fontSize: isMobile ? '24px' : '28px',
                    fontWeight: '700',
                    color: '#10b981',
                    margin: 0
                  }}>
                    {summaryData.overallAttendance}%
                  </p>
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: isMobile ? '16px' : '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Users style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '12px',
                    color: '#666',
                    margin: '0 0 4px 0',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Students
                  </p>
                  <p style={{
                    fontSize: isMobile ? '24px' : '28px',
                    fontWeight: '700',
                    color: '#1a1a1a',
                    margin: 0
                  }}>
                    {summaryData.totalStudents}
                  </p>
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: isMobile ? '16px' : '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Calendar style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '12px',
                    color: '#666',
                    margin: '0 0 4px 0',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Weeks
                  </p>
                  <p style={{
                    fontSize: isMobile ? '24px' : '28px',
                    fontWeight: '700',
                    color: '#1a1a1a',
                    margin: 0
                  }}>
                    {summaryData.totalWeeks}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: isMobile ? '8px' : '8px',
            marginBottom: isMobile ? '16px' : '24px',
            display: 'flex',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'grid', label: 'Attendance Grid', icon: Calendar },
            { id: 'summary', label: 'Summary', icon: BarChart3 },
            { id: 'analytics', label: 'Analytics', icon: Activity }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: isMobile ? '1' : '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: isMobile ? '12px 16px' : '12px 24px',
                  backgroundColor: isActive ? '#10b981' : 'transparent',
                  color: isActive ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Icon style={{ width: '16px', height: '16px' }} />
                {!isMobile && tab.label}
              </button>
            );
          })}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'grid' && (
              <AttendanceGrid
                students={students}
                weeks={weeks}
                attendanceData={attendanceData}
                classId={selectedClassId}
                teacherId={user?.id}
                onDataUpdate={handleDataUpdate}
              />
            )}

            {activeTab === 'summary' && (
              <AttendanceSummary
                summaryData={summaryData}
                classInfo={classInfo}
                students={students}
                weeks={weeks}
                attendanceData={attendanceData}
              />
            )}

            {activeTab === 'analytics' && (
              <ClassAnalytics
                summaryData={summaryData}
                classInfo={classInfo}
                students={students}
                weeks={weeks}
                attendanceData={attendanceData}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ExtendedDashboard;
