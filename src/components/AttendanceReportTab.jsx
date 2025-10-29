import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Calendar, Users, Info, AlertCircle } from 'lucide-react';
import CompletionStatusCell from './CompletionStatusCell';
import WeekDetailsModal from './WeekDetailsModal';

const AttendanceReportTab = ({ allClasses, allTeachers, lessonDates, onStatsUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [completionData, setCompletionData] = useState({});
  const [expandedClass, setExpandedClass] = useState(null);
  const [selectedWeekDetails, setSelectedWeekDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Use ref to prevent infinite loops from stats updates
  const statsUpdateRef = useRef(false);

  /**
   * Determines if a class belongs to Junior or Senior group
   * UPDATED per user specification:
   * Juniors: Reception (0), Year 1, 2, 3, 4, 5a, 5b (0-5)
   * Seniors: Year 6, 7, 8, 9, 10, 11, 12 (6-12)
   */
  const getClassGroup = (yearLevel) => {
    if (yearLevel >= 0 && yearLevel <= 5) {
      return 'Junior';
    } else if (yearLevel >= 6 && yearLevel <= 12) {
      return 'Senior';
    }
    return null;
  };

  /**
   * Filters lesson dates to only include those relevant to this class
   */
  const getRelevantLessonDates = (classItem) => {
    const classGroup = getClassGroup(classItem.year_level);
    
    return lessonDates.filter(lesson => {
      if (lesson.group_type === 'Both') return true;
      if (lesson.group_type === classGroup) return true;
      return false;
    });
  };

  // Trigger data loading when component mounts or key changes
  useEffect(() => {
    console.log('AttendanceReportTab: useEffect triggered', { 
      classesCount: allClasses.length, 
      lessonsCount: lessonDates.length 
    });
    
    // Reset the stats update ref when data changes
    statsUpdateRef.current = false;
    
    if (allClasses.length > 0 && lessonDates.length >= 0) {
      console.log('AttendanceReportTab: Starting checkAttendanceCompletion');
      checkAttendanceCompletion();
    } else if (allClasses.length === 0) {
      console.log('AttendanceReportTab: No classes, setting empty data');
      setLoading(false);
      setCompletionData({});
    } else {
      console.log('AttendanceReportTab: Waiting for data');
      setLoading(false);
    }
  }, [allClasses.length, lessonDates.length]);

  const checkAttendanceCompletion = async () => {
    setLoading(true);
    const completionMap = {};
    let statsComplete = 0;
    let statsPartial = 0;
    let statsIncomplete = 0;

    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('Attendance loading timeout - setting loading to false');
      setLoading(false);
    }, 15000);

    try {
      if (!lessonDates || lessonDates.length === 0) {
        console.warn('No lesson dates available from catechism_lesson_logs');
        setCompletionData({});
        
        // Only update stats once
        if (onStatsUpdate && !statsUpdateRef.current) {
          statsUpdateRef.current = true;
          onStatsUpdate({
            totalClasses: allClasses.length,
            attendanceComplete: 0,
            evaluationComplete: 0,
            attendancePartial: 0,
            evaluationPartial: 0,
            attendanceIncomplete: 0,
            evaluationIncomplete: 0
          });
        }
        
        setLoading(false);
        return;
      }

      for (const classItem of allClasses) {
        const classGroup = getClassGroup(classItem.year_level);
        
        completionMap[classItem.id] = {
          className: classItem.name,
          yearLevel: classItem.year_level,
          sheetName: classItem.sheet_name,
          group: classGroup,
          lessons: []
        };

        const teacher = allTeachers.find(t => t.classes?.id === classItem.id);
        
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, student_name, row_number')
          .eq('class_id', classItem.id)
          .order('row_number');

        if (studentsError) {
          console.error(`Error fetching students for class ${classItem.name}:`, studentsError);
          continue;
        }

        const totalStudents = students?.length || 0;
        const relevantLessons = getRelevantLessonDates(classItem);

        for (const lesson of relevantLessons) {
          const lessonDate = lesson.lesson_date;
          
          const { data: attendanceRecords, error: attendanceError } = await supabase
            .from('attendance_records')
            .select('student_id, status, created_at, teacher_id, synced_to_sheets')
            .eq('class_id', classItem.id)
            .eq('attendance_date', lessonDate);

          if (attendanceError && attendanceError.code !== 'PGRST116') {
            console.error(`Error fetching attendance for ${classItem.name} on ${lessonDate}:`, attendanceError);
            continue;
          }

          const filledCount = attendanceRecords?.length || 0;
          const completionPercentage = totalStudents > 0 
            ? Math.round((filledCount / totalStudents) * 100) 
            : 0;

          let status = 'incomplete';
          if (completionPercentage === 100) {
            status = 'complete';
          } else if (completionPercentage > 0) {
            status = 'partial';
          }

          let uploadInfo = null;
          if (attendanceRecords && attendanceRecords.length > 0) {
            uploadInfo = {
              uploadedBy: teacher?.full_name || 'Unknown Teacher',
              uploadedAt: attendanceRecords[0].created_at,
              teacherId: attendanceRecords[0].teacher_id,
              syncedToSheets: attendanceRecords[0].synced_to_sheets
            };
          }

          const dateObj = new Date(lessonDate + 'T12:00:00');
          const weekLabel = dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          });

          completionMap[classItem.id].lessons.push({
            weekLabel,
            date: lessonDate,
            status,
            totalStudents,
            filledCount,
            completionPercentage,
            uploadInfo,
            records: attendanceRecords || [],
            lessonGroupType: lesson.group_type
          });

          if (status === 'complete') statsComplete++;
          else if (status === 'partial') statsPartial++;
          else statsIncomplete++;
        }

        completionMap[classItem.id].lessons.sort((a, b) => {
          return new Date(b.date) - new Date(a.date);
        });
      }

      setCompletionData(completionMap);
      
      // Update parent stats only once
      if (onStatsUpdate && !statsUpdateRef.current) {
        statsUpdateRef.current = true;
        onStatsUpdate({
          totalClasses: allClasses.length,
          attendanceComplete: statsComplete,
          evaluationComplete: 0,
          attendancePartial: statsPartial,
          evaluationPartial: 0,
          attendanceIncomplete: statsIncomplete,
          evaluationIncomplete: 0
        });
      }
    } catch (error) {
      console.error('Error checking attendance completion:', error);
      toast.error('Failed to load attendance data');
    } finally {
      clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const handleViewDetails = (classData, lessonData) => {
    setSelectedWeekDetails({
      className: classData.className,
      weekLabel: lessonData.weekLabel,
      date: lessonData.date,
      uploadedBy: lessonData.uploadInfo?.uploadedBy,
      uploadedAt: lessonData.uploadInfo?.uploadedAt
    });
    setShowDetailsModal(true);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        color: '#64748b'
      }}>
        <div style={{ textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ display: 'inline-block', marginBottom: '12px' }}
          >
            <Calendar style={{ width: '40px', height: '40px' }} />
          </motion.div>
          <p>Loading attendance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginBottom: '24px',
          padding: '20px',
          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          borderRadius: '12px',
          border: '1px solid #6ee7b7',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
        }}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Calendar style={{ width: '20px', height: '20px', color: 'white' }} />
        </div>
        <div>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: '700',
            color: '#065f46'
          }}>
            📅 Attendance Report
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#047857',
            lineHeight: '1.6'
          }}>
            Track attendance completion for actual catechism lesson dates. 
            Junior classes (Reception-Year 5) see Junior and Both lessons. 
            Senior classes (Year 6-12) see Senior and Both lessons.
          </p>
        </div>
      </motion.div>

      {/* Empty State - No Lessons */}
      {lessonDates.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: '16px',
            border: '1px solid #fbbf24',
            boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)'
          }}
        >
          <motion.div
            animate={{ 
              y: [0, -5, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            <Calendar style={{ width: '80px', height: '80px', margin: '0 auto 20px', color: '#d97706' }} />
          </motion.div>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            margin: '0 0 12px 0', 
            color: '#92400e',
            background: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            📅 No Lesson Dates Found
          </h3>
          <p style={{ 
            fontSize: '16px', 
            margin: 0, 
            color: '#b45309',
            lineHeight: '1.5'
          }}>
            Add lesson dates in the Catechism Lesson Tracker to start tracking attendance.
          </p>
        </motion.div>
      )}

      {/* Classes Table */}
      {lessonDates.length > 0 && Object.keys(completionData).length > 0 && (
        <div style={{
          overflowX: 'auto',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: 'white'
          }}>
            <thead>
              <tr style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white'
              }}>
                <th style={{
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '700',
                  fontSize: '14px'
                }}>
                  Class
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: '14px'
                }}>
                  Group
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: '14px'
                }}>
                  Lessons
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: '14px'
                }}>
                  Completion
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: '14px'
                }}>
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(completionData).map(([classId, classData]) => {
                const isExpanded = expandedClass === classId;
                const completeCount = classData.lessons.filter(l => l.status === 'complete').length;
                const partialCount = classData.lessons.filter(l => l.status === 'partial').length;
                const incompleteCount = classData.lessons.length - completeCount - partialCount;
                
                // Calculate average completion percentage across all lessons
                const overallPercentage = classData.lessons.length > 0
                  ? Math.round(
                      classData.lessons.reduce((sum, lesson) => sum + lesson.completionPercentage, 0) / 
                      classData.lessons.length
                    )
                  : 0;

                return (
                  <AnimatePresence key={classId}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        background: isExpanded ? '#f0fdf4' : 'white',
                        cursor: 'pointer'
                      }}
                      onClick={() => setExpandedClass(isExpanded ? null : classId)}
                    >
                      <td style={{ padding: '16px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          {isExpanded ? (
                            <ChevronUp style={{ width: '20px', height: '20px', color: '#64748b' }} />
                          ) : (
                            <ChevronDown style={{ width: '20px', height: '20px', color: '#64748b' }} />
                          )}
                          <div>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1e293b'
                            }}>
                              {classData.className}
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#64748b'
                            }}>
                              Year {classData.yearLevel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{
                        padding: '16px',
                        textAlign: 'center'
                      }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: classData.group === 'Junior' ? '#dbeafe' : '#fce7f3',
                          color: classData.group === 'Junior' ? '#1e40af' : '#be123c'
                        }}>
                          {classData.group}
                        </span>
                      </td>
                      <td style={{
                        padding: '16px',
                        textAlign: 'center',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#475569'
                      }}>
                        {classData.lessons.length}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '6px 16px',
                          borderRadius: '20px',
                          background: overallPercentage >= 90 
                            ? '#d1fae5' 
                            : overallPercentage >= 70
                              ? '#dbeafe'
                              : overallPercentage >= 50 
                                ? '#fef3c7' 
                                : overallPercentage > 0
                                  ? '#fed7d7'
                                  : '#fee2e2',
                          color: overallPercentage >= 90 
                            ? '#047857' 
                            : overallPercentage >= 70
                              ? '#1e40af'
                              : overallPercentage >= 50 
                                ? '#92400e' 
                                : overallPercentage > 0
                                  ? '#c53030'
                                  : '#991b1b',
                          fontSize: '14px',
                          fontWeight: '700'
                        }}>
                          {overallPercentage}%
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '13px',
                          color: '#64748b'
                        }}>
                          ✅ {completeCount} • 🟡 {partialCount} • ❌ {incompleteCount}
                        </span>
                      </td>
                    </motion.tr>

                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <td colSpan={5} style={{ padding: '0' }}>
                          <div style={{
                            padding: '20px',
                            background: '#f0fdf4'
                          }}>
                            <h4 style={{
                              margin: '0 0 16px 0',
                              fontSize: '14px',
                              fontWeight: '700',
                              color: '#1e293b'
                            }}>
                              Lesson Attendance Breakdown for {classData.className}
                            </h4>
                            {classData.lessons.length > 0 ? (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                gap: '12px'
                              }}>
                                {classData.lessons.map((lesson, idx) => (
                                  <CompletionStatusCell
                                    key={idx}
                                    label={lesson.weekLabel}
                                    date={lesson.date}
                                    status={lesson.status}
                                    filledCount={lesson.filledCount}
                                    totalCount={lesson.totalStudents}
                                    completionPercentage={lesson.completionPercentage}
                                    onViewDetails={() => handleViewDetails(classData, lesson)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div style={{
                                textAlign: 'center',
                                padding: '40px 20px',
                                color: '#94a3b8'
                              }}>
                                <Calendar style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.5 }} />
                                <p style={{ margin: 0, fontSize: '14px' }}>
                                  No lessons scheduled for this class group
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State - No Classes */}
      {lessonDates.length > 0 && Object.keys(completionData).length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#94a3b8'
        }}>
          <Users style={{ width: '64px', height: '64px', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>
            No Classes Found
          </p>
          <p style={{ fontSize: '14px', margin: 0 }}>
            Add classes to start tracking attendance
          </p>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedWeekDetails && (
        <WeekDetailsModal
          details={selectedWeekDetails}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
};

export default AttendanceReportTab;