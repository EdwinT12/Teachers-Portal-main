import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Award, AlertTriangle, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Church, AlertCircle as ExcusedIcon } from 'lucide-react';
import StudentProfilePopup from './StudentProfilePopup';

const AttendanceSummary = ({ summaryData, classInfo, students, weeks, attendanceData }) => {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showTrends, setShowTrends] = useState(true);

  if (!summaryData) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '48px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{ color: '#666', fontSize: '16px' }}>No attendance data available</p>
      </div>
    );
  }

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return '#10b981';
    if (percentage >= 75) return '#f59e0b';
    return '#ef4444';
  };

  const getAttendanceLabel = (percentage) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 75) return 'Good';
    if (percentage >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  // Calculate weekly trends
  const calculateWeeklyTrends = () => {
    if (!weeks || weeks.length === 0) return [];
    
    return weeks.map(week => {
      const weekRecords = Object.values(attendanceData).filter(
        record => record.attendance_date === week.date
      );
      
      const totalRecords = weekRecords.length;
      const presentAndLate = weekRecords.filter(r => r.status === 'P' || r.status === 'L').length;
      const percentage = totalRecords > 0 ? ((presentAndLate / totalRecords) * 100).toFixed(1) : 0;
      
      return {
        week: week.label,
        percentage: parseFloat(percentage),
        total: totalRecords,
        present: weekRecords.filter(r => r.status === 'P').length,
        late: weekRecords.filter(r => r.status === 'L').length,
        absent: weekRecords.filter(r => r.status === 'U').length,
        unattendedMass: weekRecords.filter(r => r.status === 'UM').length,
        excused: weekRecords.filter(r => r.status === 'E').length
      };
    });
  };

  const weeklyTrends = calculateWeeklyTrends();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Overall Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px'
      }}>
        {/* Overall Attendance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '2px solid #10b981'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#d1fae5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp style={{ width: '24px', height: '24px', color: '#10b981' }} />
            </div>
            <div>
              <p style={{
                fontSize: '13px',
                color: '#666',
                margin: '0 0 4px 0',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Overall Attendance
              </p>
              <p style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: 0,
                lineHeight: 1
              }}>
                {summaryData.overallAttendance}%
              </p>
            </div>
          </div>
          <div style={{
            padding: '8px 12px',
            backgroundColor: getAttendanceColor(parseFloat(summaryData.overallAttendance)) + '20',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: getAttendanceColor(parseFloat(summaryData.overallAttendance)),
            textAlign: 'center'
          }}>
            {getAttendanceLabel(parseFloat(summaryData.overallAttendance))}
          </div>
        </motion.div>

        {/* Total Students Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users style={{ width: '24px', height: '24px', color: '#3b82f6' }} />
            </div>
            <div>
              <p style={{
                fontSize: '13px',
                color: '#666',
                margin: '0 0 4px 0',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Total Students
              </p>
              <p style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: 0,
                lineHeight: 1
              }}>
                {summaryData.totalStudents}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Total Weeks Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Award style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
            </div>
            <div>
              <p style={{
                fontSize: '13px',
                color: '#666',
                margin: '0 0 4px 0',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Weeks Tracked
              </p>
              <p style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: 0,
                lineHeight: 1
              }}>
                {summaryData.totalWeeks}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Attendance Trends Chart */}
      {weeklyTrends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Weekly Attendance Trends
            </h2>
            <button
              onClick={() => setShowTrends(!showTrends)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                color: '#666'
              }}
            >
              {showTrends ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showTrends ? 'Hide' : 'Show'}
            </button>
          </div>

          {showTrends && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              height: '280px',
              padding: '20px 10px 40px',
              borderRadius: '8px',
              backgroundColor: '#f9fafb',
              position: 'relative'
            }}>
              {weeklyTrends.map((week, idx) => {
                // Calculate bar height as percentage of available space
                // Use percentage directly without capping at 100
                const barHeight = week.percentage > 0 ? week.percentage : 0;
                const color = getAttendanceColor(week.percentage);
                
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      minWidth: '40px',
                      height: '100%'
                    }}
                  >
                    {/* Percentage Label */}
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: color,
                      marginBottom: 'auto'
                    }}>
                      {week.percentage}%
                    </span>
                    
                    {/* Bar Container - fixed height for proper scaling */}
                    <div style={{
                      width: '100%',
                      height: '200px',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center'
                    }}>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${barHeight}%` }}
                        transition={{ delay: 0.4 + idx * 0.05, duration: 0.5 }}
                        style={{
                          width: '100%',
                          backgroundColor: color,
                          borderRadius: '4px 4px 0 0',
                          position: 'relative',
                          cursor: 'pointer',
                          // Ensure bars are visible even at low percentages
                          minHeight: week.percentage > 0 ? '8px' : '0'
                        }}
                        title={`${week.week}: ${week.present}P, ${week.late}L, ${week.absent}U, ${week.unattendedMass}UM, ${week.excused}E`}
                      />
                    </div>
                    
                    {/* Week Label */}
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: '#666',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {week.week}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Student Statistics Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1a1a1a',
          marginBottom: '20px',
          margin: 0
        }}>
          Student Attendance Records
        </h2>

        <div style={{
          overflowX: 'auto',
          marginTop: '16px'
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
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Student Name
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Sessions
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#10b981',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Present
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#f59e0b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Late
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#ef4444',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Absent
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Rate
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
                    padding: '14px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1a1a1a'
                  }}>
                    {student.studentName}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    {student.totalSessions}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#10b981'
                  }}>
                    {student.present}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#f59e0b'
                  }}>
                    {student.late}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#ef4444'
                  }}>
                    {student.absent}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: getAttendanceColor(parseFloat(student.attendancePercentage)) + '20',
                      fontSize: '14px',
                      fontWeight: '700',
                      color: getAttendanceColor(parseFloat(student.attendancePercentage))
                    }}>
                      {student.attendancePercentage}%
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
        transition={{ delay: 0.5 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}
      >
        {/* Best Performers */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '2px solid #10b981'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <Award style={{ width: '24px', height: '24px', color: '#10b981' }} />
            <h3 style={{
              fontSize: '16px',
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
                padding: '12px',
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
                    fontSize: '16px',
                    fontWeight: '700',
                    color: idx === 0 ? '#fbbf24' : '#94a3b8'
                  }}>
                    #{idx + 1}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1a1a1a'
                  }}>
                    {student.studentName}
                  </span>
                </div>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#10b981'
                }}>
                  {student.attendancePercentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Needs Attention */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '2px solid #f59e0b'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <AlertTriangle style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
            <h3 style={{
              fontSize: '16px',
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
              .filter(s => parseFloat(s.attendancePercentage) < 75)
              .slice(0, 3)
              .map((student) => (
                <div key={student.studentId} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedStudent(student)}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1a1a1a'
                  }}>
                    {student.studentName}
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#f59e0b'
                  }}>
                    {student.attendancePercentage}%
                  </span>
                </div>
              ))}
            {summaryData.studentStats.filter(s => parseFloat(s.attendancePercentage) < 75).length === 0 && (
              <p style={{
                fontSize: '14px',
                color: '#666',
                textAlign: 'center',
                margin: 0,
                padding: '12px'
              }}>
                No students need attention! 🎉
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Student Profile Popup */}
      {selectedStudent && (
        <StudentProfilePopup
          student={selectedStudent}
          weeks={weeks}
          attendanceData={attendanceData}
          onClose={() => setSelectedStudent(null)}
          type="attendance"
        />
      )}
    </div>
  );
};

export default AttendanceSummary;