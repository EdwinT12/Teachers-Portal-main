import { motion, AnimatePresence } from 'framer-motion';
import { X, User, TrendingUp, CheckCircle2, Clock, XCircle, AlertCircle, Calendar, Award, Heart, BookOpen, Zap, Church } from 'lucide-react';
import { useState } from 'react';

const StudentProfilePopup = ({ student, weeks, attendanceData, onClose, type = 'attendance', chapters, evaluationsData, selectedChapter = 1 }) => { 
  const [activeTab, setActiveTab] = useState(type);
  
  if (!student) return null;

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

  // Compute evaluation ratings from evaluationsData if not in student object
  const computeEvaluationRatings = () => {
    if (student.ratings) {
      return student.ratings;
    }
    
    if (!evaluationsData) return {};
    
    const ratings = {};
    const studentId = student.id || student.studentId;
    const chapter = selectedChapter || 1;
    
    categories.forEach(category => {
      const key = `${studentId}-${chapter}-${category.key}`;
      const record = evaluationsData[key];
      if (record) {
        ratings[category.key] = record.rating;
      }
    });
    
    return ratings;
  };

  // Compute evaluation score
  const computeEvaluationScore = () => {
    if (student.score !== undefined) {
      return student.score;
    }
    
    const ratings = computeEvaluationRatings();
    const ratingValues = { 'E': 100, 'G': 75, 'I': 50 };
    const values = Object.values(ratings).map(r => ratingValues[r] || 0);
    
    if (values.length === 0) return 0;
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / values.length);
  };

  const studentRatings = computeEvaluationRatings();
  const studentScore = computeEvaluationScore();

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

  return (
    <AnimatePresence>
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
                Student Profile
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            backgroundColor: '#f9fafb',
            padding: '4px',
            borderRadius: '12px'
          }}>
            <button
              onClick={() => setActiveTab('attendance')}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: activeTab === 'attendance' ? '#10b981' : 'transparent',
                color: activeTab === 'attendance' ? 'white' : '#666',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Calendar style={{ width: '16px', height: '16px' }} />
              Attendance
            </button>
            <button
              onClick={() => setActiveTab('evaluation')}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: activeTab === 'evaluation' ? '#8b5cf6' : 'transparent',
                color: activeTab === 'evaluation' ? 'white' : '#666',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Award style={{ width: '16px', height: '16px' }} />
              Evaluations
            </button>
          </div>

          {/* Attendance Tab Content */}
          {activeTab === 'attendance' && attendanceData && (
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
                <div>
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
            </div>
          )}

          {/* Evaluation Tab Content */}
          {activeTab === 'evaluation' && (
            <div>
              {/* Overall Score */}
              <div style={{
                padding: '20px',
                backgroundColor: getScoreColor(studentScore) + '10',
                borderRadius: '12px',
                marginBottom: '24px',
                border: `2px solid ${getScoreColor(studentScore) + '30'}`
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
                      color: getScoreColor(studentScore)
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
                    color: getScoreColor(studentScore)
                  }}>
                    {studentScore}%
                  </span>
                </div>
                <p style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: getScoreColor(studentScore),
                  margin: 0,
                  textAlign: 'center'
                }}>
                  {getScoreLabel(studentScore)}
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
                    const rating = studentRatings[category.key];
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

              {/* Notes */}
              {student.notes && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '12px',
                  border: '1px solid #fde68a'
                }}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#92400e',
                    margin: '0 0 8px 0'
                  }}>
                    Teacher Notes
                  </h4>
                  <p style={{
                    fontSize: '13px',
                    color: '#78350f',
                    margin: 0,
                    lineHeight: 1.6
                  }}>
                    {student.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StudentProfilePopup;