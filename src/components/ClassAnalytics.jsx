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
  ChevronUp,
  Heart,
  BookOpen,
  Zap
} from 'lucide-react';

const ClassAnalytics = ({ summaryData, classInfo, students, weeks, attendanceData, chapters, evaluationsData, selectedChapter, type = 'attendance' }) => {
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Attendance Analytics
  const calculateAttendanceAnalytics = () => {
    if (!summaryData || !weeks || weeks.length === 0 || type !== 'attendance') return null;

    // Calculate weekly trends
    const weeklyTrends = weeks.map((week, index) => {
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

    // Calculate status distribution
    const allRecords = Object.values(attendanceData);
    const total = allRecords.length;
    
    const statusDistribution = total > 0 ? [
      { 
        status: 'Present', 
        code: 'P',
        count: allRecords.filter(r => r.status === 'P').length, 
        percentage: ((allRecords.filter(r => r.status === 'P').length / total) * 100).toFixed(1),
        color: '#10b981',
        icon: CheckCircle2
      },
      { 
        status: 'Late', 
        code: 'L',
        count: allRecords.filter(r => r.status === 'L').length, 
        percentage: ((allRecords.filter(r => r.status === 'L').length / total) * 100).toFixed(1),
        color: '#f59e0b',
        icon: Clock
      },
      { 
        status: 'Absent', 
        code: 'U',
        count: allRecords.filter(r => r.status === 'U').length, 
        percentage: ((allRecords.filter(r => r.status === 'U').length / total) * 100).toFixed(1),
        color: '#ef4444',
        icon: XCircle
      },
      { 
        status: 'Excused', 
        code: 'E',
        count: allRecords.filter(r => r.status === 'E').length, 
        percentage: ((allRecords.filter(r => r.status === 'E').length / total) * 100).toFixed(1),
        color: '#3b82f6',
        icon: ExcusedIcon
      },
      { 
        status: 'Unattended Mass', 
        code: 'UM',
        count: allRecords.filter(r => r.status === 'UM').length, 
        percentage: ((allRecords.filter(r => r.status === 'UM').length / total) * 100).toFixed(1),
        color: '#8b5cf6',
        icon: Church
      }
    ].filter(item => item.count > 0) : [];

    // Calculate trend
    let trend = null;
    if (weeklyTrends.length >= 2) {
      const recentWeeks = weeklyTrends.slice(-4);
      const olderWeeks = weeklyTrends.slice(0, Math.min(4, weeklyTrends.length - 4));
      
      if (olderWeeks.length > 0) {
        const recentAvg = recentWeeks.reduce((sum, w) => sum + w.percentage, 0) / recentWeeks.length;
        const olderAvg = olderWeeks.reduce((sum, w) => sum + w.percentage, 0) / olderWeeks.length;
        const change = recentAvg - olderAvg;
        
        trend = {
          direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
          change: Math.abs(change).toFixed(1),
          recentAvg: recentAvg.toFixed(1),
          olderAvg: olderAvg.toFixed(1)
        };
      }
    }

    // At-risk students
    const atRiskStudents = summaryData.studentStats
      .filter(s => parseFloat(s.attendancePercentage) < 75)
      .sort((a, b) => parseFloat(a.attendancePercentage) - parseFloat(b.attendancePercentage));

    // Performance tiers
    const performanceTiers = {
      excellent: summaryData.studentStats.filter(s => parseFloat(s.attendancePercentage) >= 90).length,
      good: summaryData.studentStats.filter(s => {
        const pct = parseFloat(s.attendancePercentage);
        return pct >= 75 && pct < 90;
      }).length,
      fair: summaryData.studentStats.filter(s => {
        const pct = parseFloat(s.attendancePercentage);
        return pct >= 60 && pct < 75;
      }).length,
      needsImprovement: summaryData.studentStats.filter(s => parseFloat(s.attendancePercentage) < 60).length
    };

    return {
      weeklyTrends,
      statusDistribution,
      trend,
      atRiskStudents,
      performanceTiers
    };
  };

  // Evaluation Analytics
  const calculateEvaluationAnalytics = () => {
    if (!summaryData || !chapters || chapters.length === 0 || type !== 'evaluation') return null;

    const categories = [
      { key: 'D', label: 'Discipline', color: '#3b82f6', icon: Award },
      { key: 'B', label: 'Behaviour', color: '#10b981', icon: Heart },
      { key: 'HW', label: 'Homework', color: '#f59e0b', icon: BookOpen },
      { key: 'AP', label: 'Active Participation', color: '#8b5cf6', icon: Zap }
    ];

    // Calculate chapter trends
    const chapterTrends = chapters.map(chapter => {
      const chapterRecords = Object.values(evaluationsData).filter(
        record => record.chapter_number === chapter
      );
      
      const totalRecords = chapterRecords.length;
      const excellent = chapterRecords.filter(r => r.rating === 'E').length;
      const good = chapterRecords.filter(r => r.rating === 'G').length;
      
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

    // Calculate category distribution for selected chapter
    const categoryDistribution = categories.map(category => {
      const categoryRecords = Object.values(evaluationsData).filter(
        record => record.category === category.key && record.chapter_number === selectedChapter
      );
      
      const total = categoryRecords.length;
      const excellent = categoryRecords.filter(r => r.rating === 'E').length;
      const good = categoryRecords.filter(r => r.rating === 'G').length;
      const improving = categoryRecords.filter(r => r.rating === 'I').length;
      
      return {
        ...category,
        excellent,
        good,
        improving,
        total,
        percentage: total > 0 ? ((excellent * 100 + good * 75 + improving * 50) / total).toFixed(1) : 0
      };
    });

    // Calculate overall rating distribution
    const allRecords = Object.values(evaluationsData).filter(r => r.chapter_number === selectedChapter);
    const total = allRecords.length;
    
    const ratingDistribution = total > 0 ? [
      {
        rating: 'Excellent',
        code: 'E',
        count: allRecords.filter(r => r.rating === 'E').length,
        percentage: ((allRecords.filter(r => r.rating === 'E').length / total) * 100).toFixed(1),
        color: '#10b981'
      },
      {
        rating: 'Good',
        code: 'G',
        count: allRecords.filter(r => r.rating === 'G').length,
        percentage: ((allRecords.filter(r => r.rating === 'G').length / total) * 100).toFixed(1),
        color: '#3b82f6'
      },
      {
        rating: 'Improving',
        code: 'I',
        count: allRecords.filter(r => r.rating === 'I').length,
        percentage: ((allRecords.filter(r => r.rating === 'I').length / total) * 100).toFixed(1),
        color: '#f59e0b'
      }
    ] : [];

    // Calculate trend
    let trend = null;
    if (chapterTrends.length >= 2) {
      const recentChapters = chapterTrends.slice(-3);
      const olderChapters = chapterTrends.slice(0, Math.min(3, chapterTrends.length - 3));
      
      if (olderChapters.length > 0) {
        const recentAvg = recentChapters.reduce((sum, c) => sum + c.score, 0) / recentChapters.length;
        const olderAvg = olderChapters.reduce((sum, c) => sum + c.score, 0) / olderChapters.length;
        const change = recentAvg - olderAvg;
        
        trend = {
          direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
          change: Math.abs(change).toFixed(1),
          recentAvg: recentAvg.toFixed(1),
          olderAvg: olderAvg.toFixed(1)
        };
      }
    }

    // At-risk students
    const atRiskStudents = summaryData.studentStats
      .filter(s => s.score < 60)
      .sort((a, b) => a.score - b.score);

    // Performance tiers
    const performanceTiers = {
      excellent: summaryData.studentStats.filter(s => s.score >= 80).length,
      good: summaryData.studentStats.filter(s => s.score >= 60 && s.score < 80).length,
      fair: summaryData.studentStats.filter(s => s.score >= 40 && s.score < 60).length,
      needsImprovement: summaryData.studentStats.filter(s => s.score < 40).length
    };

    return {
      chapterTrends,
      categoryDistribution,
      ratingDistribution,
      trend,
      atRiskStudents,
      performanceTiers
    };
  };

  const analytics = type === 'attendance' ? calculateAttendanceAnalytics() : calculateEvaluationAnalytics();

  if (!analytics) {
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
          No analytics data available. Start tracking {type} to see insights.
        </p>
      </div>
    );
  }

  const maxPercentage = Math.max(
    ...(type === 'attendance' ? analytics.weeklyTrends.map(w => w.percentage) : analytics.chapterTrends.map(c => c.score)),
    100
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '16px' : '24px'
    }}>
      {/* Trend Overview Card */}
      {analytics.trend && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: `2px solid ${analytics.trend.direction === 'up' ? '#10b981' : analytics.trend.direction === 'down' ? '#ef4444' : '#f59e0b'}`
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
              {analytics.trend.direction === 'up' ? (
                <TrendingUp style={{ width: '32px', height: '32px', color: '#10b981' }} />
              ) : analytics.trend.direction === 'down' ? (
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
                  {type === 'attendance' ? 'Attendance Trend' : 'Performance Trend'}
                </h3>
                <p style={{
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#666',
                  margin: 0
                }}>
                  {analytics.trend.direction === 'up' && `Improving by ${analytics.trend.change}%`}
                  {analytics.trend.direction === 'down' && `Declining by ${analytics.trend.change}%`}
                  {analytics.trend.direction === 'stable' && 'Stable performance'}
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
                  {analytics.trend.recentAvg}%
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
                  {analytics.trend.olderAvg}%
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Trends Chart */}
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
        <div
          onClick={() => toggleSection('trends')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: expandedSections.trends ? '20px' : 0
          }}
        >
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: 0
          }}>
            {type === 'attendance' ? 'Weekly Trends' : 'Chapter Trends'}
          </h3>
          {expandedSections.trends ? (
            <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
          ) : (
            <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
          )}
        </div>

        {expandedSections.trends && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {(type === 'attendance' ? analytics.weeklyTrends : analytics.chapterTrends).map((item, index) => {
              const value = type === 'attendance' ? item.percentage : item.score;
              const percentage = (value / maxPercentage) * 100;
              const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';
              
              return (
                <div
                  key={type === 'attendance' ? item.week : item.chapter}
                  style={{
                    padding: isMobile ? '12px' : '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <span style={{
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '600',
                      color: '#1a1a1a'
                    }}>
                      {type === 'attendance' ? item.week : `Chapter ${item.chapter}`}
                    </span>
                    <span style={{
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '700',
                      color
                    }}>
                      {value}%
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    height: isMobile ? '6px' : '8px',
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
                        backgroundColor: color,
                        borderRadius: '4px'
                      }}
                    />
                  </div>

                  {type === 'attendance' && (
                    <div style={{
                      display: 'flex',
                      gap: isMobile ? '8px' : '12px',
                      marginTop: '8px',
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#666'
                    }}>
                      <span>P: {item.present}</span>
                      <span>L: {item.late}</span>
                      <span>U: {item.absent}</span>
                    </div>
                  )}

                  {type === 'evaluation' && (
                    <div style={{
                      display: 'flex',
                      gap: isMobile ? '8px' : '12px',
                      marginTop: '8px',
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#666'
                    }}>
                      <span>E: {item.excellent}</span>
                      <span>G: {item.good}</span>
                      <span>I: {item.improving}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Distribution Chart */}
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
        <div
          onClick={() => toggleSection('distribution')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: expandedSections.distribution ? '20px' : 0
          }}
        >
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: 0
          }}>
            {type === 'attendance' ? 'Status Distribution' : 'Rating Distribution'}
          </h3>
          {expandedSections.distribution ? (
            <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
          ) : (
            <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
          )}
        </div>

        {expandedSections.distribution && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: isMobile ? '12px' : '16px'
          }}>
            {(type === 'attendance' ? analytics.statusDistribution : analytics.ratingDistribution).map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.code}
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
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    {Icon && <Icon style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: item.color }} />}
                    <span style={{
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '700',
                      color: '#1a1a1a'
                    }}>
                      {type === 'attendance' ? item.status : item.rating}
                    </span>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <span style={{
                      fontSize: isMobile ? '24px' : '28px',
                      fontWeight: '700',
                      color: item.color
                    }}>
                      {item.count}
                    </span>
                    <span style={{
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '600',
                      color: '#666'
                    }}>
                      ({item.percentage}%)
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Performance Tiers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div
          onClick={() => toggleSection('performance')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: expandedSections.performance ? '20px' : 0
          }}
        >
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: 0
          }}>
            Performance Tiers
          </h3>
          {expandedSections.performance ? (
            <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
          ) : (
            <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
          )}
        </div>

        {expandedSections.performance && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '12px' : '16px'
          }}>
            <div style={{
              padding: isMobile ? '16px' : '20px',
              backgroundColor: '#d1fae5',
              borderRadius: '12px',
              textAlign: 'center',
              border: '2px solid #10b98130'
            }}>
              <p style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: '700',
                color: '#10b981',
                margin: '0 0 8px 0'
              }}>
                {analytics.performanceTiers.excellent}
              </p>
              <p style={{
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '600',
                color: '#059669',
                margin: 0,
                textTransform: 'uppercase'
              }}>
                Excellent
              </p>
              <p style={{
                fontSize: isMobile ? '10px' : '11px',
                color: '#666',
                margin: '4px 0 0 0'
              }}>
                {type === 'attendance' ? '≥90%' : '≥80%'}
              </p>
            </div>

            <div style={{
              padding: isMobile ? '16px' : '20px',
              backgroundColor: '#dbeafe',
              borderRadius: '12px',
              textAlign: 'center',
              border: '2px solid #3b82f630'
            }}>
              <p style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: '700',
                color: '#3b82f6',
                margin: '0 0 8px 0'
              }}>
                {analytics.performanceTiers.good}
              </p>
              <p style={{
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '600',
                color: '#1d4ed8',
                margin: 0,
                textTransform: 'uppercase'
              }}>
                Good
              </p>
              <p style={{
                fontSize: isMobile ? '10px' : '11px',
                color: '#666',
                margin: '4px 0 0 0'
              }}>
                {type === 'attendance' ? '75-89%' : '60-79%'}
              </p>
            </div>

            <div style={{
              padding: isMobile ? '16px' : '20px',
              backgroundColor: '#fef3c7',
              borderRadius: '12px',
              textAlign: 'center',
              border: '2px solid #f59e0b30'
            }}>
              <p style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: '700',
                color: '#f59e0b',
                margin: '0 0 8px 0'
              }}>
                {analytics.performanceTiers.fair}
              </p>
              <p style={{
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '600',
                color: '#d97706',
                margin: 0,
                textTransform: 'uppercase'
              }}>
                Fair
              </p>
              <p style={{
                fontSize: isMobile ? '10px' : '11px',
                color: '#666',
                margin: '4px 0 0 0'
              }}>
                {type === 'attendance' ? '60-74%' : '40-59%'}
              </p>
            </div>

            <div style={{
              padding: isMobile ? '16px' : '20px',
              backgroundColor: '#fee2e2',
              borderRadius: '12px',
              textAlign: 'center',
              border: '2px solid #ef444430'
            }}>
              <p style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: '700',
                color: '#ef4444',
                margin: '0 0 8px 0'
              }}>
                {analytics.performanceTiers.needsImprovement}
              </p>
              <p style={{
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '600',
                color: '#dc2626',
                margin: 0,
                textTransform: 'uppercase'
              }}>
                Needs Attention
              </p>
              <p style={{
                fontSize: isMobile ? '10px' : '11px',
                color: '#666',
                margin: '4px 0 0 0'
              }}>
                {type === 'attendance' ? '<60%' : '<40%'}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* At-Risk Students */}
      {analytics.atRiskStudents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '2px solid #f59e0b'
          }}
        >
          <div
            onClick={() => toggleSection('atRisk')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: expandedSections.atRisk ? '20px' : 0
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertTriangle style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#f59e0b' }} />
              <h3 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: 0
              }}>
                Students Needing Attention ({analytics.atRiskStudents.length})
              </h3>
            </div>
            {expandedSections.atRisk ? (
              <ChevronUp style={{ width: '20px', height: '20px', color: '#666' }} />
            ) : (
              <ChevronDown style={{ width: '20px', height: '20px', color: '#666' }} />
            )}
          </div>

          {expandedSections.atRisk && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {analytics.atRiskStudents.map((student) => (
                <div
                  key={student.studentId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: isMobile ? '12px' : '14px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '8px',
                    border: '1px solid #fde68a'
                  }}
                >
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
                    {type === 'attendance' ? `${student.attendancePercentage}%` : `${student.score}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ClassAnalytics;