import { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import { batchSyncEvaluations } from '../../utils/googleSheetsEvaluationAPI';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Save,
  Check,
  Loader,
  Users,
  TrendingUp,
  Award,
  BookOpen,
  Heart,
  Zap,
  FileText,
  X,
  AlertCircle
} from 'lucide-react';

const EvaluationPage = () => {
  const { classId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [classInfo, setClassInfo] = useState(null);
  const [evalStudents, setEvalStudents] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [studentNotes, setStudentNotes] = useState({});
  const [isMobile, setIsMobile] = useState(false);

  const categories = [
    { key: 'D', label: 'Discipline', color: '#3b82f6', icon: Award },
    { key: 'B', label: 'Behaviour', color: '#10b981', icon: Heart },
    { key: 'HW', label: 'Homework', color: '#f59e0b', icon: BookOpen },
    { key: 'AP', label: 'Active Participation', color: '#8b5cf6', icon: Zap }
  ];

  const ratings = [
    { value: 'E', label: 'Excellent', color: '#10b981', bg: '#d1fae5' },
    { value: 'G', label: 'Good', color: '#3b82f6', bg: '#dbeafe' },
    { value: 'I', label: 'Improving', color: '#f59e0b', bg: '#fef3c7' }
  ];

  const chapterOptions = Array.from({ length: 15 }, (_, i) => i + 1);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (classId && user) {
      loadClassAndStudents();
    } else if (!classId && user) {
      navigate('/teacher');
    }
  }, [classId, user, selectedChapter]);

  const loadClassAndStudents = async () => {
    setLoading(true);
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      const { data: evalStudentsData, error: studentsError } = await supabase
        .from('eval_students')
        .select('*')
        .eq('class_id', classId)
        .order('row_number');

      if (studentsError) throw studentsError;
      setEvalStudents(evalStudentsData);

      // Clear evaluations and notes state first to prevent showing old data
      setEvaluations({});
      setStudentNotes({});

      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('lesson_evaluations')
        .select('eval_student_id, category, rating, synced_to_sheets, teacher_notes')
        .eq('class_id', classId)
        .eq('chapter_number', selectedChapter);

      if (evaluationsError && evaluationsError.code !== 'PGRST116') {
        throw evaluationsError;
      }

      const evaluationsMap = {};
      const notesMap = {};
      
      if (evaluationsData && evaluationsData.length > 0) {
        evaluationsData.forEach(record => {
          if (!evaluationsMap[record.eval_student_id]) {
            evaluationsMap[record.eval_student_id] = {};
          }
          evaluationsMap[record.eval_student_id][record.category] = {
            rating: record.rating,
            synced: record.synced_to_sheets
          };
          
          if (record.teacher_notes) {
            notesMap[record.eval_student_id] = record.teacher_notes;
          }
        });
      }
      
      setEvaluations(evaluationsMap);
      setStudentNotes(notesMap);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationChange = (evalStudentId, category, rating) => {
    setEvaluations(prev => {
      const currentRating = prev[evalStudentId]?.[category]?.rating;
      
      // If clicking the same rating, deselect it
      if (currentRating === rating) {
        const newState = { ...prev };
        if (newState[evalStudentId]) {
          delete newState[evalStudentId][category];
          // If no more categories for this student, remove the student entry
          if (Object.keys(newState[evalStudentId]).length === 0) {
            delete newState[evalStudentId];
          }
        }
        return newState;
      }
      
      // Otherwise, set the new rating
      return {
        ...prev,
        [evalStudentId]: {
          ...prev[evalStudentId],
          [category]: { rating, synced: false }
        }
      };
    });
  };

  const handleNotesChange = (evalStudentId, notes) => {
    setStudentNotes(prev => ({
      ...prev,
      [evalStudentId]: notes
    }));
  };

  const handleChapterChange = (e) => {
    setSelectedChapter(parseInt(e.target.value));
    // Don't call loadClassAndStudents here - let useEffect handle it
  };

  const handleSaveClick = () => {
    const totalEvaluated = getTotalEvaluated();
    if (totalEvaluated === 0) {
      toast.error('Please evaluate at least one student in one category');
      return;
    }
    setShowConfirmation(true);
  };

  const saveEvaluations = async () => {
    setShowConfirmation(false);
    setSaving(true);
    try {
      const records = [];
      
      for (const evalStudent of evalStudents) {
        const studentEvals = evaluations[evalStudent.id];
        if (studentEvals) {
          for (const category of categories) {
            const evaluation = studentEvals[category.key];
            if (evaluation?.rating) {
              records.push({
                eval_student_id: evalStudent.id,
                teacher_id: user.id,
                class_id: classId,
                chapter_number: selectedChapter,
                category: category.key,
                rating: evaluation.rating,
                teacher_notes: studentNotes[evalStudent.id] || null,
                synced_to_sheets: false
              });
            }
          }
        }
      }

      if (records.length === 0) {
        toast.error('Please evaluate at least one student in one category');
        setSaving(false);
        return;
      }

      const { data: savedRecords, error: saveError } = await supabase
        .from('lesson_evaluations')
        .upsert(records, {
          onConflict: 'eval_student_id,chapter_number,category',
          returning: 'representation'
        })
        .select();

      if (saveError) throw saveError;

      toast.success('Evaluations saved!');

      try {
        await batchSyncEvaluations(savedRecords);
        toast.success('Synced to Google Sheets!');
        
        const updatedEvaluations = { ...evaluations };
        savedRecords.forEach(record => {
          if (updatedEvaluations[record.eval_student_id]?.[record.category]) {
            updatedEvaluations[record.eval_student_id][record.category].synced = true;
          }
        });
        setEvaluations(updatedEvaluations);
        
      } catch (syncError) {
        console.error('Sync error:', syncError);
        toast.error('Saved locally. Sync failed.');
      }

    } catch (error) {
      console.error('Error saving evaluations:', error);
      toast.error('Failed to save evaluations');
    } finally {
      setSaving(false);
    }
  };

  const getTotalEvaluated = () => {
    let count = 0;
    Object.values(evaluations).forEach(studentEvals => {
      Object.values(studentEvals).forEach(catEval => {
        if (catEval.rating) count++;
      });
    });
    return count;
  };

  const getTotalSynced = () => {
    let count = 0;
    Object.values(evaluations).forEach(studentEvals => {
      Object.values(studentEvals).forEach(catEval => {
        if (catEval.synced) count++;
      });
    });
    return count;
  };

  const getEvaluatedStudentsCount = () => {
    return Object.keys(evaluations).filter(studentId => {
      const studentEvals = evaluations[studentId];
      return Object.values(studentEvals).some(catEval => catEval.rating);
    }).length;
  };

  const stats = {
    total: evalStudents.length,
    evaluated: getTotalEvaluated(),
    synced: getTotalSynced(),
    progress: evalStudents.length > 0 ? Math.round((getTotalEvaluated() / (evalStudents.length * 4)) * 100) : 0
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
          <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Loading Evaluations...</h3>
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
      paddingLeft: isMobile ? '16px' : '60px',
      paddingRight: isMobile ? '16px' : '60px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      boxSizing: 'border-box'
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
        width: '100%',
        margin: '0 auto'
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
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AlertCircle style={{ width: '28px', height: '28px', color: 'white' }} />
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
                  You are about to save and sync evaluations for <strong style={{ color: '#1e293b' }}>Chapter {selectedChapter}</strong>.
                </p>

                <div style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        Students Evaluated
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '800',
                        color: '#3b82f6'
                      }}>
                        {getEvaluatedStudentsCount()}
                      </div>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        Total Evaluations
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '800',
                        color: '#10b981'
                      }}>
                        {stats.evaluated}
                      </div>
                    </div>
                  </div>
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
                    onClick={saveEvaluations}
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
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}
            >
              <ArrowLeft style={{ color: 'white', width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px' }} />
            </motion.button>

            <div style={{ textAlign: 'center', flex: 1, margin: '0 16px' }}>
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
                Lesson Evaluation
              </p>
            </div>

            <div style={{ width: isMobile ? '44px' : '52px' }} />
          </div>

          {/* Chapter Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '8px'
            }}>
              Select Lesson Chapter
            </label>
            <select
              value={selectedChapter}
              onChange={handleChapterChange}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                fontSize: '15px',
                fontWeight: '600',
                color: '#334155',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              {chapterOptions.map(chapter => (
                <option key={chapter} value={chapter}>
                  Chapter {chapter}
                </option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: isMobile ? '8px' : '12px'
          }}>
            {[
              { label: 'Students', value: stats.total, color: '#64748b', icon: Users },
              { label: 'Evaluated', value: stats.evaluated, color: '#3b82f6', icon: TrendingUp },
              { label: 'Progress', value: `${stats.progress}%`, color: '#10b981', icon: Award },
              { label: 'Synced', value: stats.synced, color: '#8b5cf6', icon: Check }
            ].map((stat) => (
              <div key={stat.label} style={{
                background: 'white',
                borderRadius: '12px',
                padding: isMobile ? '10px 8px' : '12px',
                textAlign: 'center',
                border: '2px solid #f1f5f9'
              }}>
                <div style={{
                  fontSize: isMobile ? '20px' : '24px',
                  fontWeight: '800',
                  color: stat.color,
                  marginBottom: '2px'
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: '#94a3b8',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
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
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(450px, 1fr))',
          gap: isMobile ? '12px' : '20px'
        }}>
          <AnimatePresence>
            {evalStudents.map((student, index) => {
              const studentEvals = evaluations[student.id] || {};
              const completedCount = Object.keys(studentEvals).filter(k => studentEvals[k]?.rating).length;
              const allSynced = completedCount > 0 && Object.values(studentEvals).every(e => e?.synced);
              
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
                    padding: isMobile ? '16px' : '18px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    border: '1.5px solid #f1f5f9',
                    height: '100%'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: isMobile ? '14px' : '15px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '2px'
                      }}>
                        {student.student_name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#64748b',
                        fontWeight: '500'
                      }}>
                        {completedCount}/4 Categories
                      </div>
                    </div>

                    {allSynced && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                          background: '#d1fae5',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Check style={{ width: '12px', height: '12px', color: '#10b981' }} />
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>
                          Synced
                        </span>
                      </motion.div>
                    )}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: isMobile ? '6px' : '8px',
                    marginBottom: '10px'
                  }}>
                    {categories.map((category) => {
                      const currentRating = studentEvals[category.key]?.rating;
                      
                      return (
                        <div key={category.key} style={{
                          background: 'white',
                          borderRadius: '10px',
                          padding: '8px',
                          border: `1.5px solid ${currentRating ? category.color : '#e2e8f0'}25`
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '6px'
                          }}>
                            <span style={{
                              fontSize: isMobile ? '10px' : '11px',
                              fontWeight: '700',
                              color: category.color
                            }}>
                              {category.label}
                            </span>
                          </div>
                          
                          <div style={{
                            display: 'flex',
                            gap: '3px'
                          }}>
                            {ratings.map((rating) => {
                              const isSelected = currentRating === rating.value;
                              
                              return (
                                <motion.button
                                  key={rating.value}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleEvaluationChange(student.id, category.key, rating.value)}
                                  style={{
                                    flex: 1,
                                    background: isSelected ? rating.color : 'white',
                                    border: `1.5px solid ${isSelected ? rating.color : '#e2e8f0'}`,
                                    borderRadius: '6px',
                                    padding: isMobile ? '8px 3px' : '6px 3px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1px',
                                    transition: 'all 0.2s ease',
                                    minHeight: isMobile ? '40px' : 'auto'
                                  }}
                                >
                                  <span style={{
                                    fontSize: '13px',
                                    fontWeight: '800',
                                    color: isSelected ? 'white' : rating.color
                                  }}>
                                    {rating.value}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes Field */}
                  <div style={{
                    background: '#fef3c7',
                    border: '1.5px solid #f59e0b25',
                    borderRadius: '10px',
                    padding: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginBottom: '6px'
                    }}>
                      <FileText style={{ width: '14px', height: '14px', color: '#f59e0b' }} />
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#92400e'
                      }}>
                        Teacher Notes
                      </span>
                    </div>
                    <textarea
                      value={studentNotes[student.id] || ''}
                      onChange={(e) => handleNotesChange(student.id, e.target.value)}
                      placeholder="Add notes about this student..."
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '8px',
                        border: '1.5px solid #fde68a',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        color: '#78350f',
                        background: 'white',
                        resize: 'vertical'
                      }}
                    />
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
            disabled={saving || stats.evaluated === 0}
            style={{
              width: '100%',
              background: saving || stats.evaluated === 0
                ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '16px',
              padding: isMobile ? '16px 32px' : '18px 32px',
              fontSize: '17px',
              fontWeight: '800',
              color: 'white',
              cursor: saving || stats.evaluated === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              minHeight: isMobile ? '56px' : 'auto'
            }}
          >
            {saving ? (
              <>
                <Loader style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                Saving...
              </>
            ) : (
              <>
                <Save style={{ width: '20px', height: '20px' }} />
                Save & Sync ({stats.evaluated})
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Rating Legend */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            width: '100%',
            marginTop: '16px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            padding: isMobile ? '12px' : '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
          }}
        >
          <h3 style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Rating Guide
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '8px'
          }}>
            {ratings.map((rating) => (
              <div key={rating.value} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                background: rating.bg,
                borderRadius: '8px',
                border: `1.5px solid ${rating.color}25`
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: rating.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '800',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {rating.value}
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569'
                }}>
                  {rating.label}
                </span>
              </div>
            ))}
          </div>
          <p style={{
            fontSize: '11px',
            color: '#94a3b8',
            marginTop: '10px',
            marginBottom: 0,
            fontWeight: '500'
          }}>
            💡 Tip: Click the same rating again to deselect
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default EvaluationPage;