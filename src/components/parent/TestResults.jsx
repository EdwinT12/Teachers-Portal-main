import { useEffect, useState } from 'react';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { Award, TrendingUp, FileText, BarChart3 } from 'lucide-react';

const TestResults = ({ linkedChildren }) => {
  const [loading, setLoading] = useState(true);
  const [resultsData, setResultsData] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);

  useEffect(() => {
    if (linkedChildren && linkedChildren.length > 0) {
      setSelectedChild(linkedChildren[0].students?.id);
      loadTestResults();
    }
  }, [linkedChildren]);

  const loadTestResults = async () => {
    if (!linkedChildren || linkedChildren.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = {};

      for (const child of linkedChildren) {
        if (!child.students?.id) continue;

        const { data: evaluations, error } = await supabase
          .from('lesson_evaluations')
          .select('*')
          .eq('student_id', child.students.id)
          .order('evaluation_date', { ascending: false });

        if (error) throw error;

        // Group by evaluation type (midterm, final)
        const midterm = evaluations.filter(e => e.evaluation_type === 'midterm');
        const final = evaluations.filter(e => e.evaluation_type === 'final');

        data[child.students.id] = {
          all: evaluations,
          midterm,
          final,
          stats: calculateStats(evaluations)
        };
      }

      setResultsData(data);
    } catch (error) {
      console.error('Error loading test results:', error);
      toast.error('Error loading test results');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (evaluations) => {
    if (!evaluations || evaluations.length === 0) {
      return {
        averageScore: 0,
        totalTests: 0,
        highestScore: 0,
        lowestScore: 0
      };
    }

    const scores = evaluations
      .filter(e => e.score_achieved !== null && e.total_score !== null && e.total_score > 0)
      .map(e => (e.score_achieved / e.total_score) * 100);

    if (scores.length === 0) {
      return {
        averageScore: 0,
        totalTests: evaluations.length,
        highestScore: 0,
        lowestScore: 0
      };
    }

    return {
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      totalTests: evaluations.length,
      highestScore: Math.round(Math.max(...scores)),
      lowestScore: Math.round(Math.min(...scores))
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 90) return '#10b981';
    if (percentage >= 75) return '#3b82f6';
    if (percentage >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getGrade = (percentage) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
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
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading test results...</p>
      </div>
    );
  }

  const currentChild = linkedChildren.find(c => c.students?.id === selectedChild);
  const currentData = resultsData[selectedChild];

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
        Test Results
      </h2>

      {/* Child Selector (if multiple children) */}
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
          {/* Stats Overview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <TrendingUp style={{ width: '20px', height: '20px' }} />
                <span style={{ fontSize: '13px', fontWeight: '600', opacity: 0.9 }}>Average Score</span>
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: '800'
              }}>
                {currentData.stats.averageScore}%
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: '#f0fdf4',
              borderRadius: '12px',
              border: '2px solid #86efac'
            }}>
              <div style={{ fontSize: '13px', color: '#15803d', fontWeight: '600', marginBottom: '8px' }}>
                Highest Score
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: '800',
                color: '#16a34a'
              }}>
                {currentData.stats.highestScore}%
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: '#fef3c7',
              borderRadius: '12px',
              border: '2px solid #fcd34d'
            }}>
              <div style={{ fontSize: '13px', color: '#b45309', fontWeight: '600', marginBottom: '8px' }}>
                Lowest Score
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: '800',
                color: '#d97706'
              }}>
                {currentData.stats.lowestScore}%
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: '#dbeafe',
              borderRadius: '12px',
              border: '2px solid #93c5fd'
            }}>
              <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: '600', marginBottom: '8px' }}>
                Total Tests
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: '800',
                color: '#2563eb'
              }}>
                {currentData.stats.totalTests}
              </div>
            </div>
          </div>

          {/* Test Results Tabs */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '2px solid #e2e8f0',
              paddingBottom: '8px'
            }}>
              <div style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '8px 8px 0 0',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                All Tests ({currentData.all.length})
              </div>
            </div>
          </div>

          {/* Results List */}
          {currentData.all.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#64748b',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '2px dashed #cbd5e1'
            }}>
              <FileText style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '14px' }}>No test results yet</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {currentData.all.map((evaluation) => {
                const percentage = evaluation.total_score > 0 
                  ? Math.round((evaluation.score_achieved / evaluation.total_score) * 100)
                  : 0;
                const scoreColor = getScoreColor(percentage);
                const grade = getGrade(percentage);

                return (
                  <div key={evaluation.id} style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '2px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          padding: '6px 12px',
                          background: evaluation.evaluation_type === 'midterm' ? '#dbeafe' : '#fef3c7',
                          color: evaluation.evaluation_type === 'midterm' ? '#1e40af' : '#b45309',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>
                          {evaluation.evaluation_type}
                        </div>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          margin: 0
                        }}>
                          {evaluation.lesson_title || 'Test'}
                        </h4>
                      </div>
                      <div style={{
                        display: 'grid',
                        gap: '6px',
                        fontSize: '14px',
                        color: '#64748b'
                      }}>
                        <div>
                          <span style={{ fontWeight: '600' }}>Date:</span> {formatDate(evaluation.evaluation_date)}
                        </div>
                        <div>
                          <span style={{ fontWeight: '600' }}>Score:</span> {evaluation.score_achieved}/{evaluation.total_score} points
                        </div>
                        {evaluation.teacher_notes && (
                          <div style={{
                            marginTop: '8px',
                            padding: '12px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            borderLeft: '3px solid #667eea'
                          }}>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>Teacher's Notes:</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
                              {evaluation.teacher_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{
                      marginLeft: '24px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: scoreColor,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: '800',
                          lineHeight: 1
                        }}>
                          {percentage}%
                        </div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          marginTop: '2px'
                        }}>
                          Grade {grade}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
        `}
      </style>
    </div>
  );
};

export default TestResults;