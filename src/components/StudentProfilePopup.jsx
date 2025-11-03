import { motion, AnimatePresence } from 'framer-motion';
import { X, User, TrendingUp, CheckCircle2, Clock, XCircle, AlertCircle, Calendar, Award, Heart, BookOpen, Zap, Church, FileText, Download, Loader } from 'lucide-react';
import { useEffect, useState, useContext } from 'react';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';

const StudentProfilePopup = ({ student, weeks, attendanceData, onClose, type = 'attendance', chapters, evaluationsData }) => { 
  const { user } = useContext(AuthContext);
  const [absenceRequests, setAbsenceRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [allTeacherComments, setAllTeacherComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  
  if (!student) return null;

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setIsAdmin(profile?.role === 'admin');
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    const loadAbsenceRequests = async () => {
      if (!student?.studentId) return;
      
      try {
        setLoadingRequests(true);
        const { data, error } = await supabase
          .from('absence_requests')
          .select(`
            *,
            parent:parent_id (
              full_name
            ),
            reviewer:reviewed_by (
              full_name
            )
          `)
          .eq('student_id', student.studentId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAbsenceRequests(data || []);
      } catch (error) {
        console.error('Error loading absence requests:', error);
      } finally {
        setLoadingRequests(false);
      }
    };

    loadAbsenceRequests();
  }, [student?.studentId]);

  // Load all teacher comments from all chapters (for evaluation tab)
  useEffect(() => {
    const loadAllTeacherComments = async () => {
      if (type !== 'evaluation' || !student?.studentId) {
        setLoadingComments(false);
        return;
      }
      
      try {
        setLoadingComments(true);
        
        // Get eval_student record
        const { data: evalStudent, error: evalStudentError } = await supabase
          .from('eval_students')
          .select('id, student_name, class_id')
          .eq('student_name', student.studentName)
          .single();

        if (evalStudentError || !evalStudent) {
          console.error('Error fetching eval_student:', evalStudentError);
          setAllTeacherComments([]);
          setLoadingComments(false);
          return;
        }

        // Fetch all evaluations with teacher notes for this student
        const { data: evaluations, error: evalError } = await supabase
          .from('lesson_evaluations')
          .select('chapter_number, category, rating, teacher_notes, created_at')
          .eq('eval_student_id', evalStudent.id)
          .not('teacher_notes', 'is', null)
          .neq('teacher_notes', '')
          .order('chapter_number', { ascending: true });

        if (evalError) {
          console.error('Error fetching evaluations:', evalError);
          setAllTeacherComments([]);
        } else {
          // Group by chapter and combine notes
          const commentsByChapter = {};
          evaluations?.forEach(evaluation => {
            const chapter = evaluation.chapter_number;
            if (!commentsByChapter[chapter]) {
              commentsByChapter[chapter] = {
                chapter,
                notes: [],
                lastUpdated: evaluation.created_at
              };
            }
            // Add note if not already added for this chapter
            if (!commentsByChapter[chapter].notes.includes(evaluation.teacher_notes)) {
              commentsByChapter[chapter].notes.push(evaluation.teacher_notes);
            }
            // Update last updated time if newer
            if (new Date(evaluation.created_at) > new Date(commentsByChapter[chapter].lastUpdated)) {
              commentsByChapter[chapter].lastUpdated = evaluation.created_at;
            }
          });

          const commentsArray = Object.values(commentsByChapter).map(item => ({
            ...item,
            notes: item.notes.join('\n\n') // Combine multiple notes with double newline
          }));

          setAllTeacherComments(commentsArray);
        }
      } catch (error) {
        console.error('Error loading teacher comments:', error);
        setAllTeacherComments([]);
      } finally {
        setLoadingComments(false);
      }
    };

    loadAllTeacherComments();
  }, [student?.studentId, student?.studentName, type]);

  const categories = [
    { key: 'D', label: 'Discipline', color: '#3b82f6', bg: '#dbeafe', icon: Award },
    { key: 'B', label: 'Behaviour', color: '#10b981', bg: '#d1fae5', icon: Heart },
    { key: 'HW', label: 'Homework', color: '#f59e0b', bg: '#fef3c7', icon: BookOpen },
    { key: 'AP', label: 'Active Participation', color: '#8b5cf6', bg: '#ede9fe', icon: Zap }
  ];

  const evalRatings = [
    { value: 'E', label: 'Excellent', color: '#10b981' },
    { value: 'G', label: 'Good', color: '#3b82f6' },
    { value: 'I', label: 'Improving', color: '#f59e0b' }
  ];

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return '#10b981';
    if (percentage >= 75) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getAttendanceLabel = (percentage) => {
    if (percentage >= 90) return 'Excellent Attendance';
    if (percentage >= 75) return 'Good Attendance';
    if (percentage >= 60) return 'Fair Attendance';
    return 'Poor Attendance';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent Performance';
    if (score >= 60) return 'Good Performance';
    return 'Needs Improvement';
  };

  const getAttendanceStatusConfig = (status) => {
    const configs = {
      'P': { color: '#10b981', bg: '#d1fae5', icon: CheckCircle2, label: 'Present' },
      'L': { color: '#f59e0b', bg: '#fef3c7', icon: Clock, label: 'Late' },
      'UM': { color: '#8b5cf6', bg: '#ede9fe', icon: Church, label: 'Unattended Mass' },
      'E': { color: '#3b82f6', bg: '#dbeafe', icon: AlertCircle, label: 'Excused' },
      'U': { color: '#ef4444', bg: '#fee2e2', icon: XCircle, label: 'Absent' },
      '': { color: '#d1d5db', bg: '#ffffff', icon: null, label: 'Not Marked' }
    };
    return configs[status] || configs[''];
  };

  const getStudentAttendanceForWeek = (weekDate) => {
    if (!attendanceData) return '';
    const key = `${student.studentId}-${weekDate}`;
    const record = attendanceData[key];
    return record?.status || '';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric'
    });
  };

  const getRequestStatusConfig = (status) => {
    const configs = {
      'pending': { color: '#f59e0b', bg: '#fef3c7', label: 'Pending Review' },
      'approved': { color: '#10b981', bg: '#d1fae5', label: 'Approved' },
      'rejected': { color: '#ef4444', bg: '#fee2e2', label: 'Rejected' }
    };
    return configs[status] || configs['pending'];
  };

  const downloadStudentReport = async () => {
    setDownloadingReport(true);
    
    try {
      let reportData = {
        studentInfo: {
          name: student.studentName,
          house: student.house || 'N/A',
          generatedDate: new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        },
        absenceRequests: absenceRequests.map(req => ({
          date: formatDate(req.absence_date),
          reason: req.reason,
          status: req.status,
          submittedOn: formatDate(req.created_at),
          reviewedBy: req.reviewer?.full_name || 'N/A',
          reviewNotes: req.review_notes || 'N/A'
        }))
      };

      // If we're on attendance tab, fetch/include attendance data
      if (type === 'attendance') {
        let attendanceReportData = {
          percentage: '0',
          totalSessions: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          unattendedMass: 0,
          weeklyRecords: []
        };

        if (student.studentId) {
          try {
            // Get all attendance records for this student
            const { data: attendanceRecords, error: attendanceError } = await supabase
              .from('attendance_records')
              .select('attendance_date, status')
              .eq('student_id', student.studentId)
              .order('attendance_date');

            if (!attendanceError && attendanceRecords) {
              let present = 0, late = 0, absent = 0, excused = 0, unattendedMass = 0;
              
              attendanceRecords.forEach(record => {
                switch (record.status) {
                  case 'P': present++; break;
                  case 'L': late++; break;
                  case 'U': absent++; break;
                  case 'E': excused++; break;
                  case 'UM': unattendedMass++; break;
                }
              });

              const totalSessions = attendanceRecords.length;
              const attendancePercentage = totalSessions > 0
                ? (((present + late) / totalSessions) * 100).toFixed(1)
                : '0.0';

              attendanceReportData = {
                percentage: attendancePercentage,
                totalSessions,
                present,
                late,
                absent,
                excused,
                unattendedMass,
                weeklyRecords: attendanceRecords.map(record => ({
                  date: new Date(record.attendance_date + 'T12:00:00').toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  }),
                  status: record.status || 'Not Marked'
                }))
              };
            }
          } catch (attendanceError) {
            console.error('Error fetching attendance data:', attendanceError);
          }
        }

        reportData.attendance = attendanceReportData;
      }

      // If we're on evaluation tab, fetch/include evaluation data
      if (type === 'evaluation') {
        let allEvaluations = null;
        
        if (student.studentId) {
          try {
            // First, get the eval_student record to find the eval_student_id
            const { data: evalStudentData, error: evalStudentError } = await supabase
              .from('eval_students')
              .select('id, student_name, class_id')
              .eq('student_name', student.studentName)
              .single();

            if (!evalStudentError && evalStudentData) {
              // Now fetch ALL evaluations for this eval_student across all chapters
              const { data: allEvalData, error: evalError } = await supabase
                .from('lesson_evaluations')
                .select('*')
                .eq('eval_student_id', evalStudentData.id)
                .order('chapter_number');

              if (!evalError && allEvalData && allEvalData.length > 0) {
                // Group evaluations by chapter
                const evalsByChapter = {};
                allEvalData.forEach(evalRecord => {
                  const chapter = evalRecord.chapter_number;
                  if (!evalsByChapter[chapter]) {
                    evalsByChapter[chapter] = {
                      D: null,
                      B: null,
                      HW: null,
                      AP: null,
                      notes: ''
                    };
                  }
                  
                  if (evalRecord.category && evalRecord.rating) {
                    evalsByChapter[chapter][evalRecord.category] = evalRecord.rating;
                  }
                  
                  if (evalRecord.teacher_notes) {
                    evalsByChapter[chapter].notes = evalRecord.teacher_notes;
                  }
                });

                // Calculate scores for each chapter
                const chaptersData = Object.keys(evalsByChapter).sort((a, b) => a - b).map(chapter => {
                  const ratings = evalsByChapter[chapter];
                  let totalScore = 0;
                  let countedCategories = 0;

                  ['D', 'B', 'HW', 'AP'].forEach(cat => {
                    if (ratings[cat]) {
                      const score = ratings[cat] === 'E' ? 100 : ratings[cat] === 'G' ? 75 : 50;
                      totalScore += score;
                      countedCategories++;
                    }
                  });

                  const chapterScore = countedCategories > 0 
                    ? (totalScore / countedCategories).toFixed(1)
                    : '0.0';

                  return {
                    chapter: parseInt(chapter),
                    discipline: ratings.D || 'Not Evaluated',
                    behaviour: ratings.B || 'Not Evaluated',
                    homework: ratings.HW || 'Not Evaluated',
                    participation: ratings.AP || 'Not Evaluated',
                    notes: ratings.notes || 'No notes available',
                    score: parseFloat(chapterScore)
                  };
                });

                // Calculate overall score across all chapters
                const totalScore = chaptersData.reduce((sum, ch) => sum + ch.score, 0);
                const overallScore = chaptersData.length > 0 
                  ? (totalScore / chaptersData.length).toFixed(1)
                  : '0.0';

                allEvaluations = {
                  overallScore: parseFloat(overallScore),
                  totalChapters: chaptersData.length,
                  chapters: chaptersData
                };
              }
            }
          } catch (evalFetchError) {
            console.error('Error fetching evaluations:', evalFetchError);
          }
        }

        reportData.evaluation = allEvaluations;
      }

      // Create text report
      let reportText = `
═══════════════════════════════════════════════════════════════
                    STUDENT REPORT
═══════════════════════════════════════════════════════════════

Student Name: ${reportData.studentInfo.name}
House: ${reportData.studentInfo.house}
Report Generated: ${reportData.studentInfo.generatedDate}
Report Type: ${type === 'attendance' ? 'ATTENDANCE REPORT' : 'EVALUATION REPORT'}

${reportData.attendance ? `───────────────────────────────────────────────────────────────
                    ATTENDANCE SUMMARY
───────────────────────────────────────────────────────────────

Overall Attendance: ${reportData.attendance.percentage}%
Total Sessions: ${reportData.attendance.totalSessions}

Breakdown:
  • Present: ${reportData.attendance.present}
  • Late: ${reportData.attendance.late}
  • Absent (Unexcused): ${reportData.attendance.absent}
  • Excused: ${reportData.attendance.excused}
  • Unattended Mass: ${reportData.attendance.unattendedMass}

Weekly Attendance Record:
${reportData.attendance.weeklyRecords.map(record => 
  `  ${record.date}: ${record.status}`
).join('\n')}

` : ''}───────────────────────────────────────────────────────────────
                    ABSENCE REQUESTS
───────────────────────────────────────────────────────────────

Total Requests: ${reportData.absenceRequests.length}

${reportData.absenceRequests.length > 0 ? reportData.absenceRequests.map((req, idx) => `
Request #${idx + 1}:
  Date: ${req.date}
  Reason: ${req.reason}
  Status: ${req.status.toUpperCase()}
  Submitted On: ${req.submittedOn}
  Reviewed By: ${req.reviewedBy}
  Review Notes: ${req.reviewNotes}
`).join('\n') : '  No absence requests found.\n'}

${reportData.evaluation ? `───────────────────────────────────────────────────────────────
                    EVALUATION SUMMARY
───────────────────────────────────────────────────────────────

Overall Score (All Chapters): ${reportData.evaluation.overallScore}%
Total Chapters Evaluated: ${reportData.evaluation.totalChapters}

${reportData.evaluation.chapters.map(chapterData => `
CHAPTER ${chapterData.chapter}:
───────────────────────────────────────────────────────────────
  Chapter Score: ${chapterData.score}%
  
  Category Ratings:
    • Discipline: ${chapterData.discipline}
    • Behaviour: ${chapterData.behaviour}
    • Homework: ${chapterData.homework}
    • Active Participation: ${chapterData.participation}
  
  📝 Teacher Comments:
  ┌─────────────────────────────────────────────────────────┐
  │ ${chapterData.notes.split('\n').join('\n  │ ')}
  └─────────────────────────────────────────────────────────┘
`).join('\n')}
` : ''}═══════════════════════════════════════════════════════════════
                    END OF REPORT
═══════════════════════════════════════════════════════════════
`;

      // Create and download file
      const blob = new Blob([reportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const reportType = type === 'attendance' ? 'Attendance' : 'Evaluation';
      a.download = `${student.studentName.replace(/\s+/g, '_')}_${reportType}_Report_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setDownloadingReport(false);
    }
  };

  return (
    <AnimatePresence>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '800px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              zIndex: 10
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            <X style={{ width: '20px', height: '20px', color: '#666' }} />
          </button>

          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
            paddingBottom: '20px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <User style={{ width: '32px', height: '32px', color: '#3b82f6' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: '0 0 4px 0'
              }}>
                {student.studentName}
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#666',
                margin: 0
              }}>
                {type === 'attendance' ? 'Attendance Profile' : 'Evaluation Profile'}
              </p>
            </div>
            {/* Download Report Button for Admins */}
            {isAdmin && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={downloadStudentReport}
                disabled={downloadingReport}
                style={{
                  background: downloadingReport 
                    ? '#94a3b8' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: downloadingReport ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: downloadingReport 
                    ? 'none' 
                    : '0 4px 12px rgba(102, 126, 234, 0.4)',
                  flexShrink: 0
                }}
              >
                {downloadingReport ? (
                  <>
                    <Loader style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download style={{ width: '16px', height: '16px' }} />
                    <span>Download Report</span>
                  </>
                )}
              </motion.button>
            )}
          </div>

          {/* Attendance Tab Content */}
          {type === 'attendance' && attendanceData && (
            <div>
              {/* Overall Attendance */}
              <div style={{
                padding: '20px',
                backgroundColor: getAttendanceColor(parseFloat(student.attendancePercentage)) + '10',
                borderRadius: '12px',
                marginBottom: '24px',
                border: `2px solid ${getAttendanceColor(parseFloat(student.attendancePercentage)) + '30'}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <TrendingUp style={{ 
                      width: '20px', 
                      height: '20px', 
                      color: getAttendanceColor(parseFloat(student.attendancePercentage))
                    }} />
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#666',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Overall Attendance
                    </span>
                  </div>
                  <span style={{
                    fontSize: '32px',
                    fontWeight: '700',
                    color: getAttendanceColor(parseFloat(student.attendancePercentage))
                  }}>
                    {student.attendancePercentage}%
                  </span>
                </div>
                <p style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: getAttendanceColor(parseFloat(student.attendancePercentage)),
                  margin: 0,
                  textAlign: 'center'
                }}>
                  {getAttendanceLabel(parseFloat(student.attendancePercentage))}
                </p>
              </div>

              {/* Attendance Breakdown */}
              <div style={{
                marginBottom: '24px'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  margin: '0 0 16px 0'
                }}>
                  Attendance Breakdown
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px'
                }}>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <p style={{
                      fontSize: '12px',
                      color: '#666',
                      margin: '0 0 8px 0',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Total Sessions
                    </p>
                    <p style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#1a1a1a',
                      margin: 0
                    }}>
                      {student.totalSessions}
                    </p>
                  </div>

                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '12px',
                    border: '1px solid #d1fae5'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '8px'
                    }}>
                      <CheckCircle2 style={{ width: '14px', height: '14px', color: '#10b981' }} />
                      <p style={{
                        fontSize: '12px',
                        color: '#666',
                        margin: 0,
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Present
                      </p>
                    </div>
                    <p style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#10b981',
                      margin: 0
                    }}>
                      {student.present}
                    </p>
                  </div>

                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '12px',
                    border: '1px solid #fde68a'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '8px'
                    }}>
                      <Clock style={{ width: '14px', height: '14px', color: '#f59e0b' }} />
                      <p style={{
                        fontSize: '12px',
                        color: '#666',
                        margin: 0,
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Late
                      </p>
                    </div>
                    <p style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#f59e0b',
                      margin: 0
                    }}>
                      {student.late}
                    </p>
                  </div>

                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fee2e2',
                    borderRadius: '12px',
                    border: '1px solid #fecaca'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '8px'
                    }}>
                      <XCircle style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                      <p style={{
                        fontSize: '12px',
                        color: '#666',
                        margin: 0,
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Absent
                      </p>
                    </div>
                    <p style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#ef4444',
                      margin: 0
                    }}>
                      {student.absent}
                    </p>
                  </div>

                  {student.excused > 0 && (
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#dbeafe',
                      borderRadius: '12px',
                      border: '1px solid #bfdbfe'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px'
                      }}>
                        <AlertCircle style={{ width: '14px', height: '14px', color: '#3b82f6' }} />
                        <p style={{
                          fontSize: '12px',
                          color: '#666',
                          margin: 0,
                          fontWeight: '600',
                          textTransform: 'uppercase'
                        }}>
                          Excused
                        </p>
                      </div>
                      <p style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: '#3b82f6',
                        margin: 0
                      }}>
                        {student.excused}
                      </p>
                    </div>
                  )}

                  {student.unattendedMass > 0 && (
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#ede9fe',
                      borderRadius: '12px',
                      border: '1px solid #ddd6fe'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px'
                      }}>
                        <Church style={{ width: '14px', height: '14px', color: '#8b5cf6' }} />
                        <p style={{
                          fontSize: '12px',
                          color: '#666',
                          margin: 0,
                          fontWeight: '600',
                          textTransform: 'uppercase'
                        }}>
                          Unattended Mass
                        </p>
                      </div>
                      <p style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: '#8b5cf6',
                        margin: 0
                      }}>
                        {student.unattendedMass}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Weekly Attendance Record */}
              {weeks && weeks.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1a1a1a',
                    margin: '0 0 16px 0'
                  }}>
                    Weekly Attendance Record
                  </h3>

                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    padding: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {weeks.map((week) => {
                        const status = getStudentAttendanceForWeek(week.date);
                        const config = getAttendanceStatusConfig(status);
                        const Icon = config.icon;
                        
                        return (
                          <div
                            key={week.date}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '12px',
                              backgroundColor: config.bg,
                              borderRadius: '8px',
                              border: `1px solid ${config.color}30`
                            }}
                          >
                            <span style={{
                              fontSize: '13px',
                              fontWeight: '600',
                              color: '#1a1a1a'
                            }}>
                              {week.label}
                            </span>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              {Icon && <Icon style={{ width: '16px', height: '16px', color: config.color }} />}
                              <span style={{
                                fontSize: '13px',
                                fontWeight: '700',
                                color: config.color
                              }}>
                                {status || '-'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Absence Requests Section */}
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  margin: '0 0 16px 0'
                }}>
                  Absence Requests ({absenceRequests.length})
                </h3>

                {loadingRequests ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px'
                  }}>
                    <Loader style={{ 
                      width: '32px', 
                      height: '32px', 
                      color: '#667eea',
                      margin: '0 auto 12px',
                      animation: 'spin 1s linear infinite'
                    }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: 0
                    }}>
                      Loading absence requests...
                    </p>
                  </div>
                ) : absenceRequests.length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '2px dashed #e5e7eb'
                  }}>
                    <FileText style={{ 
                      width: '48px', 
                      height: '48px', 
                      color: '#d1d5db',
                      margin: '0 auto 12px'
                    }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: 0
                    }}>
                      No absence requests found
                    </p>
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {absenceRequests.map((request) => {
                      const statusConfig = getRequestStatusConfig(request.status);
                      
                      return (
                        <div
                          key={request.id}
                          style={{
                            padding: '16px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '12px',
                            border: `2px solid ${statusConfig.color}30`
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
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '4px'
                              }}>
                                <Calendar style={{ width: '14px', height: '14px', color: '#666' }} />
                                <span style={{
                                  fontSize: '14px',
                                  fontWeight: '700',
                                  color: '#1a1a1a'
                                }}>
                                  {formatDate(request.absence_date)}
                                </span>
                              </div>
                              <p style={{
                                fontSize: '13px',
                                color: '#666',
                                margin: '4px 0 0 22px',
                                lineHeight: 1.5
                              }}>
                                {request.reason}
                              </p>
                            </div>
                            <div style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              backgroundColor: statusConfig.bg,
                              border: `1px solid ${statusConfig.color}`,
                              flexShrink: 0,
                              marginLeft: '12px'
                            }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                color: statusConfig.color,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>

                          {request.status !== 'pending' && (
                            <div style={{
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid #e5e7eb'
                            }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '12px',
                                color: '#666',
                                marginBottom: request.review_notes ? '8px' : '0'
                              }}>
                                <span>Reviewed by: {request.reviewer?.full_name || 'N/A'}</span>
                                <span>{formatDate(request.reviewed_at)}</span>
                              </div>
                              {request.review_notes && (
                                <div style={{
                                  padding: '8px 12px',
                                  backgroundColor: 'white',
                                  borderRadius: '6px',
                                  border: '1px solid #e5e7eb'
                                }}>
                                  <p style={{
                                    fontSize: '12px',
                                    color: '#666',
                                    margin: 0,
                                    fontStyle: 'italic'
                                  }}>
                                    "{request.review_notes}"
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{
                            marginTop: '8px',
                            fontSize: '11px',
                            color: '#94a3b8'
                          }}>
                            Submitted on {formatDate(request.created_at)}
                            {request.parent?.full_name && ` by ${request.parent.full_name}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Evaluation Tab Content */}
          {type === 'evaluation' && student.ratings && (
            <div>
              {/* Overall Score */}
              <div style={{
                padding: '20px',
                backgroundColor: getScoreColor(student.score) + '10',
                borderRadius: '12px',
                marginBottom: '24px',
                border: `2px solid ${getScoreColor(student.score) + '30'}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <TrendingUp style={{ 
                      width: '20px', 
                      height: '20px', 
                      color: getScoreColor(student.score)
                    }} />
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#666',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Overall Score
                    </span>
                  </div>
                  <span style={{
                    fontSize: '32px',
                    fontWeight: '700',
                    color: getScoreColor(student.score)
                  }}>
                    {student.score}%
                  </span>
                </div>
                <p style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: getScoreColor(student.score),
                  margin: 0,
                  textAlign: 'center'
                }}>
                  {getScoreLabel(student.score)}
                </p>
              </div>

              {/* Category Performance */}
              <div style={{
                marginBottom: '24px'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  margin: '0 0 16px 0'
                }}>
                  Category Performance
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px'
                }}>
                  {categories.map(category => {
                    const Icon = category.icon;
                    const rating = student.ratings[category.key];
                    const ratingConfig = evalRatings.find(r => r.value === rating);
                    
                    return (
                      <div
                        key={category.key}
                        style={{
                          padding: '16px',
                          backgroundColor: category.bg,
                          borderRadius: '12px',
                          border: `2px solid ${category.color}30`
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <Icon style={{ width: '16px', height: '16px', color: category.color }} />
                            <span style={{
                              fontSize: '13px',
                              fontWeight: '700',
                              color: '#1a1a1a'
                            }}>
                              {category.label}
                            </span>
                          </div>
                        </div>
                        {rating ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              backgroundColor: ratingConfig.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              fontWeight: '800',
                              color: 'white'
                            }}>
                              {rating}
                            </div>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#666'
                            }}>
                              {ratingConfig.label}
                            </span>
                          </div>
                        ) : (
                          <div style={{
                            textAlign: 'center',
                            fontSize: '13px',
                            color: '#666',
                            padding: '12px 0'
                          }}>
                            Not yet evaluated
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Teacher Comments for this Chapter */}
              {student.notes && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '12px',
                  border: '2px solid #fbbf24',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <FileText style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                    <h4 style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#92400e',
                      margin: 0
                    }}>
                      Teacher Comments (Chapter {chapters?.selectedChapter})
                    </h4>
                  </div>
                  <p style={{
                    fontSize: '13px',
                    color: '#78350f',
                    margin: 0,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {student.notes}
                  </p>
                </div>
              )}

              {/* All Teacher Comments from All Chapters */}
              {allTeacherComments.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1a1a1a',
                    margin: '0 0 16px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <BookOpen style={{ width: '18px', height: '18px', color: '#667eea' }} />
                    All Teacher Comments ({allTeacherComments.length} Chapter{allTeacherComments.length !== 1 ? 's' : ''})
                  </h3>

                  {loadingComments ? (
                    <div style={{
                      padding: '40px',
                      textAlign: 'center',
                      backgroundColor: '#f9fafb',
                      borderRadius: '12px'
                    }}>
                      <Loader style={{ 
                        width: '32px', 
                        height: '32px', 
                        color: '#667eea',
                        margin: '0 auto 12px',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <p style={{
                        fontSize: '14px',
                        color: '#666',
                        margin: 0
                      }}>
                        Loading teacher comments...
                      </p>
                    </div>
                  ) : (
                    <div style={{
                      maxHeight: '400px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      {allTeacherComments.map((commentData) => (
                        <div
                          key={commentData.chapter}
                          style={{
                            padding: '16px',
                            backgroundColor: '#f0fdf4',
                            borderRadius: '12px',
                            border: '2px solid #86efac'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #bbf7d0'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                backgroundColor: '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: '800',
                                color: 'white'
                              }}>
                                {commentData.chapter}
                              </div>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: '#1a1a1a'
                              }}>
                                Chapter {commentData.chapter}
                              </span>
                            </div>
                            <span style={{
                              fontSize: '11px',
                              color: '#666',
                              fontStyle: 'italic'
                            }}>
                              Last updated: {new Date(commentData.lastUpdated).toLocaleDateString('en-GB', { 
                                day: 'numeric', 
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          <div style={{
                            padding: '12px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #d1fae5'
                          }}>
                            <p style={{
                              fontSize: '13px',
                              color: '#065f46',
                              margin: 0,
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap'
                            }}>
                              {commentData.notes}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Absence Requests Section - Also shown in Evaluation tab */}
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  margin: '0 0 16px 0'
                }}>
                  Absence Requests ({absenceRequests.length})
                </h3>

                {loadingRequests ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px'
                  }}>
                    <Loader style={{ 
                      width: '32px', 
                      height: '32px', 
                      color: '#667eea',
                      margin: '0 auto 12px',
                      animation: 'spin 1s linear infinite'
                    }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: 0
                    }}>
                      Loading absence requests...
                    </p>
                  </div>
                ) : absenceRequests.length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '2px dashed #e5e7eb'
                  }}>
                    <FileText style={{ 
                      width: '48px', 
                      height: '48px', 
                      color: '#d1d5db',
                      margin: '0 auto 12px'
                    }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: 0
                    }}>
                      No absence requests found
                    </p>
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {absenceRequests.map((request) => {
                      const statusConfig = getRequestStatusConfig(request.status);
                      
                      return (
                        <div
                          key={request.id}
                          style={{
                            padding: '16px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '12px',
                            border: `2px solid ${statusConfig.color}30`
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
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '4px'
                              }}>
                                <Calendar style={{ width: '14px', height: '14px', color: '#666' }} />
                                <span style={{
                                  fontSize: '14px',
                                  fontWeight: '700',
                                  color: '#1a1a1a'
                                }}>
                                  {formatDate(request.absence_date)}
                                </span>
                              </div>
                              <p style={{
                                fontSize: '13px',
                                color: '#666',
                                margin: '4px 0 0 22px',
                                lineHeight: 1.5
                              }}>
                                {request.reason}
                              </p>
                            </div>
                            <div style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              backgroundColor: statusConfig.bg,
                              border: `1px solid ${statusConfig.color}`,
                              flexShrink: 0,
                              marginLeft: '12px'
                            }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                color: statusConfig.color,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>

                          {request.status !== 'pending' && (
                            <div style={{
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid #e5e7eb'
                            }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '12px',
                                color: '#666',
                                marginBottom: request.review_notes ? '8px' : '0'
                              }}>
                                <span>Reviewed by: {request.reviewer?.full_name || 'N/A'}</span>
                                <span>{formatDate(request.reviewed_at)}</span>
                              </div>
                              {request.review_notes && (
                                <div style={{
                                  padding: '8px 12px',
                                  backgroundColor: 'white',
                                  borderRadius: '6px',
                                  border: '1px solid #e5e7eb'
                                }}>
                                  <p style={{
                                    fontSize: '12px',
                                    color: '#666',
                                    margin: 0,
                                    fontStyle: 'italic'
                                  }}>
                                    "{request.review_notes}"
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{
                            marginTop: '8px',
                            fontSize: '11px',
                            color: '#94a3b8'
                          }}>
                            Submitted on {formatDate(request.created_at)}
                            {request.parent?.full_name && ` by ${request.parent.full_name}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StudentProfilePopup;