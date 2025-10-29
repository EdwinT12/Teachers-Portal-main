import { useState, useEffect, useContext, useRef } from 'react';
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
  Loader,
  Download,
  Award,
  BookOpen
} from 'lucide-react';
import AttendanceGrid from '../../components/AttendanceGrid';
import AttendanceSummary from '../../components/AttendanceSummary';
import ClassAnalytics from '../../components/ClassAnalytics';
import EvaluationGrid from '../../components/EvaluationGrids';
import EvaluationSummary from '../../components/EvaluationSummary';

const ExtendedDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // Ref to track if data has been loaded for current class/chapter combination
  const dataLoadedRef = useRef(new Set());
  const isLoadingRef = useRef(false);
  
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classInfo, setClassInfo] = useState(null);
  
  // Attendance State
  const [students, setStudents] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  
  // Evaluation State
  const [evalStudents, setEvalStudents] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [evaluationsData, setEvaluationsData] = useState({});
  const [evaluationSummary, setEvaluationSummary] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('grid');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [viewMode, setViewMode] = useState('attendance'); // 'attendance' or 'evaluation'

  const chapterOptions = Array.from({ length: 15 }, (_, i) => i + 1);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent page reloads on tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Do nothing - data will persist when tab becomes visible again
      // This prevents unnecessary reloads when switching tabs
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClassDropdown && !event.target.closest('[data-dropdown-container]')) {
        setShowClassDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClassDropdown]);

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
      const dataKey = `${selectedClassId}-${selectedChapter}`;
      
      // Only load data if it hasn't been loaded for this combination yet
      // or if it's a genuine change (not just a tab switch)
      if (!dataLoadedRef.current.has(dataKey)) {
        loadAllData(dataKey);
      }
    }
  }, [selectedClassId, selectedChapter]);

  const loadAllData = async (dataKey) => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return;
    }
    
    isLoadingRef.current = true;
    setLoading(true);
    try {
      await Promise.all([
        loadAttendanceData(),
        loadEvaluationData()
      ]);
      
      // Mark this data combination as loaded
      if (dataKey) {
        dataLoadedRef.current.add(dataKey);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const loadAttendanceData = async () => {
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
      calculateAttendanceSummary(studentsData, formattedWeeks, attendanceMap);

    } catch (error) {
      console.error('Error loading attendance data:', error);
    }
  };

  const loadEvaluationData = async () => {
    try {
      // Load eval students
      const { data: evalStudentsData, error: evalStudentsError } = await supabase
        .from('eval_students')
        .select('*')
        .eq('class_id', selectedClassId)
        .order('row_number');

      if (evalStudentsError) throw evalStudentsError;
      setEvalStudents(evalStudentsData || []);

      // Load ALL evaluation records for this class
      const { data: evaluationRecords, error: evaluationsError } = await supabase
        .from('lesson_evaluations')
        .select('*')
        .eq('class_id', selectedClassId);

      if (evaluationsError && evaluationsError.code !== 'PGRST116') {
        throw evaluationsError;
      }

      // Extract unique chapters
      const uniqueChapters = [...new Set((evaluationRecords || []).map(r => r.chapter_number))];
      const sortedChapters = uniqueChapters.sort((a, b) => a - b);
      setChapters(sortedChapters);

      // Create evaluations map - include chapter_number in key to separate data by chapter
      const evaluationsMap = {};
      (evaluationRecords || []).forEach(record => {
        const key = `${record.eval_student_id}-${record.chapter_number}-${record.category}`;
        evaluationsMap[key] = record;
      });
      setEvaluationsData(evaluationsMap);

      // Calculate summary data
      calculateEvaluationSummary(evalStudentsData, evaluationRecords);

    } catch (error) {
      console.error('Error loading evaluation data:', error);
    }
  };

  const calculateAttendanceSummary = (studentsData, weeksData, attendanceMap) => {
    if (!studentsData || !weeksData || studentsData.length === 0 || weeksData.length === 0) {
      setAttendanceSummary(null);
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

    setAttendanceSummary({
      totalStudents: studentsData.length,
      totalWeeks: weeksData.length,
      overallAttendance,
      studentStats
    });
  };

  const calculateEvaluationSummary = (evalStudentsData, evaluationRecords) => {
    if (!evalStudentsData || evalStudentsData.length === 0) {
      setEvaluationSummary(null);
      return;
    }

    const categories = ['D', 'B', 'HW', 'AP'];
    
    const studentStats = evalStudentsData.map(student => {
      const studentEvals = evaluationRecords.filter(
        r => r.eval_student_id === student.id && r.chapter_number === selectedChapter
      );

      const ratings = {};
      let totalScore = 0;
      let countedCategories = 0;

      categories.forEach(cat => {
        const evalRecord = studentEvals.find(e => e.category === cat);
        if (evalRecord && evalRecord.rating) {
          ratings[cat] = evalRecord.rating;
          // E=100, G=75, I=50
          const score = evalRecord.rating === 'E' ? 100 : evalRecord.rating === 'G' ? 75 : 50;
          totalScore += score;
          countedCategories++;
        } else {
          ratings[cat] = null;
        }
      });

      const score = countedCategories > 0 
        ? (totalScore / countedCategories).toFixed(1)
        : '0.0';

      const notesRecord = studentEvals.find(e => e.teacher_notes);
      
      return {
        studentId: student.id,
        studentName: student.student_name,
        ratings,
        score: parseFloat(score),
        notes: notesRecord?.teacher_notes || ''
      };
    });

    studentStats.sort((a, b) => b.score - a.score);

    const totalScores = studentStats.reduce((sum, s) => sum + s.score, 0);
    const overallScore = studentStats.length > 0
      ? (totalScores / studentStats.length).toFixed(1)
      : '0.0';

    setEvaluationSummary({
      totalStudents: evalStudentsData.length,
      overallScore: parseFloat(overallScore),
      studentStats
    });
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    setShowClassDropdown(false);
    setAttendanceData({});
    setEvaluationsData({});
  };

  const handleDataUpdate = () => {
    // Clear the loaded data cache for current class/chapter so data reloads
    const dataKey = `${selectedClassId}-${selectedChapter}`;
    dataLoadedRef.current.delete(dataKey);
    
    // Force reload the data
    loadAllData(dataKey);
  };

  const exportToCSV = () => {
    if (viewMode === 'attendance' && attendanceSummary && attendanceSummary.studentStats) {
      const headers = ['Student Name', 'Present', 'Late', 'Absent', 'Excused', 'Unattended Mass', 'Total Sessions', 'Attendance %'];
      const rows = attendanceSummary.studentStats.map(s => [
        s.studentName,
        s.present,
        s.late,
        s.absent,
        s.excused,
        s.unattendedMass,
        s.totalSessions,
        s.attendancePercentage
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${classInfo?.class_name || 'class'}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Attendance data exported');
    } else if (viewMode === 'evaluation' && evaluationSummary && evaluationSummary.studentStats) {
      const headers = ['Student Name', 'Discipline', 'Behaviour', 'Homework', 'Active Participation', 'Score %'];
      const rows = evaluationSummary.studentStats.map(s => [
        s.studentName,
        s.ratings.D || '-',
        s.ratings.B || '-',
        s.ratings.HW || '-',
        s.ratings.AP || '-',
        s.score
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluations_ch${selectedChapter}_${classInfo?.class_name || 'class'}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Evaluation data exported');
    } else {
      toast.error('No data to export');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <Loader style={{
            width: '48px',
            height: '48px',
            color: 'white',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <p style={{
            color: 'white',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Loading dashboard...
          </p>
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
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: isMobile ? '12px' : '24px',
      paddingTop: isMobile ? '68px' : '88px' // Account for fixed AppBar
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: isMobile ? '16px' : '20px',
            padding: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            overflow: 'visible',
            position: 'relative',
            zIndex: 10
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center',
            gap: isMobile ? '12px' : '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: isMobile ? '100%' : 'auto'
            }}>
              <button
                onClick={() => navigate('/teacher')}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '12px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <ArrowLeft style={{ width: '20px', height: '20px', color: '#666' }} />
              </button>
              
              <div style={{ flex: 1 }}>
                <h1 style={{
                  fontSize: isMobile ? '20px' : '28px',
                  fontWeight: '800',
                  color: '#1a1a1a',
                  margin: 0
                }}>
                  Extended Dashboard
                </h1>
                {classInfo && (
                  <p style={{
                    fontSize: isMobile ? '13px' : '14px',
                    color: '#666',
                    margin: '4px 0 0 0',
                    fontWeight: '500'
                  }}>
                    {classInfo.name}
                  </p>
                )}
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '8px',
              width: isMobile ? '100%' : 'auto',
              flexWrap: 'wrap',
              overflow: 'visible'
            }}>
              {/* Class Selector for Admin */}
              {isAdmin && allClasses.length > 0 && (
                <div data-dropdown-container style={{ position: 'relative', flex: isMobile ? '1' : 'initial' }}>
                  <button
                    onClick={() => setShowClassDropdown(!showClassDropdown)}
                    style={{
                      padding: isMobile ? '10px 14px' : '10px 20px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {classInfo?.name || 'Select Class'}
                    </span>
                    <ChevronDown style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  </button>

                  {showClassDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '8px',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
                      zIndex: 999999,
                      maxHeight: '300px',
                      overflowY: 'auto',
                      border: '1px solid #e5e7eb',
                      minWidth: '200px'
                    }}>
                      {allClasses.map(cls => (
                        <button
                          key={cls.id}
                          onClick={() => handleClassChange(cls.id)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: cls.id === selectedClassId ? '#eff6ff' : 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: cls.id === selectedClassId ? '600' : '500',
                            color: cls.id === selectedClassId ? '#3b82f6' : '#1a1a1a',
                            borderBottom: '1px solid #f3f4f6'
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
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={exportToCSV}
                style={{
                  padding: isMobile ? '10px 14px' : '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: isMobile ? '1' : 'initial'
                }}
              >
                <Download style={{ width: '16px', height: '16px' }} />
                {!isMobile && 'Export'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* View Mode Toggle */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: isMobile ? '16px' : '20px',
            padding: isMobile ? '12px' : '16px',
            marginBottom: isMobile ? '16px' : '24px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            gap: '8px'
          }}
        >
          <button
            onClick={() => {
              setViewMode('attendance');
              setActiveTab('grid');
            }}
            style={{
              flex: 1,
              padding: isMobile ? '14px' : '16px',
              backgroundColor: viewMode === 'attendance' ? '#10b981' : 'transparent',
              color: viewMode === 'attendance' ? 'white' : '#666',
              border: 'none',
              borderRadius: '12px',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Calendar style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
            Attendance
          </button>
          
          <button
            onClick={() => {
              setViewMode('evaluation');
              setActiveTab('grid');
            }}
            style={{
              flex: 1,
              padding: isMobile ? '14px' : '16px',
              backgroundColor: viewMode === 'evaluation' ? '#8b5cf6' : 'transparent',
              color: viewMode === 'evaluation' ? 'white' : '#666',
              border: 'none',
              borderRadius: '12px',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <BookOpen style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
            Evaluations
          </button>
        </motion.div>

        {/* Summary Cards */}
        {viewMode === 'attendance' && attendanceSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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
                    {attendanceSummary.overallAttendance}%
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
                    {attendanceSummary.totalStudents}
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
                    {attendanceSummary.totalWeeks}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'evaluation' && evaluationSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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
              border: '2px solid #8b5cf6',
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
                  backgroundColor: '#ede9fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <TrendingUp style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '12px',
                    color: '#666',
                    margin: '0 0 4px 0',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Overall Score
                  </p>
                  <p style={{
                    fontSize: isMobile ? '24px' : '28px',
                    fontWeight: '700',
                    color: '#8b5cf6',
                    margin: 0
                  }}>
                    {evaluationSummary.overallScore}%
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
                    {evaluationSummary.totalStudents}
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
                  <Award style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '12px',
                    color: '#666',
                    margin: '0 0 4px 0',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Chapter
                  </p>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(parseInt(e.target.value))}
                    style={{
                      fontSize: isMobile ? '20px' : '24px',
                      fontWeight: '700',
                      color: '#1a1a1a',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      outline: 'none',
                      padding: 0,
                      margin: 0
                    }}
                  >
                    {chapterOptions.map(ch => (
                      <option key={ch} value={ch}>Chapter {ch}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab Navigation */}
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
            { id: 'grid', label: viewMode === 'attendance' ? 'Attendance Grid' : 'Evaluation Grid', icon: Calendar },
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
                  backgroundColor: isActive ? (viewMode === 'attendance' ? '#10b981' : '#8b5cf6') : 'transparent',
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

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${viewMode}-${activeTab}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {viewMode === 'attendance' && (
              <>
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
                    summaryData={attendanceSummary}
                    classInfo={classInfo}
                    students={students}
                    weeks={weeks}
                    attendanceData={attendanceData}
                  />
                )}

                {activeTab === 'analytics' && (
                  <ClassAnalytics
                    summaryData={attendanceSummary}
                    classInfo={classInfo}
                    students={students}
                    weeks={weeks}
                    attendanceData={attendanceData}
                    type="attendance"
                  />
                )}
              </>
            )}

            {viewMode === 'evaluation' && (
              <>
                {activeTab === 'grid' && (
                  <EvaluationGrid
                    evalStudents={evalStudents}
                    chapters={chapters}
                    evaluationsData={evaluationsData}
                    classId={selectedClassId}
                    teacherId={user?.id}
                    selectedChapter={selectedChapter}
                    onDataUpdate={handleDataUpdate}
                  />
                )}

                {activeTab === 'summary' && (
                  <EvaluationSummary
                    summaryData={evaluationSummary}
                    classInfo={classInfo}
                    evalStudents={evalStudents}
                    chapters={chapters}
                    evaluationsData={evaluationsData}
                    selectedChapter={selectedChapter}
                  />
                )}

                {activeTab === 'analytics' && (
                  <ClassAnalytics
                    summaryData={evaluationSummary}
                    classInfo={classInfo}
                    students={evalStudents}
                    chapters={chapters}
                    evaluationsData={evaluationsData}
                    selectedChapter={selectedChapter}
                    type="evaluation"
                  />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ExtendedDashboard;