import { motion, AnimatePresence } from 'framer-motion';
import { X, User, TrendingUp, CheckCircle2, Clock, XCircle, AlertCircle, Calendar } from 'lucide-react';

const StudentProfilePopup = ({ student, weeks, attendanceData, onClose }) => {
  if (!student) return null;

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return '#10b981';
    if (percentage >= 75) return '#f59e0b';
    return '#ef4444';
  };

  const getAttendanceLabel = (percentage) => {
    if (percentage >= 90) return 'Excellent Attendance';
    if (percentage >= 75) return 'Good Attendance';
    if (percentage >= 60) return 'Fair Attendance';
    return 'Poor Attendance';
  };

  const getStatusConfig = (status) => {
    const configs = {
      'P': { color: '#10b981', bg: '#d1fae5', icon: CheckCircle2, label: 'P' },
      'L': { color: '#f59e0b', bg: '#fef3c7', icon: Clock, label: 'L' },
      'A': { color: '#ef4444', bg: '#fee2e2', icon: XCircle, label: 'A' },
      'U': { color: '#6b7280', bg: '#f3f4f6', icon: AlertCircle, label: 'U' },
      '': { color: '#d1d5db', bg: '#ffffff', icon: null, label: '-' }
    };
    return configs[status] || configs[''];
  };

  // Get student's attendance for each week
  const getStudentAttendanceForWeek = (weekDate) => {
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
            maxWidth: '700px',
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
              transition: 'background-color 0.2s'
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
            marginBottom: '32px',
            paddingBottom: '24px',
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
            <div>
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
              {/* Total Sessions */}
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

              {/* Present */}
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
                    color: '#10b981',
                    margin: 0,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
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

              {/* Late */}
              <div style={{
                padding: '16px',
                backgroundColor: '#fefce8',
                borderRadius: '12px',
                border: '1px solid #fef3c7'
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
                    color: '#f59e0b',
                    margin: 0,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
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

              {/* Absent */}
              <div style={{
                padding: '16px',
                backgroundColor: '#fef2f2',
                borderRadius: '12px',
                border: '1px solid #fee2e2'
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
                    color: '#ef4444',
                    margin: 0,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
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
            </div>
          </div>

          {/* Attendance History Grid */}
          {weeks && weeks.length > 0 && (
            <div style={{
              marginBottom: '24px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: '0 0 16px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Calendar style={{ width: '18px', height: '18px', color: '#3b82f6' }} />
                Attendance History
              </h3>

              <div style={{
                overflowX: 'auto',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#f9fafb',
                      borderBottom: '2px solid #e5e7eb'
                    }}>
                      {weeks.map((week, idx) => (
                        <th key={idx} style={{
                          padding: '12px 8px',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#666',
                          textAlign: 'center',
                          minWidth: '60px',
                          whiteSpace: 'nowrap'
                        }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            alignItems: 'center'
                          }}>
                            <span>{week.label}</span>
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>W{idx + 1}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {weeks.map((week, idx) => {
                        const status = getStudentAttendanceForWeek(week.date);
                        const config = getStatusConfig(status);
                        const Icon = config.icon;

                        return (
                          <td key={idx} style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            backgroundColor: status ? config.bg : 'white',
                            borderBottom: '1px solid #e5e7eb',
                            borderRight: idx < weeks.length - 1 ? '1px solid #e5e7eb' : 'none'
                          }}>
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {Icon && (
                                <Icon style={{
                                  width: '16px',
                                  height: '16px',
                                  color: config.color
                                }} />
                              )}
                              <span style={{
                                fontSize: '13px',
                                fontWeight: '700',
                                color: status ? config.color : '#d1d5db'
                              }}>
                                {config.label}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                {['P', 'L', 'A', 'U'].map((status) => {
                  const config = getStatusConfig(status);
                  const Icon = config.icon;
                  return (
                    <div key={status} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: config.color
                    }}>
                      {Icon && <Icon style={{ width: '14px', height: '14px' }} />}
                      <span style={{ fontWeight: '600' }}>
                        {status === 'P' && 'Present'}
                        {status === 'L' && 'Late'}
                        {status === 'A' && 'Absent'}
                        {status === 'U' && 'Unexcused'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insights */}
          <div style={{
            padding: '16px',
            backgroundColor: '#f0f9ff',
            borderRadius: '12px',
            border: '1px solid #bfdbfe'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#1e40af',
              margin: '0 0 8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle style={{ width: '16px', height: '16px' }} />
              Quick Insights
            </h3>
            <ul style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '13px',
              color: '#1e40af',
              lineHeight: '1.8'
            }}>
              {student.totalSessions === 0 && (
                <li>No attendance records yet for this student.</li>
              )}
              {student.totalSessions > 0 && parseFloat(student.attendancePercentage) >= 90 && (
                <>
                  <li>Excellent attendance record!</li>
                  <li>Student is present {student.present} out of {student.totalSessions} sessions.</li>
                </>
              )}
              {student.totalSessions > 0 && parseFloat(student.attendancePercentage) >= 75 && parseFloat(student.attendancePercentage) < 90 && (
                <>
                  <li>Good attendance overall.</li>
                  <li>Consider addressing {student.absent} absences.</li>
                </>
              )}
              {student.totalSessions > 0 && parseFloat(student.attendancePercentage) < 75 && (
                <>
                  <li>Attendance needs improvement.</li>
                  <li>Total absences: {student.absent} sessions.</li>
                  <li>Consider follow-up with student/guardian.</li>
                </>
              )}
              {student.late > 0 && (
                <li>Student has been late {student.late} time{student.late > 1 ? 's' : ''}.</li>
              )}
            </ul>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: '24px',
              padding: '14px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StudentProfilePopup;