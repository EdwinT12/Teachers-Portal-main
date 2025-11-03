import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, BookOpen, Users, Info, AlertCircle } from 'lucide-react';
import CompletionStatusCell from './CompletionStatusCell';
import WeekDetailsModal from './WeekDetailsModal';

const EvaluationReportTab = ({ allClasses, allTeachers, chapters, selectedChapters = [], onStatsUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [completionData, setCompletionData] = useState({});
  const [expandedClass, setExpandedClass] = useState(null);
  const [selectedChapterDetails, setSelectedChapterDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [allChapters, setAllChapters] = useState([]);
  
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

  useEffect(() => {
    loadAllChapters();
  }, []);

  // Trigger data loading when component mounts or key changes
  useEffect(() => {
    console.log('EvaluationReportTab: useEffect triggered', { 
      classesCount: allClasses.length, 
      chaptersCount: allChapters.length 
    });
    
    // Reset the stats update ref when data changes
    statsUpdateRef.current = false;
    
    if (allClasses.length > 0 && allChapters.length > 0) {
      console.log('EvaluationReportTab: Starting checkEvaluationCompletion');
      checkEvaluationCompletion();
    } else if (allClasses.length === 0) {
      console.log('EvaluationReportTab: No classes, setting empty data');
      setLoading(false);
      setCompletionData({});
    } else {
      console.log('EvaluationReportTab: Waiting for data');
      setLoading(false);
    }
  }, [allClasses.length, allChapters.length]);

  const loadAllChapters = async () => {
    try {
      const { data, error } = await supabase
        .from('lesson_evaluations')
        .select('chapter_number')
        .order('chapter_number');

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading chapters:', error);
        setAllChapters([]);
        return;
      }

      const uniqueChapters = [...new Set((data || []).map(d => d.chapter_number))];
      const sortedChapters = uniqueChapters.filter(c => c !== null).sort((a, b) => a - b);
      
      if (sortedChapters.length === 0) {
        setAllChapters(Array.from({ length: 20 }, (_, i) => i + 1));
      } else {
        setAllChapters(sortedChapters);
      }
    } catch (error) {
      console.error('Error in loadAllChapters:', error);
      setAllChapters(Array.from({ length: 20 }, (_, i) => i + 1));
    }
  };

  const checkEvaluationCompletion = async () => {
    setLoading(true);
    const completionMap = {};
    let statsComplete = 0;
    let statsPartial = 0;
    let statsIncomplete = 0;

    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('Evaluation loading timeout - setting loading to false');
      setLoading(false);
    }, 15000);

    try {
      for (const classItem of allClasses) {
        const classGroup = getClassGroup(classItem.year_level);
        
        completionMap[classItem.id] = {
          className: classItem.name,
          yearLevel: classItem.year_level,
          sheetName: classItem.sheet_name,
          group: classGroup,
          chapters: []
        };

        const teacher = allTeachers.find(t => t.classes?.id === classItem.id);
        
        const { data: evalStudents, error: studentsError } = await supabase
          .from('eval_students')
          .select('id, student_name, row_number')
          .eq('class_id', classItem.id)
          .order('row_number');

        if (studentsError) {
          console.error(`Error fetching eval_students for class ${classItem.name}:`, studentsError);
          continue;
        }

        const totalStudents = evalStudents?.length || 0;
        const totalCategories = 4;
        const totalExpected = totalStudents * totalCategories;

        // Filter chapters based on selectedChapters prop
        const chaptersToCheck = selectedChapters.length > 0 
          ? allChapters.filter(ch => selectedChapters.includes(ch))
          : allChapters;

        for (const chapterNumber of chaptersToCheck) {
          const { data: evaluationRecords, error: evaluationError } = await supabase
            .from('lesson_evaluations')
            .select('eval_student_id, category, rating, created_at, teacher_id, synced_to_sheets')
            .eq('class_id', classItem.id)
            .eq('chapter_number', chapterNumber);

          if (evaluationError && evaluationError.code !== 'PGRST116') {
            console.error(`Error fetching evaluations for ${classItem.name} chapter ${chapterNumber}:`, evaluationError);
            continue;
          }

          const filledCount = evaluationRecords?.length || 0;
          const completionPercentage = totalExpected > 0 
            ? Math.round((filledCount / totalExpected) * 100) 
            : 0;

          let status = 'incomplete';
          if (completionPercentage === 100) {
            status = 'complete';
          } else if (completionPercentage > 0) {
            status = 'partial';
          }

          let uploadInfo = null;
          if (evaluationRecords && evaluationRecords.length > 0) {
            uploadInfo = {
              uploadedBy: teacher?.full_name || 'Unknown Teacher',
              uploadedAt: evaluationRecords[0].created_at,
              teacherId: evaluationRecords[0].teacher_id,
              syncedToSheets: evaluationRecords[0].synced_to_sheets
            };
          }

          completionMap[classItem.id].chapters.push({
            chapterNumber,
            status,
            totalStudents,
            totalExpected,
            filledCount,
            completionPercentage,
            uploadInfo,
            records: evaluationRecords || []
          });

          if (status === 'complete') statsComplete++;
          else if (status === 'partial') statsPartial++;
          else statsIncomplete++;
        }

        completionMap[classItem.id].chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
      }

      setCompletionData(completionMap);
      
      // Update parent stats only once
      if (onStatsUpdate && !statsUpdateRef.current) {
        statsUpdateRef.current = true;
        onStatsUpdate({
          totalClasses: allClasses.length,
          attendanceComplete: 0,
          evaluationComplete: statsComplete,
          attendancePartial: 0,
          evaluationPartial: statsPartial,
          attendanceIncomplete: 0,
          evaluationIncomplete: statsIncomplete
        });
      }
    } catch (error) {
      console.error('Error checking evaluation completion:', error);
      toast.error('Failed to load evaluation data');
    } finally {
      clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const handleViewDetails = (classData, chapterData) => {
    setSelectedChapterDetails({
      className: classData.className,
      chapterLabel: `Chapter ${chapterData.chapterNumber}`,
      chapter: chapterData.chapterNumber,
      uploadedBy: chapterData.uploadInfo?.uploadedBy,
      uploadedAt: chapterData.uploadInfo?.uploadedAt
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
            <BookOpen style={{ width: '40px', height: '40px' }} />
          </motion.div>
          <p>Loading evaluation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Empty State - No Chapters */}
      {allChapters.length === 0 && (
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
            <BookOpen style={{ width: '80px', height: '80px', margin: '0 auto 20px', color: '#d97706' }} />
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
            📚 No Chapters Found
          </h3>
          <p style={{ 
            fontSize: '16px', 
            margin: 0, 
            color: '#b45309',
            lineHeight: '1.5'
          }}>
            Start by submitting evaluations to create chapter records and track student progress.
          </p>
        </motion.div>
      )}

      {/* Classes Table */}
      {allChapters.length > 0 && Object.keys(completionData).length > 0 && (
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
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
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
                  Chapters
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
                const completeCount = classData.chapters.filter(c => c.status === 'complete').length;
                const partialCount = classData.chapters.filter(c => c.status === 'partial').length;
                const incompleteCount = classData.chapters.length - completeCount - partialCount;
                
                // Calculate average completion percentage across all chapters
                const overallPercentage = classData.chapters.length > 0
                  ? Math.round(
                      classData.chapters.reduce((sum, chapter) => sum + chapter.completionPercentage, 0) / 
                      classData.chapters.length
                    )
                  : 0;

                return (
                  <AnimatePresence key={classId}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        background: isExpanded ? '#eff6ff' : 'white',
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
                        {classData.chapters.length}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '6px 16px',
                          borderRadius: '20px',
                          background: overallPercentage >= 90 
                            ? '#dbeafe' 
                            : overallPercentage >= 70
                              ? '#e0e7ff'
                              : overallPercentage >= 50 
                                ? '#fef3c7' 
                                : overallPercentage > 0
                                  ? '#fed7d7'
                                  : '#fee2e2',
                          color: overallPercentage >= 90 
                            ? '#1e40af' 
                            : overallPercentage >= 70
                              ? '#3730a3'
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
                            background: '#eff6ff'
                          }}>
                            <h4 style={{
                              margin: '0 0 16px 0',
                              fontSize: '14px',
                              fontWeight: '700',
                              color: '#1e293b'
                            }}>
                              Chapter Evaluation Breakdown for {classData.className}
                            </h4>
                            {classData.chapters.length > 0 ? (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                gap: '12px'
                              }}>
                                {classData.chapters.map((chapter, idx) => (
                                  <CompletionStatusCell
                                    key={idx}
                                    label={`Chapter ${chapter.chapterNumber}`}
                                    date={null}
                                    status={chapter.status}
                                    filledCount={chapter.filledCount}
                                    totalCount={chapter.totalExpected}
                                    completionPercentage={chapter.completionPercentage}
                                    onViewDetails={() => handleViewDetails(classData, chapter)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div style={{
                                textAlign: 'center',
                                padding: '40px 20px',
                                color: '#94a3b8'
                              }}>
                                <BookOpen style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.5 }} />
                                <p style={{ margin: 0, fontSize: '14px' }}>
                                  No chapters have been evaluated yet
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
      {allChapters.length > 0 && Object.keys(completionData).length === 0 && (
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
            Add classes to start tracking evaluations
          </p>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedChapterDetails && (
        <WeekDetailsModal
          details={selectedChapterDetails}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
};

export default EvaluationReportTab;