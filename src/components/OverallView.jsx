import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  Users,
  Award,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  RefreshCw,
  Filter,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';

const OverallView = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [allClasses, setAllClasses] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [lessonDates, setLessonDates] = useState([]);
  const [chapters, setChapters] = useState([]);
  
  // Completion tracking
  const [attendanceCompletion, setAttendanceCompletion] = useState({});
  const [evaluationCompletion, setEvaluationCompletion] = useState({});
  
  // Filter states
  const [selectedView, setSelectedView] = useState('both'); // 'attendance', 'evaluation', 'both'
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [selectedChapterFilter, setSelectedChapterFilter] = useState('all');
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  
  // Summary stats
  const [stats, setStats] = useState({
    totalTeachers: 0,
    attendanceCompleteCount: 0,
    evaluationCompleteCount: 0,
    bothCompleteCount: 0,
    attendanceRate: 0,
    evaluationRate: 0,
    overallRate: 0
  });
  
  // Alerts for missing data
  const [alerts, setAlerts] = useState([]);
  
  // Expanded sections
  const [expandedTeacher, setExpandedTeacher] = useState(null);
  const [expandedClass, setExpandedClass] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (allTeachers.length > 0) {
      calculateStats();
      generateAlerts();
    }
  }, [attendanceCompletion, evaluationCompletion, allTeachers, lessonDates, chapters]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClasses(),
        loadTeachers(),
        loadLessonDates(),
        loadChapters()
      ]);
      
      // After loading base data, check completion
      await checkAllCompletion();
      
    } catch (error) {
      console.error('Error loading overall view data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('year_level');
    
    if (error) throw error;
    setAllClasses(data || []);
  };

  const loadTeachers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        classes:default_class_id (
          id,
          name,
          year_level
        )
      `)
      .eq('role', 'teacher')
      .eq('status', 'active')
      .not('default_class_id', 'is', null)
      .order('full_name');
    
    if (error) throw error;
    setAllTeachers(data || []);
  };

  const loadLessonDates = async () => {
    // Get all catechism lesson dates from the last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const { data, error } = await supabase
      .from('catechism_lesson_logs')
      .select('lesson_date, group_type')
      .gte('lesson_date', threeMonthsAgo.toISOString().split('T')[0])
      .order('lesson_date', { ascending: false });
    
    if (error) throw error;
    setLessonDates(data || []);
  };

  const loadChapters = async () => {
    // Get all unique chapters that have been evaluated
    const { data, error } = await supabase
      .from('lesson_evaluations')
      .select('chapter_number')
      .order('chapter_number');
    
    if (error && error.code !== 'PGRST116') throw error;
    
    const uniqueChapters = [...new Set((data || []).map(d => d.chapter_number))];
    setChapters(uniqueChapters.filter(c => c).sort((a, b) => a - b));
  };

  const checkAllCompletion = async () => {
    if (allTeachers.length === 0) return;
    
    const attendanceCompletionMap = {};
    const evaluationCompletionMap = {};

    // Check each teacher's completion
    for (const teacher of allTeachers) {
      const teacherId = teacher.id;
      const classId = teacher.classes.id;
      
      // Initialize teacher's completion tracking
      attendanceCompletionMap[teacherId] = {
        byDate: {},
        totalExpected: 0,
        totalCompleted: 0,
        completionRate: 0
      };
      
      evaluationCompletionMap[teacherId] = {
        byChapter: {},
        totalExpected: 0,
        totalCompleted: 0,
        completionRate: 0
      };

      // Check attendance for each lesson date
      for (const lesson of lessonDates) {
        const isRelevant = shouldTeacherSubmitForLesson(teacher, lesson);
        if (!isRelevant) continue;

        attendanceCompletionMap[teacherId].totalExpected++;
        
        const { data, error } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('teacher_id', teacherId)
          .eq('attendance_date', lesson.lesson_date)
          .limit(1);
        
        const isComplete = data && data.length > 0;
        attendanceCompletionMap[teacherId].byDate[lesson.lesson_date] = isComplete;
        
        if (isComplete) {
          attendanceCompletionMap[teacherId].totalCompleted++;
        }
      }
      
      // Calculate attendance completion rate
      if (attendanceCompletionMap[teacherId].totalExpected > 0) {
        attendanceCompletionMap[teacherId].completionRate = Math.round(
          (attendanceCompletionMap[teacherId].totalCompleted / 
           attendanceCompletionMap[teacherId].totalExpected) * 100
        );
      }

      // Check evaluations for each chapter
      if (chapters.length > 0) {
        for (const chapter of chapters) {
          evaluationCompletionMap[teacherId].totalExpected++;
          
          // Check if teacher has submitted any evaluations for this chapter
          const { data, error } = await supabase
            .from('lesson_evaluations')
            .select('id')
            .eq('teacher_id', teacherId)
            .eq('chapter_number', chapter)
            .limit(1);
          
          const isComplete = data && data.length > 0;
          evaluationCompletionMap[teacherId].byChapter[chapter] = isComplete;
          
          if (isComplete) {
            evaluationCompletionMap[teacherId].totalCompleted++;
          }
        }
        
        // Calculate evaluation completion rate
        if (evaluationCompletionMap[teacherId].totalExpected > 0) {
          evaluationCompletionMap[teacherId].completionRate = Math.round(
            (evaluationCompletionMap[teacherId].totalCompleted / 
             evaluationCompletionMap[teacherId].totalExpected) * 100
          );
        }
      }
    }

    setAttendanceCompletion(attendanceCompletionMap);
    setEvaluationCompletion(evaluationCompletionMap);
  };

  const shouldTeacherSubmitForLesson = (teacher, lesson) => {
    const yearLevel = teacher.classes.year_level;
    const groupType = lesson.group_type;
    
    if (groupType === 'Both') return true;
    if (groupType === 'Junior' && yearLevel <= 5) return true;
    if (groupType === 'Senior' && yearLevel > 5) return true;
    
    return false;
  };

  const calculateStats = () => {
    const totalTeachers = allTeachers.length;
    if (totalTeachers === 0) return;

    let attendanceCompleteCount = 0;
    let evaluationCompleteCount = 0;
    let bothCompleteCount = 0;

    allTeachers.forEach(teacher => {
      const teacherId = teacher.id;
      const attCompletion = attendanceCompletion[teacherId];
      const evalCompletion = evaluationCompletion[teacherId];
      
      const attComplete = attCompletion && attCompletion.completionRate === 100;
      const evalComplete = evalCompletion && evalCompletion.completionRate === 100;
      
      if (attComplete) attendanceCompleteCount++;
      if (evalComplete) evaluationCompleteCount++;
      if (attComplete && evalComplete) bothCompleteCount++;
    });

    setStats({
      totalTeachers,
      attendanceCompleteCount,
      evaluationCompleteCount,
      bothCompleteCount,
      attendanceRate: Math.round((attendanceCompleteCount / totalTeachers) * 100),
      evaluationRate: Math.round((evaluationCompleteCount / totalTeachers) * 100),
      overallRate: Math.round((bothCompleteCount / totalTeachers) * 100)
    });
  };

  const generateAlerts = () => {
    const newAlerts = [];

    // Check for teachers with missing attendance
    allTeachers.forEach(teacher => {
      const teacherId = teacher.id;
      const attCompletion = attendanceCompletion[teacherId];
      
      if (attCompletion && attCompletion.totalExpected > 0 && attCompletion.totalCompleted < attCompletion.totalExpected) {
        const missingCount = attCompletion.totalExpected - attCompletion.totalCompleted;
        const missingDates = lessonDates
          .filter(lesson => shouldTeacherSubmitForLesson(teacher, lesson) && !attCompletion.byDate[lesson.lesson_date])
          .map(l => l.lesson_date);
        
        newAlerts.push({
          type: 'attendance',
          severity: missingCount > 3 ? 'high' : 'medium',
          teacher: teacher,
          message: `Missing ${missingCount} attendance record${missingCount > 1 ? 's' : ''}`,
          details: missingDates
        });
      }
      
      // Check for teachers with missing evaluations
      const evalCompletion = evaluationCompletion[teacherId];
      if (evalCompletion && evalCompletion.totalExpected > 0 && evalCompletion.totalCompleted < evalCompletion.totalExpected) {
        const missingCount = evalCompletion.totalExpected - evalCompletion.totalCompleted;
        const missingChapters = chapters.filter(ch => !evalCompletion.byChapter[ch]);
        
        newAlerts.push({
          type: 'evaluation',
          severity: missingCount > 5 ? 'high' : 'medium',
          teacher: teacher,
          message: `Missing ${missingCount} chapter evaluation${missingCount > 1 ? 's' : ''}`,
          details: missingChapters
        });
      }
    });

    // Sort by severity
    newAlerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    setAlerts(newAlerts);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
    toast.success('Data refreshed successfully');
  };

  const getStatusIcon = (isComplete) => {
    if (isComplete === null || isComplete === undefined) {
      return <Clock style={{ width: '14px', height: '14px' }} />;
    }
    return isComplete ? 
      <CheckCircle style={{ width: '14px', height: '14px' }} /> : 
      <XCircle style={{ width: '14px', height: '14px' }} />;
  };

  const getStatusColor = (completionRate) => {
    if (completionRate === null || completionRate === undefined) return '#94a3b8';
    if (completionRate === 100) return '#10b981';
    if (completionRate >= 75) return '#3b82f6';
    if (completionRate >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return '#94a3b8';
    }
  };

  const filteredTeachers = allTeachers.filter(teacher => {
    if (selectedClassFilter !== 'all' && teacher.classes.id !== selectedClassFilter) {
      return false;
    }
    
    if (showOnlyIncomplete) {
      const teacherId = teacher.id;
      const attCompletion = attendanceCompletion[teacherId];
      const evalCompletion = evaluationCompletion[teacherId];
      
      const attComplete = attCompletion && attCompletion.completionRate === 100;
      const evalComplete = evalCompletion && evalCompletion.completionRate === 100;
      
      if (attComplete && evalComplete) return false;
    }
    
    return true;
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          margin: '0 auto 16px',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading overall view...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '24px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '200px',
          height: '200px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
          transform: 'translate(50%, -50%)'
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '800',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <TrendingUp style={{ width: '32px', height: '32px' }} />
            Overall Completion Dashboard
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.95, margin: 0 }}>
            Comprehensive view of attendance and evaluation completion across all teachers
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
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
              justifyContent: 'center',
              color: 'white'
            }}>
              <Users style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                Total Teachers
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b' }}>
                {stats.totalTeachers}
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
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
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Calendar style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                Attendance Rate
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b' }}>
                {stats.attendanceRate}%
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
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
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <BookOpen style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                Evaluation Rate
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b' }}>
                {stats.evaluationRate}%
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
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
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Award style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                Overall Complete
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b' }}>
                {stats.overallRate}%
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters and Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <Filter style={{ width: '20px', height: '20px', color: '#64748b' }} />
            
            <select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="both">Both</option>
              <option value="attendance">Attendance Only</option>
              <option value="evaluation">Evaluation Only</option>
            </select>

            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Classes</option>
              {allClasses.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>

            <button
              onClick={() => setShowOnlyIncomplete(!showOnlyIncomplete)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: showOnlyIncomplete ? '2px solid #ef4444' : '1px solid #e5e7eb',
                background: showOnlyIncomplete ? '#fef2f2' : 'white',
                color: showOnlyIncomplete ? '#ef4444' : '#64748b',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {showOnlyIncomplete ? <Eye size={16} /> : <EyeOff size={16} />}
              {showOnlyIncomplete ? 'Show All' : 'Show Incomplete'}
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#3b82f6',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: refreshing ? 0.6 : 1
            }}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh Data
          </button>
        </div>
      </motion.div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            background: '#fef2f2',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <AlertTriangle style={{ width: '24px', height: '24px', color: '#ef4444' }} />
            <h3 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#991b1b',
              margin: 0
            }}>
              Action Required ({alerts.length})
            </h3>
          </div>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {alerts.slice(0, 10).map((alert, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  background: 'white',
                  borderRadius: '8px',
                  border: `2px solid ${getSeverityColor(alert.severity)}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div style={{
                  width: '6px',
                  height: '100%',
                  background: getSeverityColor(alert.severity),
                  borderRadius: '3px'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b',
                    marginBottom: '4px'
                  }}>
                    {alert.teacher.full_name} - {alert.teacher.classes.name}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#64748b',
                    marginBottom: '8px'
                  }}>
                    {alert.message}
                  </div>
                  {alert.details && alert.details.length > 0 && (
                    <div style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      fontFamily: 'monospace'
                    }}>
                      {alert.type === 'attendance' 
                        ? `Dates: ${alert.details.slice(0, 3).join(', ')}${alert.details.length > 3 ? '...' : ''}`
                        : `Chapters: ${alert.details.slice(0, 5).join(', ')}${alert.details.length > 5 ? '...' : ''}`
                      }
                    </div>
                  )}
                </div>
              </div>
            ))}
            {alerts.length > 10 && (
              <p style={{
                fontSize: '12px',
                color: '#64748b',
                textAlign: 'center',
                margin: '8px 0 0 0'
              }}>
                Showing first 10 of {alerts.length} alerts
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Teachers List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '20px'
        }}>
          Teacher Completion Status ({filteredTeachers.length})
        </h2>

        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredTeachers.map(teacher => {
            const teacherId = teacher.id;
            const attCompletion = attendanceCompletion[teacherId] || {};
            const evalCompletion = evaluationCompletion[teacherId] || {};
            const isExpanded = expandedTeacher === teacherId;

            return (
              <div
                key={teacherId}
                style={{
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'all 0.2s'
                }}
              >
                {/* Teacher Header */}
                <div
                  onClick={() => setExpandedTeacher(isExpanded ? null : teacherId)}
                  style={{
                    padding: '16px',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '4px'
                    }}>
                      {teacher.full_name}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b'
                    }}>
                      {teacher.classes.name} • {teacher.email}
                    </div>
                  </div>

                  {(selectedView === 'both' || selectedView === 'attendance') && (
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: getStatusColor(attCompletion.completionRate) + '15',
                      border: `2px solid ${getStatusColor(attCompletion.completionRate)}`,
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#64748b',
                        marginBottom: '2px'
                      }}>
                        Attendance
                      </div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '800',
                        color: getStatusColor(attCompletion.completionRate)
                      }}>
                        {attCompletion.completionRate || 0}%
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: '#94a3b8'
                      }}>
                        {attCompletion.totalCompleted || 0}/{attCompletion.totalExpected || 0}
                      </div>
                    </div>
                  )}

                  {(selectedView === 'both' || selectedView === 'evaluation') && (
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: getStatusColor(evalCompletion.completionRate) + '15',
                      border: `2px solid ${getStatusColor(evalCompletion.completionRate)}`,
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#64748b',
                        marginBottom: '2px'
                      }}>
                        Evaluation
                      </div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '800',
                        color: getStatusColor(evalCompletion.completionRate)
                      }}>
                        {evalCompletion.completionRate || 0}%
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: '#94a3b8'
                      }}>
                        {evalCompletion.totalCompleted || 0}/{evalCompletion.totalExpected || 0}
                      </div>
                    </div>
                  )}

                  {isExpanded ? 
                    <ChevronUp style={{ width: '20px', height: '20px', color: '#64748b' }} /> :
                    <ChevronDown style={{ width: '20px', height: '20px', color: '#64748b' }} />
                  }
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '20px', background: 'white' }}>
                        {(selectedView === 'both' || selectedView === 'attendance') && attCompletion.byDate && (
                          <div style={{ marginBottom: '20px' }}>
                            <h4 style={{
                              fontSize: '14px',
                              fontWeight: '700',
                              color: '#1e293b',
                              marginBottom: '12px'
                            }}>
                              Attendance by Date
                            </h4>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                              gap: '8px'
                            }}>
                              {lessonDates
                                .filter(lesson => shouldTeacherSubmitForLesson(teacher, lesson))
                                .map(lesson => {
                                  const isComplete = attCompletion.byDate[lesson.lesson_date];
                                  return (
                                    <div
                                      key={lesson.lesson_date}
                                      style={{
                                        padding: '8px',
                                        borderRadius: '6px',
                                        background: isComplete ? '#ecfdf5' : '#fef2f2',
                                        border: `1px solid ${isComplete ? '#10b981' : '#ef4444'}`,
                                        textAlign: 'center'
                                      }}
                                    >
                                      <div style={{
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: isComplete ? '#10b981' : '#ef4444',
                                        marginBottom: '4px'
                                      }}>
                                        {isComplete ? '✓' : '✗'}
                                      </div>
                                      <div style={{
                                        fontSize: '10px',
                                        color: '#64748b'
                                      }}>
                                        {new Date(lesson.lesson_date + 'T12:00:00').toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {(selectedView === 'both' || selectedView === 'evaluation') && evalCompletion.byChapter && (
                          <div>
                            <h4 style={{
                              fontSize: '14px',
                              fontWeight: '700',
                              color: '#1e293b',
                              marginBottom: '12px'
                            }}>
                              Evaluation by Chapter
                            </h4>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                              gap: '8px'
                            }}>
                              {chapters.map(chapter => {
                                const isComplete = evalCompletion.byChapter[chapter];
                                return (
                                  <div
                                    key={chapter}
                                    style={{
                                      padding: '8px',
                                      borderRadius: '6px',
                                      background: isComplete ? '#f0f9ff' : '#fef2f2',
                                      border: `1px solid ${isComplete ? '#3b82f6' : '#ef4444'}`,
                                      textAlign: 'center'
                                    }}
                                  >
                                    <div style={{
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      color: isComplete ? '#3b82f6' : '#ef4444',
                                      marginBottom: '4px'
                                    }}>
                                      {isComplete ? '✓' : '✗'}
                                    </div>
                                    <div style={{
                                      fontSize: '10px',
                                      color: '#64748b'
                                    }}>
                                      Ch. {chapter}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {filteredTeachers.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#94a3b8'
          }}>
            <Users style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '16px', margin: 0 }}>
              No teachers match the current filters
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OverallView;