import { useState, useEffect, useContext } from 'react';
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  FileText, 
  BarChart3,
  Edit2,
  Trash2,
  CheckCircle,
  Users,
  Baby,
  GraduationCap,
  BookOpen,
  ChevronDown,
  Settings,
  PlusCircle,
  TrendingUp,
  PieChart,
  FileSpreadsheet,
  X,
  Printer,
  Mail
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';

const CatechismLessonTracker = () => {
  const { user } = useContext(AuthContext);
  const [lessonLogs, setLessonLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [searchDate, setSearchDate] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [statistics, setStatistics] = useState({ Junior: 0, Senior: 0, Both: 0 });
  const [academicYear, setAcademicYear] = useState(null);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState('All');
  const [uniqueTeachers, setUniqueTeachers] = useState([]);

  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState({
    month: '',
    year: '',
    quarter: '',
    dayOfWeek: ''
  });

  // Report settings
  const [reportSettings, setReportSettings] = useState({
    reportType: 'summary',
    includeNotes: true,
    includeStatistics: true,
    groupBy: 'date',
    sortBy: 'date_desc'
  });

  // Form state
  const [formData, setFormData] = useState({
    lesson_date: '',
    group_type: 'Junior',
    notes: ''
  });

  // Load data on component mount
  useEffect(() => {
    loadLessonLogs();
    loadAcademicYear();
  }, []);

  // Filter logs when search/filter changes
  useEffect(() => {
    filterLogs();
  }, [lessonLogs, searchDate, groupFilter, dateRange, teacherFilter, advancedFilters]);

  // Calculate statistics when logs change
  useEffect(() => {
    calculateStatistics();
  }, [filteredLogs]);

  // Extract unique teachers
  useEffect(() => {
    const teachers = [...new Set(lessonLogs.map(log => log.created_by_email).filter(Boolean))];
    setUniqueTeachers(teachers);
  }, [lessonLogs]);

  const loadAcademicYear = async () => {
    try {
      const { data, error } = await supabase
        .from('catechism_academic_years')
        .select('*')
        .eq('is_current', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading academic year:', error);
      } else if (data) {
        setAcademicYear(data);
        setDateRange({ start: data.start_date, end: data.end_date });
      }
    } catch (error) {
      console.error('Error loading academic year:', error);
    }
  };

  const loadLessonLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('catechism_lesson_logs')
        .select('*')
        .order('lesson_date', { ascending: false });

      if (error) throw error;
      setLessonLogs(data || []);
    } catch (error) {
      console.error('Error loading lesson logs:', error);
      alert('Error loading lesson logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...lessonLogs];

    // Date search
    if (searchDate) {
      filtered = filtered.filter(log => 
        log.lesson_date.includes(searchDate)
      );
    }

    // Group filter
    if (groupFilter !== 'All') {
      filtered = filtered.filter(log => log.group_type === groupFilter);
    }

    // Teacher filter
    if (teacherFilter !== 'All') {
      filtered = filtered.filter(log => log.created_by_email === teacherFilter);
    }

    // Date range filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(log => 
        log.lesson_date >= dateRange.start && log.lesson_date <= dateRange.end
      );
    }

    // Advanced filters
    if (advancedFilters.month) {
      filtered = filtered.filter(log => {
        const logMonth = new Date(log.lesson_date).getMonth() + 1;
        return logMonth === parseInt(advancedFilters.month);
      });
    }

    if (advancedFilters.year) {
      filtered = filtered.filter(log => {
        const logYear = new Date(log.lesson_date).getFullYear();
        return logYear === parseInt(advancedFilters.year);
      });
    }

    if (advancedFilters.quarter) {
      filtered = filtered.filter(log => {
        const logMonth = new Date(log.lesson_date).getMonth() + 1;
        const quarter = Math.ceil(logMonth / 3);
        return quarter === parseInt(advancedFilters.quarter);
      });
    }

    if (advancedFilters.dayOfWeek) {
      filtered = filtered.filter(log => {
        const dayOfWeek = new Date(log.lesson_date).getDay();
        return dayOfWeek === parseInt(advancedFilters.dayOfWeek);
      });
    }

    setFilteredLogs(filtered);
  };

  const calculateStatistics = () => {
    const stats = { 
      Junior: 0, 
      Senior: 0, 
      Both: 0,
      totalLessons: filteredLogs.length,
      uniqueDates: new Set(filteredLogs.map(log => log.lesson_date)).size,
      teacherBreakdown: {},
      monthlyBreakdown: {},
      groupPercentages: {}
    };
    
    filteredLogs.forEach(log => {
      if (log.group_type === 'Both') {
        stats.Junior += 1;
        stats.Senior += 1;
      } else {
        stats[log.group_type] += 1;
      }
      stats.Both += (log.group_type === 'Both' ? 1 : 0);

      // Teacher breakdown
      const teacher = log.created_by_email || 'Unknown';
      stats.teacherBreakdown[teacher] = (stats.teacherBreakdown[teacher] || 0) + 1;

      // Monthly breakdown
      const month = new Date(log.lesson_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      stats.monthlyBreakdown[month] = (stats.monthlyBreakdown[month] || 0) + 1;
    });

    // Calculate percentages
    const totalGroupLessons = stats.Junior + stats.Senior;
    stats.groupPercentages = {
      Junior: totalGroupLessons > 0 ? ((stats.Junior / totalGroupLessons) * 100).toFixed(1) : 0,
      Senior: totalGroupLessons > 0 ? ((stats.Senior / totalGroupLessons) * 100).toFixed(1) : 0,
      Both: stats.totalLessons > 0 ? ((stats.Both / stats.totalLessons) * 100).toFixed(1) : 0
    };

    setStatistics(stats);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user || !user.id) {
      alert('User session not found. Please refresh the page and try again.');
      return;
    }

    try {
      const logData = {
        ...formData,
        created_by: user.id,
        created_by_email: user.email || 'Unknown'
      };

      if (editingLog) {
        const { error } = await supabase
          .from('catechism_lesson_logs')
          .update(logData)
          .eq('id', editingLog.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('catechism_lesson_logs')
          .insert([logData]);

        if (error) throw error;
      }

      setFormData({ lesson_date: '', group_type: 'Junior', notes: '' });
      setShowAddForm(false);
      setEditingLog(null);
      loadLessonLogs();
      alert(editingLog ? 'Lesson log updated successfully!' : 'Lesson log added successfully!');
    } catch (error) {
      console.error('Error saving lesson log:', error);
      
      if (error.code === '23505') {
        alert('A lesson for this group on this date has already been logged.');
      } else if (error.code === '23502') {
        alert('Missing required user information. Please sign out and sign back in.');
      } else {
        alert('Error saving lesson log: ' + error.message);
      }
    }
  };

  const handleEdit = (log) => {
    setEditingLog(log);
    setFormData({
      lesson_date: log.lesson_date,
      group_type: log.group_type,
      notes: log.notes || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (logId) => {
    if (!confirm('Are you sure you want to delete this lesson log?')) return;

    try {
      const { error } = await supabase
        .from('catechism_lesson_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;
      loadLessonLogs();
      alert('Lesson log deleted successfully!');
    } catch (error) {
      console.error('Error deleting lesson log:', error);
      alert('Error deleting lesson log: ' + error.message);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Day of Week', 'Group Type', 'Notes', 'Created By', 'Created At'];
    const csvData = filteredLogs.map(log => [
      log.lesson_date,
      new Date(log.lesson_date).toLocaleDateString('en-GB', { weekday: 'long' }),
      log.group_type,
      log.notes || '',
      log.created_by_email || 'Unknown',
      new Date(log.created_at).toLocaleDateString('en-GB')
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catechism-lessons-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateDetailedReport = () => {
    const reportData = {
      generatedDate: new Date().toLocaleString('en-GB'),
      academicYear: academicYear?.year_name || 'N/A',
      dateRange: `${dateRange.start || 'Start'} to ${dateRange.end || 'End'}`,
      filters: {
        group: groupFilter,
        teacher: teacherFilter,
        month: advancedFilters.month || 'All',
        year: advancedFilters.year || 'All'
      },
      summary: {
        totalLessons: statistics.totalLessons,
        uniqueDates: statistics.uniqueDates,
        juniorLessons: statistics.Junior,
        seniorLessons: statistics.Senior,
        combinedLessons: statistics.Both,
        juniorPercentage: statistics.groupPercentages.Junior,
        seniorPercentage: statistics.groupPercentages.Senior
      },
      teacherBreakdown: statistics.teacherBreakdown,
      monthlyBreakdown: statistics.monthlyBreakdown,
      lessons: filteredLogs.map(log => ({
        date: log.lesson_date,
        dayOfWeek: new Date(log.lesson_date).toLocaleDateString('en-GB', { weekday: 'long' }),
        group: log.group_type,
        notes: log.notes || 'No notes',
        teacher: log.created_by_email || 'Unknown',
        createdAt: new Date(log.created_at).toLocaleString('en-GB')
      }))
    };

    return reportData;
  };

  const printReport = () => {
    const report = generateDetailedReport();
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Catechism Lesson Report - ${report.generatedDate}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #1e293b;
            margin: 0 0 10px 0;
          }
          .header p {
            color: #64748b;
            margin: 5px 0;
          }
          .section {
            margin: 30px 0;
          }
          .section h2 {
            color: #1e293b;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 20px 0;
          }
          .stat-card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          .stat-card h3 {
            margin: 0 0 10px 0;
            color: #64748b;
            font-size: 14px;
          }
          .stat-card p {
            margin: 0;
            font-size: 32px;
            font-weight: bold;
            color: #3b82f6;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th {
            background: #3b82f6;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .breakdown-item {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📖 Catechism Lesson Report</h1>
          <p><strong>Generated:</strong> ${report.generatedDate}</p>
          <p><strong>Academic Year:</strong> ${report.academicYear}</p>
          <p><strong>Date Range:</strong> ${report.dateRange}</p>
        </div>

        <div class="section">
          <h2>📊 Summary Statistics</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <h3>Total Lessons</h3>
              <p>${report.summary.totalLessons}</p>
            </div>
            <div class="stat-card">
              <h3>Junior Lessons</h3>
              <p>${report.summary.juniorLessons} (${report.summary.juniorPercentage}%)</p>
            </div>
            <div class="stat-card">
              <h3>Senior Lessons</h3>
              <p>${report.summary.seniorLessons} (${report.summary.seniorPercentage}%)</p>
            </div>
            <div class="stat-card">
              <h3>Combined Lessons</h3>
              <p>${report.summary.combinedLessons}</p>
            </div>
            <div class="stat-card">
              <h3>Unique Dates</h3>
              <p>${report.summary.uniqueDates}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>👨‍🏫 Teacher Breakdown</h2>
          ${Object.entries(report.teacherBreakdown).map(([teacher, count]) => `
            <div class="breakdown-item">
              <span>${teacher}</span>
              <strong>${count} lessons</strong>
            </div>
          `).join('')}
        </div>

        <div class="section">
          <h2>📅 Monthly Breakdown</h2>
          ${Object.entries(report.monthlyBreakdown).map(([month, count]) => `
            <div class="breakdown-item">
              <span>${month}</span>
              <strong>${count} lessons</strong>
            </div>
          `).join('')}
        </div>

        <div class="section">
          <h2>📋 Detailed Lesson Log</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Group</th>
                <th>Notes</th>
                <th>Teacher</th>
              </tr>
            </thead>
            <tbody>
              ${report.lessons.map(lesson => `
                <tr>
                  <td>${lesson.date}</td>
                  <td>${lesson.dayOfWeek}</td>
                  <td>${lesson.group}</td>
                  <td>${lesson.notes}</td>
                  <td>${lesson.teacher}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 40px;">
          <button onclick="window.print()" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
            🖨️ Print Report
          </button>
          <button onclick="window.close()" style="padding: 12px 24px; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; margin-left: 10px;">
            ✖️ Close
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const exportToExcel = () => {
    const report = generateDetailedReport();
    
    // Create detailed Excel-compatible CSV with multiple sheets worth of data
    const summaryHeaders = ['Metric', 'Value'];
    const summaryData = [
      ['Generated Date', report.generatedDate],
      ['Academic Year', report.academicYear],
      ['Date Range', report.dateRange],
      ['Total Lessons', report.summary.totalLessons],
      ['Junior Lessons', `${report.summary.juniorLessons} (${report.summary.juniorPercentage}%)`],
      ['Senior Lessons', `${report.summary.seniorLessons} (${report.summary.seniorPercentage}%)`],
      ['Combined Lessons', report.summary.combinedLessons],
      ['Unique Dates', report.summary.uniqueDates],
    ];

    const teacherHeaders = ['Teacher', 'Number of Lessons'];
    const teacherData = Object.entries(report.teacherBreakdown).map(([teacher, count]) => [teacher, count]);

    const monthlyHeaders = ['Month', 'Number of Lessons'];
    const monthlyData = Object.entries(report.monthlyBreakdown).map(([month, count]) => [month, count]);

    const lessonHeaders = ['Date', 'Day of Week', 'Group', 'Notes', 'Teacher', 'Created At'];
    const lessonData = report.lessons.map(lesson => [
      lesson.date,
      lesson.dayOfWeek,
      lesson.group,
      lesson.notes,
      lesson.teacher,
      lesson.createdAt
    ]);

    // Combine all sections
    const excelContent = [
      ['CATECHISM LESSON REPORT'],
      [''],
      ['SUMMARY STATISTICS'],
      summaryHeaders,
      ...summaryData,
      [''],
      [''],
      ['TEACHER BREAKDOWN'],
      teacherHeaders,
      ...teacherData,
      [''],
      [''],
      ['MONTHLY BREAKDOWN'],
      monthlyHeaders,
      ...monthlyData,
      [''],
      [''],
      ['DETAILED LESSON LOG'],
      lessonHeaders,
      ...lessonData
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

    const blob = new Blob([excelContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catechism-detailed-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getGroupIcon = (groupType) => {
    switch (groupType) {
      case 'Junior': return <Baby className="h-4 w-4" />;
      case 'Senior': return <GraduationCap className="h-4 w-4" />;
      case 'Both': return <Users className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const resetFilters = () => {
    setSearchDate('');
    setGroupFilter('All');
    setTeacherFilter('All');
    setAdvancedFilters({
      month: '',
      year: '',
      quarter: '',
      dayOfWeek: ''
    });
    if (academicYear) {
      setDateRange({ start: academicYear.start_date, end: academicYear.end_date });
    } else {
      setDateRange({ start: '', end: '' });
    }
  };

  const getStatCardColor = (type) => {
    switch (type) {
      case 'Junior': return '#3b82f6';
      case 'Senior': return '#10b981';
      case 'Both': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getGroupStyle = (groupType) => {
    switch (groupType) {
      case 'Junior': 
        return {
          background: 'rgba(59, 130, 246, 0.1)',
          color: '#1d4ed8'
        };
      case 'Senior':
        return {
          background: 'rgba(16, 185, 129, 0.1)',
          color: '#059669'
        };
      case 'Both':
        return {
          background: 'rgba(139, 92, 246, 0.1)',
          color: '#7c3aed'
        };
      default:
        return {
          background: 'rgba(107, 114, 128, 0.1)',
          color: '#374151'
        };
    }
  };

  const handleLogTodaysLesson = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, lesson_date: today }));
    setEditingLog(null);
    setShowAddForm(true);
  };

  const getAvailableYears = () => {
    const years = [...new Set(lessonLogs.map(log => new Date(log.lesson_date).getFullYear()))];
    return years.sort((a, b) => b - a);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        flexDirection: 'column'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(59, 130, 246, 0.2)',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}></div>
        <p style={{ color: '#64748b', fontSize: '16px' }}>Loading lesson tracker...</p>
        <style>
          {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
        </style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: '0' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        border: '1px solid rgba(30, 58, 138, 0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between', 
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1', minWidth: '300px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontSize: 'clamp(20px, 5vw, 28px)',
                fontWeight: '800',
                color: '#1e293b',
                margin: '0 0 4px 0',
                lineHeight: '1.2'
              }}>
                Catechism Lesson Tracker
              </h1>
              <p style={{
                color: '#64748b',
                fontSize: 'clamp(14px, 3vw, 16px)',
                margin: 0,
                lineHeight: '1.4'
              }}>
                Track and manage catechism lesson attendance
                {academicYear && (
                  <span>
                    {' • '}Academic Year: {academicYear.year_name}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogTodaysLesson}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: 'clamp(12px, 2vw, 16px) clamp(16px, 3vw, 24px)',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              fontSize: 'clamp(14px, 2.5vw, 16px)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 20px rgba(5, 150, 105, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
            }}
          >
            <PlusCircle className="h-5 w-5" />
            Log Today's Lesson
          </button>
        </div>

        {/* Enhanced Statistics Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'clamp(12px, 2vw, 16px)',
          marginTop: '24px'
        }}>
          {[
            { label: 'Total Lessons', count: statistics.totalLessons, icon: BookOpen, type: 'total', color: '#6366f1' },
            { label: 'Junior Lessons', count: statistics.Junior, icon: Baby, type: 'Junior', subtitle: `${statistics.groupPercentages.Junior}% of total` },
            { label: 'Senior Lessons', count: statistics.Senior, icon: GraduationCap, type: 'Senior', subtitle: `${statistics.groupPercentages.Senior}% of total` },
            { label: 'Combined Lessons', count: statistics.Both, icon: Users, type: 'Both', subtitle: `${statistics.groupPercentages.Both}% of total` }
          ].map((stat) => {
            const Icon = stat.icon;
            const color = stat.color || getStatCardColor(stat.type);
            return (
              <div key={stat.label} style={{
                background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                borderRadius: 'clamp(12px, 2vw, 16px)',
                padding: 'clamp(16px, 3vw, 20px)',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0" />
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: 'clamp(24px, 5vw, 32px)', 
                      fontWeight: '700',
                      lineHeight: '1'
                    }}>
                      {stat.count}
                    </div>
                  </div>
                </div>
                <div style={{ 
                  fontSize: 'clamp(12px, 2.5vw, 13px)', 
                  opacity: 0.95,
                  fontWeight: '600',
                  lineHeight: '1.2'
                }}>
                  {stat.label}
                </div>
                {stat.subtitle && (
                  <div style={{
                    fontSize: 'clamp(10px, 2vw, 11px)',
                    opacity: 0.85,
                    marginTop: '4px'
                  }}>
                    {stat.subtitle}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Filters & Controls */}
      <div style={{
        background: 'white',
        borderRadius: 'clamp(12px, 2vw, 16px)',
        padding: 'clamp(16px, 3vw, 24px)',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        border: '1px solid rgba(30, 58, 138, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h3 style={{
            fontSize: 'clamp(16px, 3vw, 18px)',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Filter className="h-5 w-5" />
            Advanced Filters & Search
          </h3>
          
          <button
            onClick={() => setShowReportModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <FileText className="h-4 w-4" />
            Generate Report
          </button>
        </div>

        {/* Filter Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'clamp(12px, 2vw, 16px)',
          marginBottom: '16px'
        }}>
          {/* Search by Date */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              🔍 Search by Date
            </label>
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Group Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              👥 Group Type
            </label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                backgroundColor: 'white',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="All">All Groups</option>
              <option value="Junior">Junior Only</option>
              <option value="Senior">Senior Only</option>
              <option value="Both">Both Groups</option>
            </select>
          </div>

          {/* Teacher Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              👨‍🏫 Teacher
            </label>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                backgroundColor: 'white',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="All">All Teachers</option>
              {uniqueTeachers.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              📅 Month
            </label>
            <select
              value={advancedFilters.month}
              onChange={(e) => setAdvancedFilters(prev => ({ ...prev, month: e.target.value }))}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                backgroundColor: 'white',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="">All Months</option>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                <option key={month} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              📆 Year
            </label>
            <select
              value={advancedFilters.year}
              onChange={(e) => setAdvancedFilters(prev => ({ ...prev, year: e.target.value }))}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                backgroundColor: 'white',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="">All Years</option>
              {getAvailableYears().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Quarter Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              📊 Quarter
            </label>
            <select
              value={advancedFilters.quarter}
              onChange={(e) => setAdvancedFilters(prev => ({ ...prev, quarter: e.target.value }))}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                backgroundColor: 'white',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="">All Quarters</option>
              <option value="1">Q1 (Jan-Mar)</option>
              <option value="2">Q2 (Apr-Jun)</option>
              <option value="3">Q3 (Jul-Sep)</option>
              <option value="4">Q4 (Oct-Dec)</option>
            </select>
          </div>

          {/* Day of Week Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              🗓️ Day of Week
            </label>
            <select
              value={advancedFilters.dayOfWeek}
              onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dayOfWeek: e.target.value }))}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                backgroundColor: 'white',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="">All Days</option>
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              📍 Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Date Range End */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px'
            }}>
              🏁 End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              style={{
                width: '100%',
                padding: 'clamp(10px, 2vw, 12px)',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: 'clamp(13px, 2.5vw, 14px)',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={resetFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            🔄 Reset All Filters
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <Plus className="h-4 w-4" />
            Add Lesson
          </button>

          <button
            onClick={exportToCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>

          <button
            onClick={exportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Detailed Report
          </button>

          <button
            onClick={printReport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <FileText className="h-6 w-6 text-purple-600" />
                Generate Detailed Report
              </h2>
              <button
                onClick={() => setShowReportModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Report Statistics Preview */}
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              padding: '24px',
              borderRadius: '16px',
              marginBottom: '24px',
              border: '2px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px'
              }}>
                📊 Report Summary
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '16px'
              }}>
                <div style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>
                    {statistics.totalLessons}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Total Lessons
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>
                    {statistics.uniqueDates}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Unique Dates
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>
                    {Object.keys(statistics.teacherBreakdown).length}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Teachers
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>
                    {Object.keys(statistics.monthlyBreakdown).length}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Months
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '10px',
                fontSize: '13px',
                color: '#1e40af',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <strong>Active Filters:</strong> {groupFilter !== 'All' ? `Group: ${groupFilter}` : ''} 
                {teacherFilter !== 'All' ? ` | Teacher: ${teacherFilter}` : ''}
                {advancedFilters.month ? ` | Month: ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][advancedFilters.month-1]}` : ''}
                {advancedFilters.year ? ` | Year: ${advancedFilters.year}` : ''}
                {!groupFilter || (groupFilter === 'All' && teacherFilter === 'All' && !advancedFilters.month && !advancedFilters.year) ? 'None' : ''}
              </div>
            </div>

            {/* Export Options */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <button
                onClick={() => {
                  exportToExcel();
                  setShowReportModal(false);
                }}
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                <FileSpreadsheet className="h-10 w-10" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>Excel Report</div>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>Detailed spreadsheet with all data</div>
                </div>
              </button>

              <button
                onClick={() => {
                  printReport();
                  setShowReportModal(false);
                }}
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                <Printer className="h-10 w-10" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>Print Report</div>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>Formatted PDF-ready document</div>
                </div>
              </button>

              <button
                onClick={() => {
                  exportToCSV();
                  setShowReportModal(false);
                }}
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                <Download className="h-10 w-10" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>Simple CSV</div>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>Basic data export</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              {editingLog ? 'Edit Lesson Log' : 'Add New Lesson Log'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Lesson Date *
                </label>
                <input
                  type="date"
                  value={formData.lesson_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, lesson_date: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Group Type *
                </label>
                <select
                  value={formData.group_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, group_type: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                >
                  <option value="Junior">Junior Group</option>
                  <option value="Senior">Senior Group</option>
                  <option value="Both">Both Groups</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes about this lesson..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingLog(null);
                    setFormData({ lesson_date: '', group_type: 'Junior', notes: '' });
                  }}
                  style={{
                    padding: '12px 24px',
                    border: '2px solid #e5e7eb',
                    background: 'white',
                    color: '#374151',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.backgroundColor = 'white';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                  onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  {editingLog ? 'Update Lesson' : 'Add Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Logs Table */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        border: '1px solid rgba(30, 58, 138, 0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '24px 24px 0 24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1e293b',
            margin: '0 0 16px 0'
          }}>
            📋 Lesson Records ({filteredLogs.length} of {lessonLogs.length})
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Date
                </th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Group
                </th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Notes
                </th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Created By
                </th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'center',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '16px'
                  }}>
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    No lesson logs found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const groupStyle = getGroupStyle(log.group_type);
                  return (
                    <tr key={log.id} style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.closest('tr').style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.target.closest('tr').style.backgroundColor = 'transparent'}
                    >
                      <td style={{
                        padding: '16px 24px',
                        fontSize: '14px',
                        color: '#1e293b',
                        fontWeight: '500'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600' }}>
                            {formatDate(log.lesson_date)}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {log.lesson_date}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: groupStyle.background,
                          color: groupStyle.color
                        }}>
                          {getGroupIcon(log.group_type)}
                          {log.group_type}
                        </div>
                      </td>
                      <td style={{
                        padding: '16px 24px',
                        fontSize: '14px',
                        color: '#64748b',
                        maxWidth: '200px'
                      }}>
                        {log.notes ? (
                          <span style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={log.notes}>
                            {log.notes}
                          </span>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                            No notes
                          </span>
                        )}
                      </td>
                      <td style={{
                        padding: '16px 24px',
                        fontSize: '14px',
                        color: '#64748b'
                      }}>
                        {log.created_by_email || 'Unknown'}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          justifyContent: 'center'
                        }}>
                          <button
                            onClick={() => handleEdit(log)}
                            style={{
                              padding: '8px',
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'transform 0.2s',
                              outline: 'none'
                            }}
                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                            title="Edit lesson"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
                            style={{
                              padding: '8px',
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'transform 0.2s',
                              outline: 'none'
                            }}
                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                            title="Delete lesson"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Enhanced Summary Section */}
        {filteredLogs.length > 0 && (
          <div style={{
            padding: '24px',
            borderTop: '2px solid #e5e7eb',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 20px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <BarChart3 className="h-5 w-5" />
              Advanced Analytics
            </h3>
            
            {/* Main Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'center',
                border: '2px solid #3b82f6',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
              }}>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#3b82f6' }}>
                  {statistics.Junior}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>
                  Junior Lessons
                </div>
                <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600', marginTop: '4px' }}>
                  {statistics.groupPercentages.Junior}% of total
                </div>
              </div>
              
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'center',
                border: '2px solid #10b981',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
              }}>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#10b981' }}>
                  {statistics.Senior}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>
                  Senior Lessons
                </div>
                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '600', marginTop: '4px' }}>
                  {statistics.groupPercentages.Senior}% of total
                </div>
              </div>
              
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'center',
                border: '2px solid #8b5cf6',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.1)'
              }}>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#8b5cf6' }}>
                  {statistics.Both}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>
                  Combined
                </div>
                <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '600', marginTop: '4px' }}>
                  {statistics.groupPercentages.Both}% of total
                </div>
              </div>
              
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'center',
                border: '2px solid #6b7280',
                boxShadow: '0 2px 8px rgba(107, 114, 128, 0.1)'
              }}>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#6b7280' }}>
                  {filteredLogs.length}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>
                  Total Records
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', marginTop: '4px' }}>
                  {statistics.uniqueDates} unique dates
                </div>
              </div>
            </div>

            {/* Teacher & Monthly Breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px'
            }}>
              {/* Teacher Breakdown */}
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Users className="h-4 w-4" />
                  Teacher Breakdown
                </h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {Object.entries(statistics.teacherBreakdown).map(([teacher, count]) => (
                    <div key={teacher} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f1f5f9'
                    }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        {teacher}
                      </span>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '700', 
                        color: '#3b82f6',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly Breakdown */}
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Calendar className="h-4 w-4" />
                  Monthly Breakdown
                </h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {Object.entries(statistics.monthlyBreakdown).map(([month, count]) => (
                    <div key={month} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f1f5f9'
                    }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        {month}
                      </span>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '700', 
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatechismLessonTracker;