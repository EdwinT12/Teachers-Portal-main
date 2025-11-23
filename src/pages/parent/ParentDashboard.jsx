import { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  FileText, 
  Settings, 
  Users, 
  AlertCircle, 
  Clock,
  Award,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  PanelLeftOpen,
  ChevronUp,
  ChevronDown,
  ArrowRight
} from 'lucide-react';

// Import child components
import AttendanceOverview from '../../components/parent/AttendanceOverview';
import AbsenceRequests from '../../components/parent/AbsenceRequests';
import TestResults from '../../components/parent/TestResults';
import ParentSettings from '../../components/parent/ParentSettings';
import EvaluationOverview from '../../components/parent/EvaluationOverview';

const ParentDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance');
  const [profile, setProfile] = useState(null);
  const [linkedChildren, setLinkedChildren] = useState([]);
  const [pendingChildren, setPendingChildren] = useState([]);
  const [brokenLinks, setBrokenLinks] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const swipeContainerRef = useRef(null);

  // Sidebar navigation items
  const sidebarItems = [
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'evaluations', label: 'Evaluations', icon: Award },
    { id: 'absences', label: 'Absence Requests', icon: FileText },
    { id: 'results', label: 'Test Results', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/parent/auth');
      return;
    }

    loadParentData();
  }, [user, navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/parent/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error signing out');
    }
  };

  /**
   * Enhanced function to load parent data with resilient student matching
   */
  const loadParentData = async () => {
    try {
      setLoading(true);

      // Load parent profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load verified parent_children records
      const { data: parentChildrenData, error: parentChildrenError } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', user.id)
        .eq('verified', true)
        .not('student_id', 'is', null);

      if (parentChildrenError) throw parentChildrenError;

      // Process each parent_children record with resilient matching
      const enrichedChildren = [];
      const broken = [];
      
      for (const pc of parentChildrenData || []) {
        try {
          // First, try to fetch using student_id (the normal case)
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select(`
              id,
              student_name,
              class_id,
              classes:class_id (
                id,
                name,
                year_level
              )
            `)
            .eq('id', pc.student_id)
            .maybeSingle(); // Use maybeSingle instead of single to avoid error on no match

          if (studentData) {
            // Student found by ID - perfect!
            enrichedChildren.push({
              ...pc,
              students: studentData
            });
          } else {
            // Student not found by ID - try to match by name + class
            console.log(`Student ID ${pc.student_id} not found, attempting to rematch...`);
            
            const matchedStudent = await attemptStudentMatch(pc);
            
            if (matchedStudent) {
              // Found a match! Update the parent_children record
              await updateStudentLink(pc.id, matchedStudent.id);
              
              enrichedChildren.push({
                ...pc,
                students: matchedStudent,
                _wasRematched: true
              });
              
              toast.success(`Automatically re-linked ${pc.child_name_submitted}`, {
                duration: 3000
              });
            } else {
              // Could not find a match - mark as broken
              broken.push({
                ...pc,
                _studentNotFound: true
              });
              
              console.warn(`Could not find matching student for: ${pc.child_name_submitted} (Year ${pc.year_group})`);
            }
          }
        } catch (error) {
          console.error('Error processing parent-child link:', error);
          broken.push({
            ...pc,
            _error: error.message
          });
        }
      }

      setLinkedChildren(enrichedChildren);
      setBrokenLinks(broken);

      // Show warning if there are broken links
      if (broken.length > 0) {
        toast.error(
          `${broken.length} child${broken.length > 1 ? 'ren' : ''} could not be found. Please contact an administrator.`,
          { duration: 5000 }
        );
      }

      // Load pending children (not yet verified)
      const { data: pendingData, error: pendingError } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', user.id)
        .eq('verified', false);

      if (pendingError) throw pendingError;
      setPendingChildren(pendingData || []);

      // If no children at all, redirect to signup
      if (!enrichedChildren?.length && !pendingData?.length && !broken.length) {
        navigate('/parent/signup');
      }

    } catch (error) {
      console.error('Error loading parent data:', error);
      toast.error('Error loading your information');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Attempt to match a student by name and year/class
   */
  const attemptStudentMatch = async (parentChildRecord) => {
    try {
      // Strategy 1: Match by name + class_id (if class_id is set)
      if (parentChildRecord.class_id) {
        const { data: exactMatch, error: exactError } = await supabase
          .from('students')
          .select(`
            id,
            student_name,
            class_id,
            classes:class_id (
              id,
              name,
              year_level
            )
          `)
          .ilike('student_name', parentChildRecord.child_name_submitted.trim())
          .eq('class_id', parentChildRecord.class_id)
          .maybeSingle();

        if (exactMatch) {
          console.log('✓ Found exact match by name + class_id');
          return exactMatch;
        }
      }

      // Strategy 2: Match by name + year_level
      const { data: yearMatches, error: yearError } = await supabase
        .from('students')
        .select(`
          id,
          student_name,
          class_id,
          classes:class_id (
            id,
            name,
            year_level
          )
        `)
        .ilike('student_name', parentChildRecord.child_name_submitted.trim());

      if (yearMatches && yearMatches.length > 0) {
        // Filter by year level
        const matchingYear = yearMatches.filter(
          s => s.classes?.year_level === parentChildRecord.year_group
        );

        if (matchingYear.length === 1) {
          console.log('✓ Found unique match by name + year level');
          return matchingYear[0];
        } else if (matchingYear.length > 1) {
          console.warn('✗ Multiple students with same name in same year');
          // Return first match as a fallback, but this needs admin attention
          return matchingYear[0];
        }
      }

      // No match found
      return null;
    } catch (error) {
      console.error('Error in attemptStudentMatch:', error);
      return null;
    }
  };

  /**
   * Update the student_id in parent_children after successful rematch
   */
  const updateStudentLink = async (parentChildId, newStudentId) => {
    try {
      const { error } = await supabase
        .from('parent_children')
        .update({
          student_id: newStudentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', parentChildId);

      if (error) {
        console.error('Error updating student link:', error);
        throw error;
      }

      console.log(`✓ Updated parent_children record ${parentChildId} with student_id ${newStudentId}`);
    } catch (error) {
      console.error('Failed to update student link:', error);
    }
  };

  /**
   * Manual refresh function for users
   */
  const handleRefresh = async () => {
    toast.loading('Refreshing...', { id: 'refresh' });
    await loadParentData();
    toast.success('Refreshed!', { id: 'refresh' });
  };

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'evaluations', label: 'Evaluations', icon: Award },
    { id: 'absences', label: 'Absence Requests', icon: FileText },
    { id: 'results', label: 'Test Results', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            margin: '0 auto 16px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading your dashboard...</p>
        </div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse-glow {
              0%, 100% {
                box-shadow: 0 0 40px rgba(102, 126, 234, 0.8), 0 0 80px rgba(102, 126, 234, 0.6), 0 0 120px rgba(102, 126, 234, 0.4), 0 8px 24px rgba(102, 126, 234, 0.6);
              }
              50% {
                box-shadow: 0 0 60px rgba(102, 126, 234, 1), 0 0 100px rgba(102, 126, 234, 0.8), 0 0 140px rgba(102, 126, 234, 0.6), 0 8px 24px rgba(102, 126, 234, 0.8);
              }
            }
            @keyframes pulse-glow-orange {
              0%, 100% {
                box-shadow: 0 0 40px rgba(249, 115, 22, 0.8), 0 0 80px rgba(236, 72, 153, 0.6), 0 0 120px rgba(249, 115, 22, 0.4), 0 8px 24px rgba(249, 115, 22, 0.6);
              }
              50% {
                box-shadow: 0 0 60px rgba(249, 115, 22, 1), 0 0 100px rgba(236, 72, 153, 0.8), 0 0 140px rgba(249, 115, 22, 0.6), 0 8px 24px rgba(249, 115, 22, 0.8);
              }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh',
      height: '100vh',
      background: '#f8fafc',
      paddingTop: isMobile ? '56px' : '64px', // Account for fixed AppBar
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <motion.div
          initial={false}
          animate={{ width: sidebarCollapsed ? '64px' : '240px' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            left: 0,
            top: '64px', // Position below AppBar
            height: 'calc(100vh - 64px)', // Full height minus AppBar
            zIndex: 900,
            boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {/* Logo Section */}
          <div style={{
            padding: sidebarCollapsed ? '16px 12px' : '24px',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between'
          }}>
            {!sidebarCollapsed && (
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Parent Portal</h2>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>{profile?.full_name || 'Parent'}</p>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav style={{ flex: 1, padding: sidebarCollapsed ? '12px 8px' : '16px', overflowY: 'auto' }}>
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    width: '100%',
                    padding: sidebarCollapsed ? '12px' : '12px 16px',
                    marginBottom: '8px',
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    fontSize: '14px',
                    fontWeight: isActive ? '600' : '500',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Icon size={20} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Sign Out Button */}
          <div style={{
            padding: sidebarCollapsed ? '12px 8px' : '16px',
            borderTop: '1px solid rgba(255,255,255,0.2)'
          }}>
            <button
              onClick={handleSignOut}
              style={{
                width: '100%',
                padding: sidebarCollapsed ? '12px' : '12px 16px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <LogOut size={20} />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </motion.div>
      )}

      {/* Mobile Bottom Menu */}
      <AnimatePresence>
        {isMobile && showMobileSidebar && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileSidebar(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 899
              }}
            />
            
            {/* Bottom Menu Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: '70vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                zIndex: 900,
                display: 'flex',
                flexDirection: 'column',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
                overflowY: 'auto',
                overflowX: 'hidden'
              }}
            >
              {/* Drag Handle */}
              <div style={{
                padding: '12px 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '40px',
                  height: '4px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '2px'
                }}></div>
              </div>

              {/* Mobile Header */}
              <div style={{
                padding: '0 24px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 902
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Menu</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.8 }}>{profile?.full_name || 'Parent'}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    console.log('X button clicked');
                    setShowMobileSidebar(false);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('X button touch');
                    setShowMobileSidebar(false);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <X size={20} />
                </motion.button>
              </div>

              {/* Mobile Navigation */}
              <nav style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setShowMobileSidebar(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '16px',
                        marginBottom: '8px',
                        background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '12px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        fontSize: '15px',
                        fontWeight: isActive ? '600' : '500',
                        textAlign: 'left',
                        transition: 'all 0.2s ease'
                      }}
                      onTouchStart={(e) => {
                        e.currentTarget.style.transform = 'scale(0.98)';
                      }}
                      onTouchEnd={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Icon size={22} />
                      </div>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {isActive && (
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'white'
                        }}></div>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Mobile Sign Out - Swipe to confirm */}
              <div style={{
                padding: '16px 24px',
                paddingBottom: '24px',
                borderTop: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div 
                  ref={swipeContainerRef}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '64px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Background instruction text with animation */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: 'rgba(255,255,255,0.7)',
                    pointerEvents: 'none',
                    opacity: swipeProgress > 0.3 ? 0 : 1,
                    transition: 'opacity 0.2s ease',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      animation: 'swipeHint 2s ease-in-out infinite'
                    }}>
                      <ArrowRight size={16} style={{ marginRight: '6px' }} />
                      <span>Swipe right to sign out</span>
                    </div>
                  </div>
                  <style>
                    {`
                      @keyframes swipeHint {
                        0%, 100% {
                          transform: translateX(-20px);
                          opacity: 0.5;
                        }
                        50% {
                          transform: translateX(20px);
                          opacity: 1;
                        }
                      }
                    `}
                  </style>

                  {/* Progress bar */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${swipeProgress * 100}%`,
                    background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.5) 100%)',
                    transition: isSwipeActive ? 'none' : 'width 0.3s ease-out',
                    pointerEvents: 'none'
                  }}></div>

                  {/* Swipeable button */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.02}
                    dragMomentum={false}
                    onDragStart={() => {
                      setIsSwipeActive(true);
                    }}
                    onDrag={(event, info) => {
                      const container = swipeContainerRef.current;
                      if (!container) return;
                      
                      const containerWidth = container.offsetWidth;
                      const maxDrag = containerWidth - 64;
                      const currentX = Math.max(0, Math.min(maxDrag, info.offset.x));
                      const progress = currentX / maxDrag;
                      setSwipeProgress(progress);
                    }}
                    onDragEnd={(event, info) => {
                      setIsSwipeActive(false);
                      const container = swipeContainerRef.current;
                      if (!container) return;
                      
                      const containerWidth = container.offsetWidth;
                      const maxDrag = containerWidth - 64;
                      const currentX = Math.max(0, info.offset.x);
                      const progress = currentX / maxDrag;
                      
                      if (progress >= 0.7) {
                        // Successful swipe - sign out
                        handleSignOut();
                      } else {
                        // Reset
                        setSwipeProgress(0);
                      }
                    }}
                    animate={{
                      x: isSwipeActive ? undefined : 0
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30
                    }}
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '8px',
                      width: '48px',
                      height: '48px',
                      background: swipeProgress > 0.5 
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'rgba(255,255,255,0.25)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      transition: isSwipeActive ? 'none' : 'background 0.3s ease',
                      touchAction: 'pan-x',
                      userSelect: 'none',
                      WebkitUserDrag: 'none'
                    }}
                  >
                    <LogOut 
                      size={22} 
                      style={{ 
                        color: 'white',
                        transform: `rotate(${swipeProgress * 360}deg)`,
                        transition: isSwipeActive ? 'none' : 'transform 0.3s ease',
                        pointerEvents: 'none'
                      }} 
                    />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Menu Button - Floating in corner - ALWAYS VISIBLE */}
      {isMobile && !showMobileSidebar && (
        <motion.button
          key="floating-menu-button"
          initial={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMobileSidebar(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 901,
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #a855f7 100%)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 0 40px rgba(6, 182, 212, 0.8), 0 0 80px rgba(168, 85, 247, 0.6), 0 0 120px rgba(6, 182, 212, 0.4), 0 8px 24px rgba(6, 182, 212, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse-glow-cyan 2s ease-in-out infinite'
          }}
        >
          <ChevronUp style={{ width: '28px', height: '28px', color: 'white' }} />
        </motion.button>
      )}

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        marginLeft: isMobile ? 0 : (sidebarCollapsed ? '64px' : '240px'),
        transition: 'margin-left 0.3s ease-in-out',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {/* Content Container */}
        <div style={{ padding: isMobile ? '16px' : '32px', flex: 1 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            
            {/* Welcome Header - Desktop Only */}
            {!isMobile && (
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                padding: '32px',
                marginBottom: '24px',
                color: 'white'
              }}>
                <h1 style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  marginBottom: '8px'
                }}>
                  Welcome, {profile?.full_name || 'Parent'}!
                </h1>
                <p style={{
                  fontSize: '16px',
                  opacity: 0.9,
                  margin: 0
                }}>
                  Track your {linkedChildren.length > 1 ? 'children\'s' : 'child\'s'} attendance, submit absence requests, and view test results
                </p>
              </div>
            )}

        {/* Broken Links Alert */}
        {brokenLinks.length > 0 && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertCircle style={{ width: '24px', height: '24px', color: '#dc2626', flexShrink: 0 }} />
            <div>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#7f1d1d',
                margin: '0 0 8px 0'
              }}>
                Unable to Load {brokenLinks.length} Child{brokenLinks.length > 1 ? 'ren' : ''}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#991b1b',
                margin: '0 0 12px 0',
                lineHeight: '1.5'
              }}>
                The following children could not be found in the system. This may happen after student data is updated. Please contact an administrator to re-link your account.
              </p>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px',
                marginTop: '12px'
              }}>
                {brokenLinks.map((link, idx) => (
                  <div key={idx} style={{
                    background: 'white',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#991b1b',
                    fontWeight: '600'
                  }}>
                    • {link.child_name_submitted} (Year {link.year_group})
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pending Verification Alert */}
        {pendingChildren.length > 0 && linkedChildren.length === 0 && (
          <div style={{
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Clock style={{ width: '24px', height: '24px', color: '#d97706', flexShrink: 0 }} />
            <div>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#78350f',
                margin: '0 0 4px 0'
              }}>
                Registration Pending Verification
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#991b1b',
                margin: 0,
                lineHeight: '1.5'
              }}>
                Please complete your registration to link your children.
              </p>
            </div>
          </div>
        )}

        {/* Children Cards - Dice-5 Layout */}
        {linkedChildren.length > 0 && (
          <div style={{
            maxWidth: '600px',
            margin: '0 auto 24px auto'
          }}>
            {/* Mobile: Simple vertical layout */}
            {window.innerWidth <= 768 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {linkedChildren.slice(0, 5).map((child, index) => (
                  <div key={child.id} style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: child._wasRematched ? '2px solid #10b981' : '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Users style={{ width: '18px', height: '18px', color: 'white' }} />
                    </div>
                    <div>
                      <h3 style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: '0 0 2px 0'
                      }}>
                        {child.students?.student_name || 'Student'}
                      </h3>
                      <p style={{
                        fontSize: '12px',
                        color: '#64748b',
                        margin: 0
                      }}>
                        {child.students?.classes?.name || `Year ${child.year_group}`}
                      </p>
                    </div>
                    {child._wasRematched && (
                      <div style={{
                        marginLeft: 'auto',
                        padding: '3px 6px',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        AUTO
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: Flexible grid layout */
              <div style={{
                display: 'grid',
                gridTemplateColumns: linkedChildren.length >= 3 ? 'repeat(3, 1fr)' : `repeat(${linkedChildren.length}, 1fr)`,
                gap: '16px',
                justifyItems: 'center'
              }}>
                {linkedChildren.slice(0, 5).map((child, index) => (
                  <div key={child.id} style={{
                    width: '180px',
                    height: '140px',
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    border: child._wasRematched ? '2px solid #10b981' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    position: 'relative'
                  }}>
                      {child._wasRematched && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          padding: '4px 8px',
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          AUTO
                        </div>
                      )}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px'
                      }}>
                        <Users style={{ width: '24px', height: '24px', color: 'white' }} />
                      </div>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1e293b',
                        margin: '0 0 4px 0',
                        lineHeight: '1.2',
                        textAlign: 'center'
                      }}>
                        {child.students?.student_name || 'Student'}
                      </h3>
                      <p style={{
                        fontSize: '13px',
                        color: '#64748b',
                        margin: 0,
                        lineHeight: '1.2',
                        textAlign: 'center'
                      }}>
                        {child.students?.classes?.name || `Year ${child.year_group}`}
                      </p>
                    </div>
                  ))
                }
              </div>
            )}
            
            {/* Additional children beyond 5 */}
            {linkedChildren.length > 5 && (
              <div style={{
                marginTop: window.innerWidth > 768 ? '20px' : '12px',
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  margin: '0 0 8px 0'
                }}>
                  Additional Children ({linkedChildren.length - 5})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {linkedChildren.slice(5).map((child) => (
                    <div key={child.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#64748b'
                    }}>
                      <Users style={{ width: '14px', height: '14px' }} />
                      <span>{child.students?.student_name || 'Student'} - {child.students?.classes?.name || `Year ${child.year_group}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

            {/* Main Content Card */}
            {linkedChildren.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: isMobile ? '20px' : '32px',
                minHeight: '400px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                {activeTab === 'attendance' && (
                  <AttendanceOverview linkedChildren={linkedChildren} />
                )}
                {activeTab === 'evaluations' && (
                  <EvaluationOverview linkedChildren={linkedChildren} />
                )}
                {activeTab === 'absences' && (
                  <AbsenceRequests linkedChildren={linkedChildren} onRequestSubmitted={loadParentData} />
                )}
                {activeTab === 'results' && (
                  <TestResults linkedChildren={linkedChildren} />
                )}
                {activeTab === 'settings' && (
                  <ParentSettings profile={profile} linkedChildren={linkedChildren} onUpdate={loadParentData} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;