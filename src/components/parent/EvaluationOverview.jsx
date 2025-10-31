import { useEffect, useState } from 'react';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { Award, BookOpen, Heart, Zap, Calendar, TrendingUp, Filter, ChevronDown, Star, BarChart3 } from 'lucide-react';

const EvaluationOverview = ({ linkedChildren }) => {
  const [loading, setLoading] = useState(true);
  const [evaluationData, setEvaluationData] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState('all');
  const [showAllStats, setShowAllStats] = useState(false);

  const categories = [
    { key: 'D', label: 'Discipline', color: '#3b82f6', bg: '#dbeafe', icon: Award },
    { key: 'B', label: 'Behaviour', color: '#10b981', bg: '#d1fae5', icon: Heart },
    { key: 'HW', label: 'Homework', color: '#f59e0b', bg: '#fef3c7', icon: BookOpen },
    { key: 'AP', label: 'Active Participation', color: '#8b5cf6', bg: '#ede9fe', icon: Zap }
  ];

  const ratings = [
    { value: 'E', label: 'Excellent', color: '#10b981', bg: '#d1fae5', score: 3 },
    { value: 'G', label: 'Good', color: '#3b82f6', bg: '#dbeafe', score: 2 },
    { value: 'I', label: 'Improving', color: '#f59e0b', bg: '#fef3c7', score: 1 }
  ];

  useEffect(() => {
    if (linkedChildren && linkedChildren.length > 0) {
      setSelectedChild(linkedChildren[0].students?.id);
      loadEvaluationData();
    }
  }, [linkedChildren]);

  const loadEvaluationData = async () => {
    if (!linkedChildren || linkedChildren.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = {};

      console.log('Loading evaluation data for', linkedChildren.length, 'children');

      // Check if eval_students table has any records (with count to bypass RLS restrictions on data)
      const { data: allEvalStudentsGlobal, error: globalError, count: totalCount } = await supabase
        .from('eval_students')
        .select('id, student_name, class_id', { count: 'exact' });
      
      console.log('🔍 RLS Test Results:');
      console.log('  - Records returned by query:', allEvalStudentsGlobal?.length || 0);
      console.log('  - Total count (if RLS allows):', totalCount);
      console.log('  - Error:', globalError);
      
      if (globalError) {
        console.error('❌ RLS is blocking access to eval_students:', globalError);
        toast.error('Cannot access evaluation roster. This is an RLS permissions issue.');
      } else if (!allEvalStudentsGlobal || allEvalStudentsGlobal.length === 0) {
        console.warn('⚠️ RLS is filtering all records - parent cannot see any eval_students');
        console.log('💡 SOLUTION: Add RLS policy to allow parents to see eval_students for their linked children');
      } else {
        console.log('✅ Parent can see eval_students:', allEvalStudentsGlobal.slice(0, 5));
      }
      
      // If there are no eval_students at all in the system, show a system-wide message
      if (!allEvalStudentsGlobal || allEvalStudentsGlobal.length === 0) {
        console.log('Evaluation system not set up yet - no eval_students records found');
        setLoading(false);
        const emptyData = {};
        for (const child of linkedChildren) {
          if (child.students?.id) {
            emptyData[child.students.id] = {
              records: [],
              chapters: [],
              stats: {
                totalEvaluations: 0,
                categoryAverages: {},
                overallAverage: 0,
                lastEvaluationDate: null,
                recentTrend: 'neutral'
              },
              notInEvalSystem: true,
              systemNotSetup: true
            };
          }
        }
        setEvaluationData(emptyData);
        return;
      }

      for (const child of linkedChildren) {
        console.group(`📝 Processing child: ${child.students?.student_name}`);
        console.log('Full child object:', child);
        console.log('Student name:', child.students?.student_name);
        console.log('Class ID:', child.students?.class_id);
        console.log('Student ID (from students table):', child.students?.id);
        
        if (!child.students?.id) {
          console.warn('⚠️ No student ID found, skipping');
          console.groupEnd();
          continue;
        }

        // Get the student's name and class from the regular students table
        const studentName = child.students.student_name;
        const classId = child.students.class_id;

        if (!studentName || !classId) {
          console.warn('❌ Missing student name or class ID');
          console.groupEnd();
          data[child.students.id] = {
            records: [],
            chapters: [],
            stats: {
              totalEvaluations: 0,
              categoryAverages: {},
              overallAverage: 0,
              lastEvaluationDate: null,
              recentTrend: 'neutral'
            },
            notInEvalSystem: true
          };
          continue;
        }

        console.log(`🔍 Looking for eval_student with name="${studentName}" and class_id="${classId}"`);

        // Find the corresponding eval_student record by matching name AND class
        let evalStudent = null;

        // Strategy 1: Exact match (case-insensitive, trimmed)
        console.log('Strategy 1: Trying exact match...');
        const { data: exactMatch, error: exactError } = await supabase
          .from('eval_students')
          .select('id, student_name, class_id')
          .eq('class_id', classId)
          .ilike('student_name', studentName.trim())
          .maybeSingle();

        console.log('Exact match result:', exactMatch);
        console.log('Exact match error:', exactError);

        if (exactMatch) {
          evalStudent = exactMatch;
          console.log(`✅ Found exact eval_student match for "${studentName}"`, evalStudent);
        } else {
          console.log('❌ No exact match, trying fuzzy search...');
          
          // Strategy 2: Fuzzy match - get all students in the class and find best match
          const { data: classEvalStudents, error: classError } = await supabase
            .from('eval_students')
            .select('id, student_name, class_id')
            .eq('class_id', classId);

          console.log('All eval_students in class:', classEvalStudents);
          console.log('Query error:', classError);

          if (classEvalStudents && classEvalStudents.length > 0) {
            console.log(`Found ${classEvalStudents.length} eval_students in class ${classId}:`);
            classEvalStudents.forEach(s => console.log(`  - "${s.student_name}"`));

            // Try fuzzy matching
            const studentNameLower = studentName.toLowerCase().trim();
            console.log(`Searching for normalized name: "${studentNameLower}"`);
            
            const match = classEvalStudents.find(es => {
              const esNameLower = es.student_name.toLowerCase().trim();
              const exactMatch = esNameLower === studentNameLower;
              const contains = esNameLower.includes(studentNameLower) || studentNameLower.includes(esNameLower);
              console.log(`  Comparing "${esNameLower}" with "${studentNameLower}": exact=${exactMatch}, contains=${contains}`);
              return exactMatch || contains;
            });

            if (match) {
              evalStudent = match;
              console.log(`✅ Found fuzzy eval_student match: "${studentName}" → "${match.student_name}"`, match);
            } else {
              console.log(`❌ No fuzzy match found for "${studentName}"`);
            }
          } else {
            console.log(`❌ No eval_students found for class ${classId}`);
          }
        }

        if (!evalStudent) {
          // Student not in evaluation system
          console.log(`❌ FINAL RESULT: Student "${studentName}" not found in eval_students table`);
          console.groupEnd();
          data[child.students.id] = {
            records: [],
            chapters: [],
            stats: {
              totalEvaluations: 0,
              categoryAverages: {},
              overallAverage: 0,
              lastEvaluationDate: null,
              recentTrend: 'neutral'
            },
            notInEvalSystem: true
          };
          continue;
        }

        console.log(`✅ MATCHED eval_student:`, evalStudent);
        console.log(`📚 Now loading lesson_evaluations for eval_student_id: ${evalStudent.id}`);

        // Load evaluation records using the eval_student_id we just found
        const { data: records, error } = await supabase
          .from('lesson_evaluations')
          .select(`
            id,
            chapter_number,
            category,
            rating,
            teacher_notes,
            evaluation_date,
            created_at
          `)
          .eq('eval_student_id', evalStudent.id)
          .order('chapter_number', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Error loading evaluations:', error);
          console.groupEnd();
          continue;
        }

        console.log(`✅ Loaded ${records?.length || 0} evaluation records for "${studentName}" (eval_student_id: ${evalStudent.id})`);
        if (records && records.length > 0) {
          console.log('Sample evaluation records:', records.slice(0, 3));
        }

        // Process the data
        const chapters = [...new Set((records || []).map(r => r.chapter_number))].sort((a, b) => b - a);
        const stats = calculateStats(records || []);

        data[child.students.id] = {
          evalStudentId: evalStudent.id,
          records: records || [],
          chapters,
          stats,
          notInEvalSystem: false
        };
        
        console.log(`✅ Final data for "${studentName}":`, {
          evalStudentId: evalStudent.id,
          recordsCount: records?.length || 0,
          chapters,
          overallPercentage: stats.overallPercentage
        });
        console.groupEnd();
      }

      setEvaluationData(data);
    } catch (error) {
      console.error('Error loading evaluation data:', error);
      toast.error('Error loading evaluation data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (records) => {
    if (!records || records.length === 0) {
      return {
        totalEvaluations: 0,
        categoryAverages: {},
        overallAverage: 0,
        lastEvaluationDate: null,
        recentTrend: 'neutral',
        totalScore: 0,
        maxPossibleScore: 0,
        chaptersCompleted: 0,
        completedChaptersList: []
      };
    }

    const totalEvaluations = records.length;
    const categoryAverages = {};
    
    // Get unique chapters to calculate max possible score
    const uniqueChapters = [...new Set(records.map(r => r.chapter_number))];
    const chaptersCompleted = uniqueChapters.length;
    const completedChaptersList = uniqueChapters.sort((a, b) => a - b); // Sort ascending
    
    categories.forEach(category => {
      const categoryRecords = records.filter(r => r.category === category.key);
      if (categoryRecords.length > 0) {
        const sum = categoryRecords.reduce((acc, record) => {
          const ratingInfo = ratings.find(r => r.value === record.rating);
          return acc + (ratingInfo ? ratingInfo.score : 0);
        }, 0);
        categoryAverages[category.key] = {
          average: (sum / categoryRecords.length).toFixed(1),
          count: categoryRecords.length,
          percentage: Math.round((sum / (categoryRecords.length * 3)) * 100),
          totalScore: sum,
          maxScore: categoryRecords.length * 3
        };
      }
    });

    const allScores = records.map(record => {
      const ratingInfo = ratings.find(r => r.value === record.rating);
      return ratingInfo ? ratingInfo.score : 0;
    });
    const totalScore = allScores.reduce((a, b) => a + b, 0);
    
    // Max possible score = chapters completed × 4 categories × 3 points per category
    const maxPossibleScore = chaptersCompleted * 12;
    
    const overallAverage = allScores.length > 0 ? 
      (totalScore / allScores.length).toFixed(1) : 0;

    const lastEvaluationDate = records.length > 0 ? records[0].created_at : null;

    let recentTrend = 'neutral';
    if (records.length >= 6) {
      const recent = records.slice(0, 3);
      const previous = records.slice(3, 6);
      
      const recentAvg = recent.reduce((acc, r) => {
        const rating = ratings.find(rt => rt.value === r.rating);
        return acc + (rating ? rating.score : 0);
      }, 0) / 3;
      
      const previousAvg = previous.reduce((acc, r) => {
        const rating = ratings.find(rt => rt.value === r.rating);
        return acc + (rating ? rating.score : 0);
      }, 0) / 3;
      
      if (recentAvg > previousAvg + 0.2) recentTrend = 'improving';
      else if (recentAvg < previousAvg - 0.2) recentTrend = 'declining';
    }

    return {
      totalEvaluations,
      categoryAverages,
      overallAverage: parseFloat(overallAverage),
      overallPercentage: Math.round((totalScore / maxPossibleScore) * 100),
      totalScore,
      maxPossibleScore,
      chaptersCompleted,
      completedChaptersList,
      lastEvaluationDate,
      recentTrend
    };
  };

  const getFilteredRecords = () => {
    const currentData = evaluationData[selectedChild];
    if (!currentData || !currentData.records) return [];
    
    if (selectedChapter === 'all') return currentData.records;
    return currentData.records.filter(r => r.chapter_number === parseInt(selectedChapter));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp style={{ width: '16px', height: '16px', color: '#10b981' }} />;
      case 'declining':
        return <TrendingUp style={{ width: '16px', height: '16px', color: '#ef4444', transform: 'rotate(180deg)' }} />;
      default:
        return <BarChart3 style={{ width: '16px', height: '16px', color: '#64748b' }} />;
    }
  };

  const getRatingInfo = (rating) => {
    return ratings.find(r => r.value === rating) || { label: 'Unknown', color: '#64748b', bg: '#f1f5f9' };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          margin: '0 auto 16px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading evaluation data...</p>
      </div>
    );
  }

  const currentChild = linkedChildren.find(c => c.students?.id === selectedChild);
  const currentData = evaluationData[selectedChild];
  const filteredRecords = getFilteredRecords();

  return (
    <div>
      <h2 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <Award style={{ width: '28px', height: '28px', color: '#667eea' }} />
        Lesson Evaluations
      </h2>

      {linkedChildren.length > 1 && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#475569',
            marginBottom: '8px'
          }}>
            Select Child
          </label>
          <select
            value={selectedChild || ''}
            onChange={(e) => setSelectedChild(e.target.value)}
            style={{
              padding: '12px 16px',
              fontSize: '15px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              outline: 'none',
              cursor: 'pointer',
              background: 'white',
              minWidth: '250px'
            }}
          >
            {linkedChildren.map((child) => (
              <option key={child.id} value={child.students?.id}>
                {child.students?.student_name} - {child.students?.classes?.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentData && (
        <>
          {currentData.notInEvalSystem && (
            <div style={{
              background: currentData.systemNotSetup ? '#fef3c7' : '#fff7ed',
              border: `2px solid ${currentData.systemNotSetup ? '#f59e0b' : '#fb923c'}`,
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <Award style={{ width: '24px', height: '24px', color: '#f59e0b', flexShrink: 0 }} />
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#92400e',
                  margin: '0 0 4px 0'
                }}>
                  {currentData.systemNotSetup ? 'Evaluation Roster Not Set Up' : 'Student Not in Evaluation Roster'}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#78350f',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  {currentData.systemNotSetup ? (
                    <>
                      No students have been added to the evaluation roster yet. 
                      An administrator needs to use the <strong>Bulk Student Import</strong> tool to import students into the evaluation system before teachers can record evaluations.
                    </>
                  ) : (
                    <>
                      <strong>{currentChild?.students?.student_name}</strong> has not been added to the evaluation roster yet. 
                      While they are enrolled in the class, they need to be imported into the evaluation system before teachers can record evaluations for them. 
                      Please contact an administrator to add this student to the evaluation roster.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {!currentData.notInEvalSystem && (
            <div style={{ marginBottom: '32px' }}>
              <div 
                onClick={() => setShowAllStats(!showAllStats)}
                style={{
                  padding: '24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  maxWidth: '300px',
                  margin: '0 auto'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <Star style={{ width: '24px', height: '24px' }} />
                  <span style={{
                    fontSize: '48px',
                    fontWeight: '800',
                    lineHeight: 1
                  }}>
                    {currentData.stats.overallPercentage}%
                  </span>
                  {getTrendIcon(currentData.stats.recentTrend)}
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  opacity: 0.9,
                  marginBottom: '4px'
                }}>
                  Overall Performance
                </div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  opacity: 0.85,
                  marginBottom: '4px'
                }}>
                  {currentData.stats.totalScore} / {currentData.stats.maxPossibleScore} points
                </div>
                <div style={{
                  fontSize: '13px',
                  opacity: 0.75,
                  marginBottom: '4px'
                }}>
                  Chapters: {currentData.stats.completedChaptersList.join(', ')}
                </div>
                <div style={{
                  fontSize: '13px',
                  opacity: 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {currentData.stats.totalEvaluations} evaluations
                  <span style={{
                    transform: showAllStats ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}>
                    ▼
                  </span>
                </div>
              </div>

              {showAllStats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '16px',
                  marginTop: '20px',
                  opacity: 0,
                  animation: 'slideInUp 0.3s ease 0.1s forwards'
                }}>
                  {categories.map((category, index) => {
                    const categoryStats = currentData.stats.categoryAverages[category.key];
                    const Icon = category.icon;
                    
                    return (
                      <div key={category.key} style={{
                        padding: '20px',
                        background: categoryStats ? category.bg : '#f8fafc',
                        borderRadius: '12px',
                        border: `2px solid ${categoryStats ? category.color : '#e2e8f0'}`,
                        opacity: 0,
                        animation: `fadeInScale 0.3s ease ${0.2 + index * 0.1}s forwards`
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <Icon style={{ width: '20px', height: '20px', color: category.color }} />
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: categoryStats ? category.color : '#64748b'
                          }}>
                            {category.label}
                          </div>
                        </div>
                        
                        {categoryStats ? (
                          <>
                            <div style={{
                              fontSize: '28px',
                              fontWeight: '800',
                              color: category.color,
                              marginBottom: '2px'
                            }}>
                              {categoryStats.percentage}%
                            </div>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: '600',
                              color: category.color,
                              opacity: 0.9,
                              marginBottom: '4px'
                            }}>
                              {categoryStats.totalScore} / {categoryStats.maxScore} pts
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: category.color,
                              opacity: 0.8
                            }}>
                              {categoryStats.count} evaluation{categoryStats.count !== 1 ? 's' : ''}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{
                              fontSize: '28px',
                              fontWeight: '800',
                              color: '#64748b',
                              marginBottom: '4px'
                            }}>
                              —
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b'
                            }}>
                              No evaluations
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {currentData.stats.lastEvaluationDate && (
                <div style={{
                  marginTop: '16px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '14px'
                }}>
                  Last evaluation: {formatDate(currentData.stats.lastEvaluationDate)}
                </div>
              )}
            </div>
          )}

        </>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes fadeInScale {
            0% { 
              opacity: 0; 
              transform: scale(0.8); 
            }
            100% { 
              opacity: 1; 
              transform: scale(1); 
            }
          }
          @keyframes slideInUp {
            0% { 
              opacity: 0; 
              transform: translateY(20px); 
            }
            100% { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
        `}
      </style>
    </div>
  );
};

export default EvaluationOverview;