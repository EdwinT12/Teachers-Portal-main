import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
  Users,
  Calendar,
  PieChart,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Church,
  AlertCircle as ExcusedIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const ClassAnalytics = ({ summaryData, classInfo, students, weeks, attendanceData }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    trends: true,
    distribution: true,
    atRisk: true,
    performance: true
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!summaryData || !weeks || weeks.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: isMobile ? '32px 20px' : '48px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <Activity style={{ 
          width: '48px', 
          height: '48px', 
          color: '#9ca3af',
          margin: '0 auto 16px'
        }} />
        <p style={{ 
          color: '#666', 
          fontSize: isMobile ? '14px' : '16px',
          margin: 0
        }}>
          No analytics data available. Start tracking attendance to see insights.
        </p>
      </div>
    );
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Calculate weekly trends
  const calculateWeeklyTrends = () => {
    return weeks.map((week, index) => {
      const weekRecords = Object.values(attendanceData).filter(
        record => record.attendance_date === week.date
      );
      
      const totalRecords = weekRecords.length;
      const presentAndLate = weekRecords.filter(r => r.status === 'P' || r.status === 'L').length;
      const percentage = totalRecords > 0 ? ((presentAndLate / totalRecords) * 100).toFixed(1) : 0;
      
      return {
        week: week.label,
        weekNumber: index + 1,
        percentage: parseFloat(percentage),
        present: weekRecords.filter(r => r.status === 'P').length,
        late: weekRecords.filter(r => r.status === 'L').length,
        absent: weekRecords.filter(r => r.status === 'U').length,
        excused: weekRecords.filter(r => r.status === 'E').length,
        unattendedMass: weekRecords.filter(r => r.status === 'UM').length,
        total: totalRecords
      };
    });
  };

  const weeklyTrends = calculateWeeklyTrends();

  // Calculate overall status distribution
  const calculateStatusDistribution = () => {
    const allRecords = Object.values(attendanceData);
    const total = allRecords.length;
    
    if (total === 0) return [];

    const counts = {
      P: allRecords.filter(r => r.status === 'P').length,
      L: allRecords.filter(r => r.status === 'L').length,
      U: allRecords.filter(r => r.status === 'U').length,
      E: allRecords.filter(r => r.status === 'E').length,
      UM: allRecords.filter(r => r.status === 'UM').length
    };

    return [
      { 
        status: 'Present', 
        code: 'P',
        count: counts.P, 
        percentage: ((counts.P / total) * 100).toFixed(1),
        color: '#10b981',
        icon: CheckCircle2
      },
      { 
        status: 'Late', 
        code: 'L',
        count: counts.L, 
        percentage: ((counts.L / total) * 100).toFixed(1),
        color: '#f59e0b',
        icon: Clock
      },
      { 
        status: 'Absent', 
        code: 'U',
        count: counts.U, 
        percentage: ((counts.U / total) * 100).toFixed(1),
        color: '#ef4444',
        icon: XCircle
      },
      { 
        status: 'Excused', 
        code: 'E',
        count: counts.E, 
        percentage: ((counts.E / total) * 100).toFixed(1),
        color: '#3b82f6',
        icon: ExcusedIcon
      },
      { 
        status: 'Unattended Mass', 
        code: 'UM',
        count: counts.UM, 
        percentage: ((counts.UM / total) * 100).toFixed(1),
        color: '#8b5cf6',
        icon: Church
      }
    ].filter(item => item.count > 0);
  };

  const statusDistribution = calculateStatusDistribution();

  // Identify at-risk students (attendance < 75%)
  const atRiskStudents = summaryData.studentStats
    .filter(s => parseFloat(s.attendancePercentage) < 75)
    .sort((a, b) => parseFloat(a.attendancePercentage) - parseFloat(b.attendancePercentage));

  // Calculate trend direction
  const calculateTrend = () => {
    if (weeklyTrends.length < 2) return null;
    
    const recentWeeks = weeklyTrends.slice(-4);
    const olderWeeks = weeklyTrends.slice(0, Math.min(4, weeklyTrends.length - 4));
    
    if (olderWeeks.length === 0) return null;
    
    const recentAvg = recentWeeks.reduce((sum, w) => sum + w.percentage, 0) / recentWeeks.length;
    const olderAvg = olderWeeks.reduce((sum, w) => sum + w.percentage, 0) / olderWeeks.length;
    
    const change = recentAvg - olderAvg;
    
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      change: Math.abs(change).toFixed(1),
      recentAvg: recentAvg.toFixed(1),
      olderAvg: olderAvg.toFixed(1)
    };
  };

  const trend = calculateTrend();

  // Calculate performance tiers
  const calculatePerformanceTiers = () => {
    const excellent = summaryData.studentStats.filter(s => parseFloat(s.attendancePercentage) >= 90).length;
    const good = summaryData.studentStats.filter(s => {
      const pct = parseFloat(s.attendancePercentage);
      return pct >= 75 && pct < 90;
    }).length;
    const fair = summaryData.studentStats.filter(s => {
      const pct = parseFloat(s.attendancePercentage);
      return pct >= 60 && pct < 75;
    }).length;
    const needsImprovement = summaryData.studentStats.filter(s => parseFloat(s.attendancePercentage) < 60).length;

    return { excellent, good, fair, needsImprovement };
  };

  const performanceTiers = calculatePerformanceTiers();

  // Calculate max value for bar chart scaling
  const maxWeeklyPercentage = Math.max(...weeklyTrends.map(w => w.percentage), 100);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '16px' : '24px'
    }}>
      {/* Trend Overview Card */}
      {trend && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: `2px solid ${trend.direction === 'up' ? '#10b981' : trend.direction === 'down' ? '#ef4444' : '#f59e0b'}`
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {trend.direction === 'up' ? (
                <TrendingUp style={{ width: '32px', height: '32px', color: '#10b981' }} />
              ) : trend.direction === 'down' ? (
                <TrendingDown style={{ width: '32px', height: '32px', color: '#ef4444' }} />
              ) : (
                <Activity style={{ width: '32px', height: '32px', color: '#f59e0b' }} />
              )}
              <div>
                <h3 style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  margin: '0 0 4px 0'
                }}>
                  Attendance Trend
                </h3>
                <p style={{
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#666',
                  margin: 0
                }}>
                  {trend.direction === 'up' && `Improving by ${trend.change}%`}
                  {trend.direction === 'down' && `Declining by ${trend.change}%`}
                  {trend.direction === 'stable' && 'Stable performance'}
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: isMobile ? '16px' : '24px'
            }}>
              <div>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: '0 0 4px 0',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  Recent
                </p>
                <p style={{
                  fontSize: isMobile ? '20px' : '24px',
                  fontWeight: '700',
                  color: '#10b981',
                  margin: 0
                }}>
                  {trend.recentAvg}%
                </p>
              </div>
              <div>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: '0 0 4px 0',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  Earlier
                </p>
                <p style={{
                  fontSize: isMobile ? '20px' : '24px',
                  fontWeight: '700',
                  color: '#9ca3af',
                  margin: 0
                }}>
                  {trend.olderAvg}%
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Weekly Trends Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <button
          onClick={() => toggleSection('trends')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginBottom: expandedSections.trends ? '20px' : 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BarChart3 style={{ width: '24px', height: '24px', color: '#10b981' }} />
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Weekly Attendance Trends
            </h3>
          </div>
          {expandedSections.trends ? (
            <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
          ) : (
            <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
          )}
        </button>

        {expandedSections.trends && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {weeklyTrends.map((week, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{
                  minWidth: isMobile ? '60px' : '80px',
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: '600',
                  color: '#666'
                }}>
                  Week {week.weekNumber}
                </div>
                <div style={{
                  flex: 1,
                  height: isMobile ? '32px' : '40px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${week.percentage}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                    style={{
                      height: '100%',
                      background: week.percentage >= 90 
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                        : week.percentage >= 75
                        ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                        : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: '12px'
                    }}
                  >
                    <span style={{
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '700',
                      color: 'white'
                    }}>
                      {week.percentage}%
                    </span>
                  </motion.div>
                </div>
                <div style={{
                  minWidth: isMobile ? '80px' : '100px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#9ca3af',
                  textAlign: 'right'
                }}>
                  {week.present + week.late}/{week.total}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Status Distribution Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <button
          onClick={() => toggleSection('distribution')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginBottom: expandedSections.distribution ? '20px' : 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PieChart style={{ width: '24px', height: '24px', color: '#3b82f6' }} />
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Status Distribution
            </h3>
          </div>
          {expandedSections.distribution ? (
            <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
          ) : (
            <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
          )}
        </button>

        {expandedSections.distribution && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: isMobile ? '12px' : '16px'
          }}>
            {statusDistribution.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.code}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  style={{
                    padding: isMobile ? '16px' : '20px',
                    backgroundColor: item.color + '10',
                    borderRadius: '12px',
                    border: `2px solid ${item.color}30`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: item.color + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon style={{ width: '20px', height: '20px', color: item.color }} />
                    </div>
                    <div>
                      <p style={{
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: '600',
                        color: '#1a1a1a',
                        margin: '0 0 2px 0'
                      }}>
                        {item.status}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: '#666',
                        margin: 0
                      }}>
                        {item.count} records
                      </p>
                    </div>
                  </div>
                  <div style={{
                    fontSize: isMobile ? '24px' : '28px',
                    fontWeight: '700',
                    color: item.color
                  }}>
                    {item.percentage}%
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* At-Risk Students Section */}
      {atRiskStudents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '2px solid #ef4444'
          }}
        >
          <button
            onClick={() => toggleSection('atRisk')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              marginBottom: expandedSections.atRisk ? '20px' : 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle style={{ width: '24px', height: '24px', color: '#ef4444' }} />
              <h3 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: 0
              }}>
                At-Risk Students ({atRiskStudents.length})
              </h3>
            </div>
            {expandedSections.atRisk ? (
              <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
            ) : (
              <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
            )}
          </button>

          {expandedSections.atRisk && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {atRiskStudents.slice(0, 10).map((student, index) => (
                <motion.div
                  key={student.studentId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isMobile ? '12px' : '16px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '12px',
                    border: '1px solid #fecaca'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      color: '#1a1a1a',
                      margin: '0 0 4px 0'
                    }}>
                      {student.studentName}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#666',
                      margin: 0
                    }}>
                      {student.absent} absent, {student.late} late
                    </p>
                  </div>
                  <div style={{
                    padding: '8px 16px',
                    backgroundColor: '#fee2e2',
                    borderRadius: '8px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: '700',
                    color: '#ef4444'
                  }}>
                    {student.attendancePercentage}%
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Performance Tiers Section */}
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
        <button
          onClick={() => toggleSection('performance')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginBottom: expandedSections.performance ? '20px' : 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Award style={{ width: '24px', height: '24px', color: '#8b5cf6' }} />
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Performance Distribution
            </h3>
          </div>
          {expandedSections.performance ? (
            <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
          ) : (
            <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
          )}
        </button>

        {expandedSections.performance && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '12px' : '16px'
          }}>
            {[
              { label: 'Excellent', value: performanceTiers.excellent, color: '#10b981', range: '≥90%' },
              { label: 'Good', value: performanceTiers.good, color: '#3b82f6', range: '75-89%' },
              { label: 'Fair', value: performanceTiers.fair, color: '#f59e0b', range: '60-74%' },
              { label: 'Needs Work', value: performanceTiers.needsImprovement, color: '#ef4444', range: '<60%' }
            ].map((tier, index) => (
              <motion.div
                key={tier.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                style={{
                  padding: isMobile ? '16px' : '20px',
                  backgroundColor: tier.color + '10',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: `2px solid ${tier.color}30`
                }}
              >
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  margin: '0 0 8px 0',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {tier.label}
                </p>
                <p style={{
                  fontSize: isMobile ? '28px' : '32px',
                  fontWeight: '700',
                  color: tier.color,
                  margin: '0 0 4px 0'
                }}>
                  {tier.value}
                </p>
                <p style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                  margin: 0
                }}>
                  {tier.range}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ClassAnalytics;
