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
  Calendar,
  Users,
  TrendingUp,
  Award,
  BookOpen,
  Heart,
  Zap,
  Star
} from 'lucide-react';

const EvaluationPage = () => {
  const { classId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classInfo, setClassInfo] = useState(null);
  const [evalStudents, setEvalStudents] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [selectedDate, setSelectedDate] = useState('2025-09-07');
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
  }, [classId, user, selectedDate]);

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

      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('lesson_evaluations')
        .select('eval_student_id, category, rating, synced_to_sheets')
        .eq('class_id', classId)
        .eq('evaluation_date', selectedDate);

      if (evaluationsError && evaluationsError.code !== 'PGRST116') {
        throw evaluationsError;
      }

      const evaluationsMap = {};
      if (evaluationsData) {
        evaluationsData.forEach(record => {
          if (!evaluationsMap[record.eval_student_id]) {
            evaluationsMap[record.eval_student_id] = {};
          }
          evaluationsMap[record.eval_student_id][record.category] = {
            rating: record.rating,
            synced: record.synced_to_sheets
          };
        });
      }
      setEvaluations(evaluationsMap);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationChange = (evalStudentId, category, rating) => {
    setEvaluations(prev => ({
      ...prev,
      [evalStudentId]: {
        ...prev[evalStudentId],
        [category]: { rating, synced: false }
      }
    }));
  };

  const saveEvaluations = async () => {
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
                evaluation_date: selectedDate,
                category: category.key,
                rating: evaluation.rating,
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
          onConflict: 'eval_student_id,evaluation_date,category',
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
      padding: isMobile ? '16px 12px 40px' : '40px 32px 60px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      overflowX: 'hidden',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          maxWidth: isMobile ? '100%' : '1400px',
          width: '100%',
          margin: '0 auto 24px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: isMobile ? '20px' : '28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/teacher')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
          >
            <ArrowLeft style={{ color: 'white', width: '20px', height: '20px' }} />
          </motion.button>

          <div style={{ textAlign: 'center', flex: 1, margin: '0 16px' }}>
            <h1 style={{
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: '800',
              color: '#1e293b',
              margin: '0 0 4px 0',
              lineHeight: 1.2
            }}>
              {classInfo?.name}
            </h1>
            <p style={{
              fontSize: '13px',
              color: '#64748b',
              margin: 0,
              fontWeight: '500'
            }}>
              Lesson Evaluation
            </p>
          </div>

          <div style={{ width: '44px' }} />
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max="2026-06-30"
          min="2025-09-01"
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
        />

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: isMobile ? '8px' : '12px',
          marginTop: '16px'
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
        maxWidth: '1200px',
        margin: '0 auto'
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
                  padding: isMobile ? '12px' : '14px',
                  marginBottom: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  border: '1.5px solid #f1f5f9'
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
                  gap: isMobile ? '6px' : '8px'
                }}>
                  {categories.map((category) => {
                    const currentRating = studentEvals[category.key]?.rating;
                    const Icon = category.icon;
                    
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
                                  padding: '6px 3px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '1px',
                                  transition: 'all 0.2s ease'
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
          maxWidth: '1200px',
          margin: '24px auto 0',
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={saveEvaluations}
          disabled={saving || stats.evaluated === 0}
          style={{
            width: '100%',
            maxWidth: '400px',
            background: saving || stats.evaluated === 0
              ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: '16px',
            padding: '18px 32px',
            fontSize: '17px',
            fontWeight: '800',
            color: 'white',
            cursor: saving || stats.evaluated === 0 ? 'not-allowed' : 'pointer',
            boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
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
          maxWidth: '1200px',
          margin: '16px auto 0',
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
      </motion.div>
    </div>
  );
};

export default EvaluationPage;
