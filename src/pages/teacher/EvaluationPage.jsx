import { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import { batchSyncEvaluations } from '../../utils/googleSheetsEvaluationAPI';
import toast from 'react-hot-toast';

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

  const categories = [
    { key: 'D', label: 'Discipline', color: '#2196F3' },
    { key: 'B', label: 'Behaviour', color: '#4CAF50' },
    { key: 'HW', label: 'Homework', color: '#FF9800' },
    { key: 'AP', label: 'Active Participation', color: '#9C27B0' }
  ];

  const ratings = [
    { value: 'E', label: 'Excellent', color: '#4CAF50' },
    { value: 'G', label: 'Good', color: '#2196F3' },
    { value: 'I', label: 'Improving', color: '#FF9800' }
  ];

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
      // Load class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      // Load eval_students (NOT regular students)
      const { data: evalStudentsData, error: studentsError } = await supabase
        .from('eval_students')
        .select('*')
        .eq('class_id', classId)
        .order('row_number');

      if (studentsError) throw studentsError;
      setEvalStudents(evalStudentsData);

      // Load existing evaluations for selected date
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('lesson_evaluations')
        .select('eval_student_id, category, rating, synced_to_sheets')
        .eq('class_id', classId)
        .eq('evaluation_date', selectedDate);

      if (evaluationsError && evaluationsError.code !== 'PGRST116') {
        throw evaluationsError;
      }

      // Convert to nested map: { evalStudentId: { category: { rating, synced } } }
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
      
      // Prepare evaluation records
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

      console.log('Saving records:', records);

      // Save to Supabase (upsert to handle updates)
      const { data: savedRecords, error: saveError } = await supabase
        .from('lesson_evaluations')
        .upsert(records, {
          onConflict: 'eval_student_id,evaluation_date,category',
          returning: 'representation'
        })
        .select();

      if (saveError) {
        console.error('Supabase save error:', saveError);
        throw saveError;
      }

      toast.success('Evaluations saved to database');

      // Sync to Google Sheets
      try {
        await batchSyncEvaluations(savedRecords);
        toast.success('Successfully synced to Google Sheets!');
        
        // Update local state to show synced status
        const updatedEvaluations = { ...evaluations };
        savedRecords.forEach(record => {
          if (updatedEvaluations[record.eval_student_id]?.[record.category]) {
            updatedEvaluations[record.eval_student_id][record.category].synced = true;
          }
        });
        setEvaluations(updatedEvaluations);
        
      } catch (syncError) {
        console.error('Sync error:', syncError);
        toast.error('Saved locally but failed to sync to Google Sheets. Will retry later.');
      }

    } catch (error) {
      console.error('Error saving evaluations:', error);
      toast.error('Failed to save evaluations');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #4CAF50',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
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

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '28px',
              color: '#333'
            }}>
              {classInfo?.name} - Lesson Evaluation
            </h1>
            <p style={{
              margin: 0,
              color: '#666',
              fontSize: '14px'
            }}>
              Evaluate students on Discipline, Behaviour, Homework & Active Participation
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max="2026-06-30"
              min="2025-09-01"
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                border: '2px solid #ddd',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            />
            
            <button
              onClick={() => navigate('/teacher')}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Evaluation Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            color: '#333'
          }}>
            Student Evaluation - {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: '1000px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#333',
                  fontSize: '14px',
                  borderBottom: '2px solid #dee2e6',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#f8f9fa',
                  zIndex: 10
                }}>
                  #
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#333',
                  fontSize: '14px',
                  borderBottom: '2px solid #dee2e6',
                  position: 'sticky',
                  left: '60px',
                  backgroundColor: '#f8f9fa',
                  zIndex: 10,
                  minWidth: '180px'
                }}>
                  Student Name
                </th>
                {categories.map(cat => (
                  <th key={cat.key} style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#333',
                    fontSize: '14px',
                    borderBottom: '2px solid #dee2e6',
                    backgroundColor: `${cat.color}15`
                  }}>
                    <div style={{ marginBottom: '4px' }}>{cat.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#666' }}>({cat.key})</div>
                  </th>
                ))}
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#333',
                  fontSize: '14px',
                  borderBottom: '2px solid #dee2e6'
                }}>
                  Synced
                </th>
              </tr>
            </thead>
            <tbody>
              {evalStudents.map((student, index) => (
                <tr
                  key={student.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                  }}
                >
                  <td style={{
                    padding: '16px',
                    borderBottom: '1px solid #dee2e6',
                    fontSize: '14px',
                    color: '#666',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa',
                    zIndex: 5
                  }}>
                    {index + 1}
                  </td>
                  <td style={{
                    padding: '16px',
                    borderBottom: '1px solid #dee2e6',
                    fontSize: '14px',
                    color: '#333',
                    fontWeight: '500',
                    position: 'sticky',
                    left: '60px',
                    backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa',
                    zIndex: 5
                  }}>
                    {student.student_name}
                  </td>
                  {categories.map(category => (
                    <td key={category.key} style={{
                      padding: '8px',
                      borderBottom: '1px solid #dee2e6',
                      textAlign: 'center',
                      backgroundColor: `${category.color}05`
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        justifyContent: 'center'
                      }}>
                        {ratings.map(rating => (
                          <button
                            key={rating.value}
                            onClick={() => handleEvaluationChange(student.id, category.key, rating.value)}
                            style={{
                              padding: '6px 12px',
                              border: '2px solid',
                              borderColor: evaluations[student.id]?.[category.key]?.rating === rating.value ? 
                                rating.color : '#ddd',
                              backgroundColor: evaluations[student.id]?.[category.key]?.rating === rating.value ? 
                                rating.color : 'white',
                              color: evaluations[student.id]?.[category.key]?.rating === rating.value ? 
                                'white' : '#666',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              transition: 'all 0.2s'
                            }}
                            title={rating.label}
                          >
                            {rating.value}
                          </button>
                        ))}
                      </div>
                    </td>
                  ))}
                  <td style={{
                    padding: '16px',
                    borderBottom: '1px solid #dee2e6',
                    textAlign: 'center'
                  }}>
                    {(() => {
                      const studentEvals = evaluations[student.id];
                      if (!studentEvals) return <span style={{ color: '#ccc' }}>-</span>;
                      
                      const total = Object.keys(studentEvals).length;
                      const synced = Object.values(studentEvals).filter(e => e.synced).length;
                      
                      if (synced === total && total > 0) {
                        return <span style={{ color: '#4CAF50', fontSize: '20px' }}>✓</span>;
                      } else if (total > 0) {
                        return <span style={{ color: '#ff9800', fontSize: '14px' }}>⏳ {synced}/{total}</span>;
                      }
                      return <span style={{ color: '#ccc' }}>-</span>;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Save Button */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Total Students: {evalStudents.length} | 
            Evaluations: {getTotalEvaluated()} | 
            Synced: {getTotalSynced()}
          </div>
          
          <button
            onClick={saveEvaluations}
            disabled={saving || getTotalEvaluated() === 0}
            style={{
              padding: '12px 32px',
              backgroundColor: saving ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving || getTotalEvaluated() === 0 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
          >
            {saving ? 'Saving & Syncing...' : 'Save & Sync to Google Sheets'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '20px',
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '16px',
          color: '#333'
        }}>
          Rating Legend:
        </h3>
        <div style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          fontSize: '14px'
        }}>
          {ratings.map(rating => (
            <div key={rating.value}>
              <span style={{ color: rating.color, fontWeight: 'bold' }}>{rating.value}</span> = {rating.label}
            </div>
          ))}
        </div>
        <h3 style={{
          margin: '16px 0 12px 0',
          fontSize: '16px',
          color: '#333'
        }}>
          Categories:
        </h3>
        <div style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          fontSize: '14px'
        }}>
          {categories.map(cat => (
            <div key={cat.key}>
              <span style={{ color: cat.color, fontWeight: 'bold' }}>{cat.key}</span> = {cat.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EvaluationPage;