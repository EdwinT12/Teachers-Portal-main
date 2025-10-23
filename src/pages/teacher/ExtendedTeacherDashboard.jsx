import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Calendar, Users, TrendingUp, Loader, FileText, BookOpen } from 'lucide-react';
import AttendanceGrid from '../../components/AttendanceGrid';
import AttendanceSummary from '../../components/AttendanceSummary';
import LessonPlanViewer from '../../components/LessonPlanViewer';

const ExtendedTeacherDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [summaryData, setSummaryData] = useState(null);
  const [activeView, setActiveView] = useState('grid'); // 'grid' or 'summary'
  const [showLessonPlan, setShowLessonPlan] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, default_class_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      if (!profileData.default_class_id) {
        toast.error('You have not been assigned to a class yet.');
        navigate('/teacher');
        return;
      }

      // Load class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', profileData.default_class_id)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      // Load students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', profileData.default_class_id)
        .order('row_number');

      if (studentsError) throw studentsError;
      setStudents(studentsData);

      // Load attendance records for the current academic year
      const currentDate = new Date();
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      const endOfYear = new Date(currentDate.getFullYear(), 11, 31);

      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('class_id', profileData.default_class_id)
        .gte('attendance_date', startOfYear.toISOString().split('T')[0])
        .lte('attendance_date', endOfYear.toISOString().split('T')[0])
        .order('attendance_date');

      if (attendanceError && attendanceError.code !== 'PGRST116') {
        throw attendanceError;
      }

      // Process attendance data into weeks
      processAttendanceData(attendanceRecords || [], studentsData);

      // Calculate summary statistics
      calculateSummary(attendanceRecords || [], studentsData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const processAttendanceData = (records, studentsData) => {
    // Group attendance records by week (Sunday)
    const weekMap = new Map();
    
    records.forEach(record => {
      const date = new Date(record.attendance_date + 'T12:00:00');
      const sunday = getNearestSunday(date);
      const weekKey = sunday.toISOString().split('T')[0];
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          date: weekKey,
          label: formatWeekLabel(sunday),
          records: {}
        });
      }
      
      const week = weekMap.get(weekKey);
      week.records[record.student_id] = record.status;
    });

    // Convert to sorted array
    const weeksArray = Array.from(weekMap.values()).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    setWeeks(weeksArray);

    // Create attendance data object for easy lookup
    const dataObj = {};
    records.forEach(record => {
      const key = `${record.student_id}-${record.attendance_date}`;
      dataObj[key] = record;
    });
    setAttendanceData(dataObj);
  };

  const getNearestSunday = (date) => {
    const dayOfWeek = date.getDay();
    const sunday = new Date(date);
    
    if (dayOfWeek === 0) {
      return sunday;
    }
    
    const daysToPrevSunday = dayOfWeek;
    const daysToNextSunday = 7 - dayOfWeek;
    
    if (daysToPrevSunday <= daysToNextSunday) {
      sunday.setDate(date.getDate() - daysToPrevSunday);
    } else {
      sunday.setDate(date.getDate() + daysToNextSunday);
    }
    
    return sunday;
  };

  const formatWeekLabel = (date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const calculateSummary = (records, studentsData) => {
    const summary = {
      totalStudents: studentsData.length,
      totalWeeks: new Set(records.map(r => r.attendance_date)).size,
      overallAttendance: 0,
      studentStats: []
    };

    // Calculate per-student statistics
    studentsData.forEach(student => {
      const studentRecords = records.filter(r => r.student_id === student.id);
      const totalRecords = studentRecords.length;
      const presentRecords = studentRecords.filter(r => r.status === 'P').length;
      const lateRecords = studentRecords.filter(r => r.status === 'L').length;
      const absentRecords = studentRecords.filter(r => r.status === 'U').length;
      const unattendedMassRecords = studentRecords.filter(r => r.status === 'UM').length;
      const excusedRecords = studentRecords.filter(r => r.status === 'E').length;
      
      const attendancePercentage = totalRecords > 0 
        ? ((presentRecords + lateRecords) / totalRecords) * 100 
        : 0;

      summary.studentStats.push({
        studentId: student.id,
        studentName: student.student_name,
        totalSessions: totalRecords,
        present: presentRecords,
        late: lateRecords,
        absent: absentRecords,
        unattendedMass: unattendedMassRecords,
        excused: excusedRecords,
        attendancePercentage: attendancePercentage.toFixed(1)
      });
    });

    // Calculate overall class attendance
    const totalRecords = records.length;
    const presentAndLate = records.filter(r => r.status === 'P' || r.status === 'L').length;
    summary.overallAttendance = totalRecords > 0 
      ? ((presentAndLate / totalRecords) * 100).toFixed(1) 
      : 0;

    // Sort by attendance percentage
    summary.studentStats.sort((a, b) => b.attendancePercentage - a.attendancePercentage);

    setSummaryData(summary);
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
          width: '50px',
          height: '50px',
          color: '#4CAF50',
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

  return (
    <div style={{
      paddingTop: '80px',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px'
      }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            marginBottom: '32px'
          }}
        >
          <button
            onClick={() => navigate('/teacher')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              color: '#4CAF50',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '16px',
              padding: '8px 0'
            }}
          >
            <ArrowLeft style={{ width: '18px', height: '18px' }} />
            Back to Dashboard
          </button>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: '0 0 8px 0'
              }}>
                Extended Attendance Dashboard
              </h1>
              <p style={{
                fontSize: '16px',
                color: '#666',
                margin: 0
              }}>
                {classInfo?.name} - Comprehensive attendance overview
              </p>
            </div>

            {/* Controls */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              {/* Lesson Plan Button */}
              <button
                onClick={() => setShowLessonPlan(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
              >
                <BookOpen style={{ width: '18px', height: '18px' }} />
                Lesson Plans
              </button>

              {/* View Toggle */}
              <div style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: 'white',
                padding: '4px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => setActiveView('grid')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: activeView === 'grid' ? '#4CAF50' : 'transparent',
                    color: activeView === 'grid' ? 'white' : '#666',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Calendar style={{ width: '18px', height: '18px' }} />
                  Grid View
                </button>
                <button
                  onClick={() => setActiveView('summary')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: activeView === 'summary' ? '#4CAF50' : 'transparent',
                    color: activeView === 'summary' ? 'white' : '#666',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <TrendingUp style={{ width: '18px', height: '18px' }} />
                  Summary
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeView === 'grid' ? (
            <AttendanceGrid
              students={students}
              weeks={weeks}
              attendanceData={attendanceData}
              classId={classInfo?.id}
              teacherId={profile?.id}
              onDataUpdate={loadDashboardData}
            />
          ) : (
            <AttendanceSummary
              summaryData={summaryData}
              classInfo={classInfo}
              students={students}
              weeks={weeks}
              attendanceData={attendanceData}
            />
          )}
        </motion.div>
      </div>

      {/* Lesson Plan Modal */}
      <AnimatePresence>
        {showLessonPlan && (
          <LessonPlanViewer 
            isModal={true}
            onClose={() => setShowLessonPlan(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExtendedTeacherDashboard;