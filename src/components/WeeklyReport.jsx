import { useState, useEffect } from 'react';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
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
  Mail,
  Send
} from 'lucide-react';

const WeeklyReport = () => {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadLessons();
  }, []);

  useEffect(() => {
    if (selectedLesson) {
      loadReportData(selectedLesson);
    }
  }, [selectedLesson]);

  const loadLessons = async () => {
    setLoading(true);
    try {
      // Get last 8 weeks of catechism lessons
      const { data, error } = await supabase
        .from('catechism_lesson_logs')
        .select('*')
        .order('lesson_date', { ascending: false })
        .limit(8);

      if (error) throw error;

      setLessons(data || []);
      
      // Auto-select most recent lesson
      if (data && data.length > 0) {
        setSelectedLesson(data[0].lesson_date);
        setExpandedLesson(data[0].lesson_date);
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
      toast.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async (lessonDate) => {
    try {
      // Get all teachers with their classes
      const { data: teachers, error: teachersError } = await supabase
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
        .not('default_class_id', 'is', null);

      if (teachersError) throw teachersError;

      // Categorize teachers by Junior/Senior
      const juniorTeachers = teachers.filter(t => 
        t.classes && t.classes.year_level <= 5
      );
      const seniorTeachers = teachers.filter(t => 
        t.classes && t.classes.year_level > 5
      );

      // Get the catechism lesson to determine which group
      const { data: lesson, error: lessonError } = await supabase
        .from('catechism_lesson_logs')
        .select('*')
        .eq('lesson_date', lessonDate)
        .single();

      if (lessonError) throw lessonError;

      // Determine which teachers should have submitted based on group_type
      let relevantTeachers = [];
      if (lesson.group_type === 'Both') {
        relevantTeachers = [...juniorTeachers, ...seniorTeachers];
      } else if (lesson.group_type === 'Junior') {
        relevantTeachers = juniorTeachers;
      } else if (lesson.group_type === 'Senior') {
        relevantTeachers = seniorTeachers;
      }

      // Check attendance completion for each teacher
      const teacherProgress = await Promise.all(
        relevantTeachers.map(async (teacher) => {
          // Check if attendance was submitted for this date
          const { data: attendanceData, error: attError } = await supabase
            .from('attendance_records')
            .select('id, created_at')
            .eq('teacher_id', teacher.id)
            .eq('attendance_date', lessonDate);

          // Check if evaluations were submitted for this date
          const { data: evaluationData, error: evalError } = await supabase
            .from('lesson_evaluations')
            .select('id, created_at')
            .eq('teacher_id', teacher.id)
            .eq('evaluation_date', lessonDate);

          if (attError || evalError) {
            console.error('Error checking records:', attError || evalError);
          }

          const hasAttendance = attendanceData && attendanceData.length > 0;
          const hasEvaluation = evaluationData && evaluationData.length > 0;

          return {
            teacher,
            hasAttendance,
            hasEvaluation,
            attendanceCount: attendanceData?.length || 0,
            evaluationCount: evaluationData?.length || 0,
            attendanceSubmittedAt: attendanceData?.[0]?.created_at,
            evaluationSubmittedAt: evaluationData?.[0]?.created_at,
            isComplete: hasAttendance && hasEvaluation,
            group: teacher.classes.year_level <= 5 ? 'Junior' : 'Senior'
          };
        })
      );

      // Calculate statistics
      const totalTeachers = teacherProgress.length;
      const completedBoth = teacherProgress.filter(t => t.isComplete).length;
      const completedAttendance = teacherProgress.filter(t => t.hasAttendance).length;
      const completedEvaluation = teacherProgress.filter(t => t.hasEvaluation).length;
      const completedNeither = teacherProgress.filter(t => !t.hasAttendance && !t.hasEvaluation).length;

      setReportData({
        lesson,
        teacherProgress,
        stats: {
          totalTeachers,
          completedBoth,
          completedAttendance,
          completedEvaluation,
          completedNeither,
          completionRate: totalTeachers > 0 ? Math.round((completedBoth / totalTeachers) * 100) : 0,
          attendanceRate: totalTeachers > 0 ? Math.round((completedAttendance / totalTeachers) * 100) : 0,
          evaluationRate: totalTeachers > 0 ? Math.round((completedEvaluation / totalTeachers) * 100) : 0
        },
        juniorTeachers: teacherProgress.filter(t => t.group === 'Junior'),
        seniorTeachers: teacherProgress.filter(t => t.group === 'Senior')
      });

    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    }
  };

  const getStatusColor = (hasAttendance, hasEvaluation) => {
    if (hasAttendance && hasEvaluation) return '#10b981'; // Green
    if (hasAttendance || hasEvaluation) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  const getStatusIcon = (hasAttendance, hasEvaluation) => {
    if (hasAttendance && hasEvaluation) return <CheckCircle style={{ width: '16px', height: '16px' }} />;
    if (hasAttendance || hasEvaluation) return <Clock style={{ width: '16px', height: '16px' }} />;
    return <XCircle style={{ width: '16px', height: '16px' }} />;
  };

  const getStatusText = (hasAttendance, hasEvaluation) => {
    if (hasAttendance && hasEvaluation) return 'Complete';
    if (hasAttendance && !hasEvaluation) return 'Attendance Only';
    if (!hasAttendance && hasEvaluation) return 'Evaluation Only';
    return 'Not Submitted';
  };

  const sendEmailReport = async () => {
    if (!reportData) {
      toast.error('No report data available');
      return;
    }

    setSendingEmail(true);
    try {
      // Call your Vercel API endpoint to send email
      const response = await fetch('/api/send-weekly-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonDate: selectedLesson,
          reportData: reportData
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('📧 Report sent successfully!');
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send report: ' + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

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
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading reports...</p>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Calendar style={{ width: '48px', height: '48px', color: '#94a3b8', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
          No Lessons Logged
        </h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Log catechism lessons to see teacher progress reports
        </p>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1a1a1a',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <TrendingUp style={{ width: '28px', height: '28px', color: '#3b82f6' }} />
              Weekly Teacher Progress Report
            </h2>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
              Track attendance and evaluation completion for each catechism lesson
            </p>
          </div>
          
          {/* Send Email Button */}
          {reportData && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={sendEmailReport}
              disabled={sendingEmail}
              style={{
                padding: '12px 20px',
                background: sendingEmail 
                  ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: sendingEmail ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: sendingEmail ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              {sendingEmail ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Sending...
                </>
              ) : (
                <>
                  <Send style={{ width: '16px', height: '16px' }} />
                  Send Report
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>

      {/* Lesson Dropdown */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: '600',
          color: '#475569',
          marginBottom: '8px'
        }}>
          Select Lesson Date
        </label>
        <select
          value={selectedLesson || ''}
          onChange={(e) => {
            setSelectedLesson(e.target.value);
            setExpandedLesson(e.target.value);
          }}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '10px',
            border: '2px solid #e5e7eb',
            fontSize: '14px',
            fontWeight: '600',
            color: '#1e293b',
            background: 'white',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '20px',
            paddingRight: '44px'
          }}
        >
          {lessons.map((lesson) => {
            const lessonDate = new Date(lesson.lesson_date);
            const formattedDate = lessonDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric',
              year: 'numeric'
            });
            
            return (
              <option key={lesson.id} value={lesson.lesson_date}>
                {formattedDate} - {lesson.group_type}
              </option>
            );
          })}
        </select>
      </div>

      {/* Report Content */}
      {reportData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Stats Overview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '16px',
              borderRadius: '12px',
              color: 'white'
            }}>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Complete</div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>
                {reportData.stats.completedBoth}/{reportData.stats.totalTeachers}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {reportData.stats.completionRate}% completion
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              padding: '16px',
              borderRadius: '12px',
              color: 'white'
            }}>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Attendance</div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>
                {reportData.stats.completedAttendance}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {reportData.stats.attendanceRate}% submitted
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              padding: '16px',
              borderRadius: '12px',
              color: 'white'
            }}>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Evaluations</div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>
                {reportData.stats.completedEvaluation}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {reportData.stats.evaluationRate}% submitted
              </div>
            </div>

            {reportData.stats.completedNeither > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                padding: '16px',
                borderRadius: '12px',
                color: 'white'
              }}>
                <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Missing</div>
                <div style={{ fontSize: '28px', fontWeight: '800' }}>
                  {reportData.stats.completedNeither}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>
                  No submissions
                </div>
              </div>
            )}
          </div>

          {/* Junior Teachers */}
          {reportData.juniorTeachers.length > 0 && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '16px',
              border: '2px solid #fbbf24',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px'
              }}>
                <Users style={{ width: '20px', height: '20px', color: '#92400e' }} />
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#92400e',
                  margin: 0
                }}>
                  Junior Teachers (Reception - Year 5)
                </h3>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b'
                }}>
                  {reportData.juniorTeachers.filter(t => t.isComplete).length}/{reportData.juniorTeachers.length} complete
                </span>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {reportData.juniorTeachers.map((teacherData) => (
                  <div
                    key={teacherData.teacher.id}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: getStatusColor(teacherData.hasAttendance, teacherData.hasEvaluation),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                    >
                      {getStatusIcon(teacherData.hasAttendance, teacherData.hasEvaluation)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '2px'
                      }}>
                        {teacherData.teacher.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {teacherData.teacher.classes.name}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: getStatusColor(teacherData.hasAttendance, teacherData.hasEvaluation),
                        marginBottom: '4px'
                      }}>
                        {getStatusText(teacherData.hasAttendance, teacherData.hasEvaluation)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        {teacherData.hasAttendance && '✓ Attendance '}
                        {teacherData.hasEvaluation && '✓ Evaluation'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Senior Teachers */}
          {reportData.seniorTeachers.length > 0 && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              border: '2px solid #8b5cf6',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px'
              }}>
                <Award style={{ width: '20px', height: '20px', color: '#6d28d9' }} />
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#6d28d9',
                  margin: 0
                }}>
                  Senior Teachers (Year 6+)
                </h3>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b'
                }}>
                  {reportData.seniorTeachers.filter(t => t.isComplete).length}/{reportData.seniorTeachers.length} complete
                </span>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {reportData.seniorTeachers.map((teacherData) => (
                  <div
                    key={teacherData.teacher.id}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      background: '#f5f3ff',
                      border: '1px solid #e9d5ff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: getStatusColor(teacherData.hasAttendance, teacherData.hasEvaluation),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                    >
                      {getStatusIcon(teacherData.hasAttendance, teacherData.hasEvaluation)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '2px'
                      }}>
                        {teacherData.teacher.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {teacherData.teacher.classes.name}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: getStatusColor(teacherData.hasAttendance, teacherData.hasEvaluation),
                        marginBottom: '4px'
                      }}>
                        {getStatusText(teacherData.hasAttendance, teacherData.hasEvaluation)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        {teacherData.hasAttendance && '✓ Attendance '}
                        {teacherData.hasEvaluation && '✓ Evaluation'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default WeeklyReport;