import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Heart, BookOpen, Zap, TrendingUp, Users, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import StudentProfilePopup from './StudentProfilePopup';

const EvaluationSummary = ({ summaryData, classInfo, evalStudents, chapters, evaluationsData, selectedChapter }) => {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showTrends, setShowTrends] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const categories = [
    { key: 'D', label: 'Discipline', color: '#3b82f6', bg: '#dbeafe', icon: Award },
    { key: 'B', label: 'Behaviour', color: '#10b981', bg: '#d1fae5', icon: Heart },
    { key: 'HW', label: 'Homework', color: '#f59e0b', bg: '#fef3c7', icon: BookOpen },
    { key: 'AP', label: 'Active Participation', color: '#8b5cf6', bg: '#ede9fe', icon: Zap }
  ];

  const ratings = [
    { value: 'E', label: 'Excellent', color: '#10b981', bg: '#d1fae5' },
    { value: 'G', label: 'Good', color: '#3b82f6', bg: '#dbeafe' },
    { value: 'I', label: 'Improving', color: '#f59e0b', bg: '#fef3c7' }
  ];

  if (!summaryData) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: isMobile ? '32px 20px' : '48px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{ color: '#666', fontSize: isMobile ? '14px' : '16px' }}>No evaluation data available</p>
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  };

  // Calculate chapter trends
  const calculateChapterTrends = () => {
    if (!chapters || chapters.length === 0) return [];
    
    return chapters.map(chapter => {
      const chapterRecords = Object.values(evaluationsData).filter(
        record => record.chapter_number === chapter
      );
      
      const totalRecords = chapterRecords.length;
      const excellent = chapterRecords.filter(r => r.rating === 'E').length;
      const good = chapterRecords.filter(r => r.rating === 'G').length;
      
      // Calculate weighted score (E=100, G=75, I=50)
      const score = totalRecords > 0 
        ? ((excellent * 100 + good * 75 + (totalRecords - excellent - good) * 50) / totalRecords).toFixed(1)
        : 0;
      
      return {
        chapter,
        score: parseFloat(score),
        total: totalRecords,
        excellent,
        good,
        improving: totalRecords - excellent - good
      };
    });
  };

  const chapterTrends = calculateChapterTrends();

  // Calculate category distribution
  const calculateCategoryDistribution = () => {
    return categories.map(category => {
      const categoryRecords = Object.values(evaluationsData).filter(
        record => record.category === category.key && record.chapter_number === selectedChapter
      );
      
      const total = categoryRecords.length;
      const excellent = categoryRecords.filter(r => r.rating === 'E').length;
      const good = categoryRecords.filter(r => r.rating === 'G').length;
      const improving = categoryRecords.filter(r => r.rating === 'I').length;
      
      const score = total > 0 
        ? ((excellent * 100 + good * 75 + improving * 50) / total).toFixed(1)
        : 0;
      
      return {
        ...category,
        excellent,
        good,
        improving,
        total,
        score: parseFloat(score)
      };
    });
  };

  const categoryDistribution = calculateCategoryDistribution();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '16px' : '24px'
    }}>
      {/* Category Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h3 style={{
          fontSize: isMobile ? '16px' : '18px',
          fontWeight: '700',
          color: '#1a1a1a',
          margin: '0 0 20px 0'
        }}>
          Category Performance - Chapter {selectedChapter}
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '12px' : '16px'
        }}>
          {categoryDistribution.map((category) => {
            const Icon = category.icon;
            return (
              <div
                key={category.key}
                style={{
                  padding: isMobile ? '16px' : '20px',
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
                    <Icon style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: category.color }} />
                    <span style={{
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '700',
                      color: '#1a1a1a'
                    }}>
                      {category.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: isMobile ? '18px' : '20px',
                    fontWeight: '700',
                    color: category.color
                  }}>
                    {category.score}%
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '12px'
                }}>
                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: 'white',
                    borderRadius: '6px'
                  }}>
                    <p style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#666',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      E
                    </p>
                    <p style={{
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: '700',
                      color: '#10b981',
                      margin: 0
                    }}>
                      {category.excellent}
                    </p>
                  </div>

                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: 'white',
                    borderRadius: '6px'
                  }}>
                    <p style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#666',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      G
                    </p>
                    <p style={{
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: '700',
                      color: '#3b82f6',
                      margin: 0
                    }}>
                      {category.good}
                    </p>
                  </div>

                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: 'white',
                    borderRadius: '6px'
                  }}>
                    <p style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#666',
                      margin: '0 0 4px 0',
                      fontWeight: '600'
                    }}>
                      I
                    </p>
                    <p style={{
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: '700',
                      color: '#f59e0b',
                      margin: 0
                    }}>
                      {category.improving}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Chapter Trends */}
      {chapterTrends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div
            onClick={() => setShowTrends(!showTrends)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: showTrends ? '20px' : 0
            }}
          >
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Chapter Trends
            </h3>
            {showTrends ? (
              <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
            ) : (
              <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
            )}
          </div>

          {showTrends && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {chapterTrends.map((trend, index) => {
                const maxScore = Math.max(...chapterTrends.map(t => t.score), 100);
                const percentage = (trend.score / maxScore) * 100;
                
                return (
                  <div
                    key={trend.chapter}
                    style={{
                      padding: isMobile ? '12px' : '16px',
                      backgroundColor: trend.chapter === selectedChapter ? '#ede9fe' : '#f9fafb',
                      borderRadius: '8px',
                      border: trend.chapter === selectedChapter ? '2px solid #8b5cf6' : '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <span style={{
                        fontSize: isMobile ? '12px' : '13px',
                        fontWeight: '700',
                        color: '#1a1a1a'
                      }}>
                        Chapter {trend.chapter}
                      </span>
                      <span style={{
                        fontSize: isMobile ? '14px' : '16px',
                        fontWeight: '700',
                        color: getScoreColor(trend.score)
                      }}>
                        {trend.score}%
                      </span>
                    </div>

                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        style={{
                          height: '100%',
                          backgroundColor: getScoreColor(trend.score),
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      marginTop: '8px',
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#666'
                    }}>
                      <span>E: {trend.excellent}</span>
                      <span>G: {trend.good}</span>
                      <span>I: {trend.improving}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Student Performance Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          overflowX: 'auto'
        }}
      >
        <h3 style={{
          fontSize: isMobile ? '16px' : '18px',
          fontWeight: '700',
          color: '#1a1a1a',
          margin: '0 0 20px 0'
        }}>
          Student Performance - Chapter {selectedChapter}
        </h3>

        <div style={{
          overflowX: 'auto'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: isMobile ? '600px' : '100%'
          }}>
            <thead>
              <tr style={{
                borderBottom: '2px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <th style={{
                  padding: isMobile ? '10px 8px' : '12px 16px',
                  textAlign: 'left',
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase'
                }}>
                  Student
                </th>
                {categories.map(cat => (
                  <th
                    key={cat.key}
                    style={{
                      padding: isMobile ? '10px 8px' : '12px 16px',
                      textAlign: 'center',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '700',
                      color: '#374151',
                      textTransform: 'uppercase'
                    }}
                  >
                    {isMobile ? cat.key : cat.label}
                  </th>
                ))}
                <th style={{
                  padding: isMobile ? '10px 8px' : '12px 16px',
                  textAlign: 'center',
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase'
                }}>
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {summaryData.studentStats.map((student, idx) => (
                <motion.tr
                  key={student.studentId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  onClick={() => setSelectedStudent(student)}
                  style={{
                    backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#f9fafb'}
                >
                  <td style={{
                    padding: isMobile ? '10px 8px' : '14px 16px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: '#1a1a1a'
                  }}>
                    {student.studentName}
                  </td>
                  {categories.map(cat => {
                    const rating = student.ratings[cat.key];
                    const config = ratings.find(r => r.value === rating);
                    return (
                      <td
                        key={cat.key}
                        style={{
                          padding: isMobile ? '10px 8px' : '14px 16px',
                          textAlign: 'center'
                        }}
                      >
                        {rating ? (
                          <div style={{
                            display: 'inline-block',
                            width: isMobile ? '24px' : '28px',
                            height: isMobile ? '24px' : '28px',
                            borderRadius: '6px',
                            backgroundColor: config.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: isMobile ? '12px' : '13px',
                            fontWeight: '800',
                            color: 'white'
                          }}>
                            {rating}
                          </div>
                        ) : (
                          <span style={{
                            fontSize: isMobile ? '12px' : '14px',
                            color: '#d1d5db'
                          }}>
                            -
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{
                    padding: isMobile ? '10px 8px' : '14px 16px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: getScoreColor(student.score) + '20',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '700',
                      color: getScoreColor(student.score)
                    }}>
                      {student.score}%
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Performance Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: isMobile ? '12px' : '20px'
        }}
      >
        {/* Top Performers */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '2px solid #10b981'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <Award style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#10b981' }} />
            <h3 style={{
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Top 3 Performers
            </h3>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {summaryData.studentStats.slice(0, 3).map((student, idx) => (
              <div key={student.studentId} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: isMobile ? '10px 12px' : '12px',
                backgroundColor: '#f0fdf4',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedStudent(student)}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: '700',
                    color: idx === 0 ? '#fbbf24' : '#94a3b8'
                  }}>
                    #{idx + 1}
                  </span>
                  <span style={{
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: '#1a1a1a'
                  }}>
                    {student.studentName}
                  </span>
                </div>
                <span style={{
                  fontSize: isMobile ? '14px' : '16px',
                  fontWeight: '700',
                  color: '#10b981'
                }}>
                  {student.score}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Needs Attention */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '2px solid #f59e0b'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <AlertTriangle style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#f59e0b' }} />
            <h3 style={{
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Needs Attention
            </h3>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {summaryData.studentStats
              .filter(s => s.score < 60)
              .slice(0, 3)
              .map((student) => (
                <div key={student.studentId} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: isMobile ? '10px 12px' : '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedStudent(student)}>
                  <span style={{
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: '#1a1a1a'
                  }}>
                    {student.studentName}
                  </span>
                  <span style={{
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: '700',
                    color: '#f59e0b'
                  }}>
                    {student.score}%
                  </span>
                </div>
              ))}
            {summaryData.studentStats.filter(s => s.score < 60).length === 0 && (
              <p style={{
                fontSize: isMobile ? '13px' : '14px',
                color: '#666',
                textAlign: 'center',
                margin: 0,
                padding: '12px'
              }}>
                All students performing well! 🎉
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Student Profile Popup */}
      {selectedStudent && (
        <StudentProfilePopup
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          type="evaluation"
          chapters={chapters}
          evaluationsData={evaluationsData}
        />
      )}
    </div>
  );
};

export default EvaluationSummary;