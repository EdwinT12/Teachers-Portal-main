import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Calendar, BookOpen, RefreshCw, TrendingUp, Users, Filter, Check } from 'lucide-react';
import AttendanceReportTab from './AttendanceReportTab';
import EvaluationReportTab from './EvaluationReportTab';

const WeeklyReportNew = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Data states
  const [allClasses, setAllClasses] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [lessonDates, setLessonDates] = useState([]);
  const [chapters, setChapters] = useState([]);
  
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [classType, setClassType] = useState('all');
  const [selectedChapters, setSelectedChapters] = useState([]);
  
  // Applied filter states (used for actual filtering)
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedClassType, setAppliedClassType] = useState('all');
  const [appliedSelectedChapters, setAppliedSelectedChapters] = useState([]);
  
  // Filter key to force re-render of child components
  const [filterKey, setFilterKey] = useState(0);
  
  // Summary statistics
  const [overallStats, setOverallStats] = useState({
    totalClasses: 0,
    attendanceComplete: 0,
    evaluationComplete: 0,
    attendancePartial: 0,
    evaluationPartial: 0,
    attendanceIncomplete: 0,
    evaluationIncomplete: 0
  });

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    console.log('WeeklyReport: Component mounted, loading initial data');
    loadInitialData();
  }, []);

  /**
   * UPDATED: Determine if a class is Junior or Senior based on year_level
   * Updated per user specification:
   * Juniors: Reception (0), Year 1, 2, 3, 4, 5a, 5b (0-5)
   * Seniors: Year 6, 7, 8, 9, 10, 11, 12 (6-12)
   */
  const getClassCategory = (yearLevel) => {
    if (yearLevel >= 0 && yearLevel <= 5) {
      return 'juniors';
    } else if (yearLevel >= 6 && yearLevel <= 12) {
      return 'seniors';
    }
    return 'unknown';
  };

  // Filter classes based on applied filter type
  const getFilteredClasses = () => {
    if (appliedClassType === 'all') return allClasses;
    
    return allClasses.filter(classItem => {
      const category = getClassCategory(classItem.year_level);
      return category === appliedClassType;
    });
  };

  /**
   * Filter lesson dates based on applied date range
   * If only start date is selected, return exact date only
   * If both dates selected, return range
   * If only end date, return up to end date
   */
  const getFilteredLessonDates = () => {
    let filtered = [...lessonDates];
    
    if (appliedStartDate && !appliedEndDate) {
      // Only start date selected - show exact date only
      filtered = filtered.filter(lesson => lesson.lesson_date === appliedStartDate);
    } else if (appliedStartDate && appliedEndDate) {
      // Both dates selected - show date range
      filtered = filtered.filter(lesson => 
        lesson.lesson_date >= appliedStartDate && lesson.lesson_date <= appliedEndDate
      );
    } else if (!appliedStartDate && appliedEndDate) {
      // Only end date selected - show up to end date
      filtered = filtered.filter(lesson => lesson.lesson_date <= appliedEndDate);
    }
    
    return filtered;
  };

  const handleApplyFilters = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedClassType(classType);
    setAppliedSelectedChapters(selectedChapters);
    setFilterKey(prev => prev + 1); // Force re-render of child components
    toast.success('Filters applied successfully');
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setClassType('all');
    setSelectedChapters([]);
    setAppliedStartDate('');
    setAppliedEndDate('');
    setAppliedClassType('all');
    setAppliedSelectedChapters([]);
    setFilterKey(prev => prev + 1); // Force re-render of child components
    toast.success('Filters reset');
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      console.log('WeeklyReport: Loading initial data...');
      await Promise.all([
        loadClasses(),
        loadTeachers(),
        loadLessonDates(),
        loadChapters()
      ]);
      console.log('WeeklyReport: Initial data loaded, triggering first render');
      // Trigger initial render of child components
      setFilterKey(prev => prev + 1);
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setTimeout(() => setRefreshing(false), 500);
    toast.success('Data refreshed');
  };

  const loadClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('year_level');
    
    if (error) throw error;
    setAllClasses(data || []);
  };

  const loadTeachers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        classes:default_class_id (
          id,
          name,
          year_level,
          sheet_name
        )
      `)
      .eq('role', 'teacher')
      .eq('status', 'active')
      .not('default_class_id', 'is', null)
      .order('full_name');
    
    if (error) throw error;
    setAllTeachers(data || []);
  };

  const loadLessonDates = async () => {
    // Get lesson dates from the last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const { data, error } = await supabase
      .from('catechism_lesson_logs')
      .select('lesson_date, group_type')
      .gte('lesson_date', threeMonthsAgo.toISOString().split('T')[0])
      .order('lesson_date', { ascending: false });
    
    if (error && error.code !== 'PGRST116') {
      console.warn('catechism_lesson_logs table not found, using mock data');
      setLessonDates([]);
      return;
    }
    setLessonDates(data || []);
  };

  const loadChapters = async () => {
    const { data, error } = await supabase
      .from('lesson_evaluations')
      .select('chapter_number')
      .order('chapter_number');
    
    if (error && error.code !== 'PGRST116') {
      console.warn('lesson_evaluations table access issue');
      setChapters([]);
      return;
    }
    
    const uniqueChapters = [...new Set((data || []).map(d => d.chapter_number))];
    setChapters(uniqueChapters.filter(c => c).sort((a, b) => a - b));
  };

  const updateOverallStats = (stats) => {
    setOverallStats(stats);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw style={{ width: '48px', height: '48px', color: '#3b82f6' }} />
        </motion.div>
        <p style={{ color: '#64748b', fontSize: '16px' }}>Loading report data...</p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: isMobile ? '16px' : '20px'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: isMobile ? '20px' : '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: isMobile ? '12px' : '16px'
      }}>
        <div>
          <h1 style={{
            fontSize: isMobile ? '24px' : '28px',
            fontWeight: '800',
            color: '#1e293b',
            margin: isMobile ? '0 0 4px 0' : '0 0 8px 0'
          }}>
            Weekly Progress Report
          </h1>
          <p style={{
            fontSize: isMobile ? '12px' : '14px',
            color: '#64748b',
            margin: 0
          }}>
            Track attendance and evaluation completion across all classes
          </p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            opacity: refreshing ? 0.6 : 1
          }}
        >
          <RefreshCw style={{ 
            width: '16px', 
            height: '16px',
            animation: refreshing ? 'spin 1s linear infinite' : 'none'
          }} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </motion.button>
      </div>

      {/* Filters Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'white',
          borderRadius: isMobile ? '8px' : '12px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e5e7eb'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <Filter style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '700',
            color: '#1e293b'
          }}>
            Filters
          </h3>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {((activeTab === 'attendance' && (startDate || endDate)) || 
              (activeTab === 'evaluation' && selectedChapters.length > 0) || 
              classType !== 'all') && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleApplyFilters}
                animate={{
                  boxShadow: (
                    (activeTab === 'attendance' && (startDate !== appliedStartDate || endDate !== appliedEndDate)) ||
                    (activeTab === 'evaluation' && JSON.stringify(selectedChapters) !== JSON.stringify(appliedSelectedChapters)) ||
                    classType !== appliedClassType
                  ) ? ['0 2px 8px rgba(59, 130, 246, 0.3)', '0 4px 16px rgba(59, 130, 246, 0.5)', '0 2px 8px rgba(59, 130, 246, 0.3)']
                    : '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}
                transition={{
                  duration: 1.5,
                  repeat: (
                    (activeTab === 'attendance' && (startDate !== appliedStartDate || endDate !== appliedEndDate)) ||
                    (activeTab === 'evaluation' && JSON.stringify(selectedChapters) !== JSON.stringify(appliedSelectedChapters)) ||
                    classType !== appliedClassType
                  ) ? Infinity : 0,
                  ease: "easeInOut"
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: (
                    (activeTab === 'attendance' && (startDate !== appliedStartDate || endDate !== appliedEndDate)) ||
                    (activeTab === 'evaluation' && JSON.stringify(selectedChapters) !== JSON.stringify(appliedSelectedChapters)) ||
                    classType !== appliedClassType
                  ) ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check style={{ width: '14px', height: '14px' }} />
                Apply Filters
              </motion.button>
            )}
            {((activeTab === 'attendance' && (appliedStartDate || appliedEndDate)) || 
              (activeTab === 'evaluation' && appliedSelectedChapters.length > 0) || 
              appliedClassType !== 'all') && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleResetFilters}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Reset Filters
              </motion.button>
            )}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: isMobile ? '12px' : '16px'
        }}>
          {/* Attendance Tab Filters */}
          {activeTab === 'attendance' && (
            <>
              {/* Start Date */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
                {startDate && !endDate && (
                  <p style={{
                    fontSize: '11px',
                    color: '#10b981',
                    margin: '4px 0 0 0',
                    fontWeight: '500'
                  }}>
                    📅 Will show exact date only
                  </p>
                )}
              </div>

              {/* End Date */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
            </>
          )}

          {/* Evaluation Tab Filters */}
          {activeTab === 'evaluation' && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Chapters
              </label>
              <select
                multiple
                value={selectedChapters.map(String)}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                  setSelectedChapters(values);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  color: '#1e293b',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minHeight: '80px'
                }}
              >
                <option value="">All Chapters</option>
                {Array.from({ length: 20 }, (_, i) => i + 1).map(chapter => (
                  <option key={chapter} value={chapter}>
                    Chapter {chapter}
                  </option>
                ))}
              </select>
              <p style={{
                fontSize: '11px',
                color: '#8b5cf6',
                margin: '4px 0 0 0',
                fontWeight: '500'
              }}>
                📚 Hold Ctrl/Cmd to select multiple chapters
              </p>
            </div>
          )}

          {/* Class Type - Always visible */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '8px'
            }}>
              Class Type
            </label>
            <select
              value={classType}
              onChange={(e) => setClassType(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                color: '#1e293b',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Classes</option>
              <option value="juniors">Juniors (Reception, Year 1-5)</option>
              <option value="seniors">Seniors (Year 6-12)</option>
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {((activeTab === 'attendance' && (appliedStartDate || appliedEndDate)) || 
          (activeTab === 'evaluation' && appliedSelectedChapters.length > 0) || 
          appliedClassType !== 'all') && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: activeTab === 'attendance' ? '#f0fdf4' : '#eff6ff',
            borderRadius: '8px',
            fontSize: '13px',
            color: activeTab === 'attendance' ? '#047857' : '#1e40af',
            border: activeTab === 'attendance' ? '1px solid #6ee7b7' : '1px solid #bfdbfe'
          }}>
            <strong style={{ color: activeTab === 'attendance' ? '#065f46' : '#1e3a8a' }}>Applied filters:</strong>
            {' '}
            
            {/* Attendance Filters */}
            {activeTab === 'attendance' && (
              <>
                {appliedStartDate && !appliedEndDate && `Exact date: ${new Date(appliedStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {appliedStartDate && appliedEndDate && `From ${new Date(appliedStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${new Date(appliedEndDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {!appliedStartDate && appliedEndDate && `Up to ${new Date(appliedEndDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {(appliedStartDate || appliedEndDate) && appliedClassType !== 'all' && ' • '}
              </>
            )}
            
            {/* Evaluation Filters */}
            {activeTab === 'evaluation' && appliedSelectedChapters.length > 0 && (
              <>
                {appliedSelectedChapters.length === 1 
                  ? `Chapter ${appliedSelectedChapters[0]}` 
                  : appliedSelectedChapters.length <= 3
                    ? `Chapters ${appliedSelectedChapters.sort((a, b) => a - b).join(', ')}`
                    : `${appliedSelectedChapters.length} chapters selected`}
                {appliedClassType !== 'all' && ' • '}
              </>
            )}
            
            {/* Class Type Filter */}
            {appliedClassType === 'juniors' && 'Juniors (Reception, Year 1-5)'}
            {appliedClassType === 'seniors' && 'Seniors (Year 6-12)'}
          </div>
        )}

        {/* Pending Filters Display */}
        {(
          (activeTab === 'attendance' && (startDate || endDate)) || 
          (activeTab === 'evaluation' && selectedChapters.length > 0) || 
          classType !== 'all'
         ) && (
          (activeTab === 'attendance' && (startDate !== appliedStartDate || endDate !== appliedEndDate)) ||
          (activeTab === 'evaluation' && JSON.stringify(selectedChapters) !== JSON.stringify(appliedSelectedChapters)) ||
          classType !== appliedClassType
         ) && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: '#fef3c7',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#92400e',
            border: '1px solid #fbbf24'
          }}>
            <strong style={{ color: '#78350f' }}>Pending changes:</strong>
            {' '}
            Click "Apply Filters" to update the data with your new filter settings.
          </div>
        )}
      </motion.div>

      {/* Overall Stats Cards - Mobile Responsive 2x2 Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '12px' : '16px',
        marginBottom: '20px'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: isMobile ? '8px' : '12px',
            padding: isMobile ? '16px' : '20px',
            color: 'white',
            minHeight: isMobile ? '100px' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Users style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', marginBottom: '6px', opacity: 0.9 }} />
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: '800', marginBottom: '2px', lineHeight: 1 }}>
            {getFilteredClasses().length}
          </div>
          <div style={{ fontSize: isMobile ? '11px' : '14px', opacity: 0.9, lineHeight: 1.2 }}>
            {appliedClassType === 'all' ? 'Total Classes' : appliedClassType === 'juniors' ? 'Junior Classes' : 'Senior Classes'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: isMobile ? '8px' : '12px',
            padding: isMobile ? '16px' : '20px',
            color: 'white',
            minHeight: isMobile ? '100px' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Calendar style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', marginBottom: '6px', opacity: 0.9 }} />
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: '800', marginBottom: '2px', lineHeight: 1 }}>
            {overallStats.attendanceComplete}
          </div>
          <div style={{ fontSize: isMobile ? '11px' : '14px', opacity: 0.9, lineHeight: 1.2 }}>
            Attendance Complete
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            borderRadius: isMobile ? '8px' : '12px',
            padding: isMobile ? '16px' : '20px',
            color: 'white',
            minHeight: isMobile ? '100px' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <BookOpen style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', marginBottom: '6px', opacity: 0.9 }} />
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: '800', marginBottom: '2px', lineHeight: 1 }}>
            {overallStats.evaluationComplete}
          </div>
          <div style={{ fontSize: isMobile ? '11px' : '14px', opacity: 0.9, lineHeight: 1.2 }}>
            Evaluation Complete
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: isMobile ? '8px' : '12px',
            padding: isMobile ? '16px' : '20px',
            color: 'white',
            minHeight: isMobile ? '100px' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <TrendingUp style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', marginBottom: '6px', opacity: 0.9 }} />
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: '800', marginBottom: '2px', lineHeight: 1 }}>
            {Math.round(((overallStats.attendanceComplete + overallStats.evaluationComplete) / 
              (getFilteredClasses().length * 2 || 1)) * 100)}%
          </div>
          <div style={{ fontSize: isMobile ? '11px' : '14px', opacity: 0.9, lineHeight: 1.2 }}>Overall Completion</div>
        </motion.div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        background: 'white',
        borderRadius: isMobile ? '8px 8px 0 0' : '12px 12px 0 0',
        padding: isMobile ? '6px' : '8px',
        display: 'flex',
        gap: isMobile ? '6px' : '8px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('attendance')}
          style={{
            flex: 1,
            padding: isMobile ? '10px 16px' : '12px 24px',
            borderRadius: isMobile ? '6px' : '8px',
            border: 'none',
            background: activeTab === 'attendance' 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
              : 'transparent',
            color: activeTab === 'attendance' ? 'white' : '#64748b',
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '6px' : '8px',
            transition: 'all 0.3s ease',
            boxShadow: activeTab === 'attendance' 
              ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
              : 'none'
          }}
        >
          <Calendar style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
          {isMobile ? 'Attendance' : 'Attendance Report'}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('evaluation')}
          style={{
            flex: 1,
            padding: isMobile ? '10px 16px' : '12px 24px',
            borderRadius: isMobile ? '6px' : '8px',
            border: 'none',
            background: activeTab === 'evaluation' 
              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
              : 'transparent',
            color: activeTab === 'evaluation' ? 'white' : '#64748b',
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '6px' : '8px',
            transition: 'all 0.3s ease',
            boxShadow: activeTab === 'evaluation' 
              ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
              : 'none'
          }}
        >
          <BookOpen style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
          {isMobile ? 'Evaluation' : 'Evaluation Report'}
        </motion.button>
      </div>

      {/* Tab Content */}
      <div style={{
        background: 'white',
        borderRadius: isMobile ? '0 0 8px 8px' : '0 0 12px 12px',
        padding: isMobile ? '16px' : '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
      }}>
        {activeTab === 'attendance' ? (
          <AttendanceReportTab
            key={`attendance-${filterKey}`}
            allClasses={getFilteredClasses()}
            allTeachers={allTeachers}
            lessonDates={getFilteredLessonDates()}
            onStatsUpdate={updateOverallStats}
          />
        ) : (
          <EvaluationReportTab
            key={`evaluation-${filterKey}`}
            allClasses={getFilteredClasses()}
            allTeachers={allTeachers}
            chapters={chapters}
            selectedChapters={appliedSelectedChapters}
            onStatsUpdate={updateOverallStats}
          />
        )}
      </div>

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

export default WeeklyReportNew;