import { useState, memo, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { AuthContext } from "../context/AuthContext";
import supabase from "../utils/supabase";
import toast from "react-hot-toast";
import { User, LogOut, Home, Shield, ChevronDown, BookOpen, TrendingUp } from 'lucide-react';

function ResponsiveAppBar() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, status, default_class_id')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error loading profile:', error);
          return;
        }

        setProfile(profileData);
      } catch (error) {
        console.error('Error in loadProfile:', error);
      }
    };

    if (user) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleSignOut = async () => {
    try {
      if (window.studentData) delete window.studentData;
      if (window.csvData) delete window.csvData;

      await supabase.auth.signOut();
      toast.success("Signed out successfully!");
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error("Error signing out");
    } finally {
      handleCloseUserMenu();
    }
  };

  const handleNavigation = (link) => {
    navigate(link);
    handleCloseUserMenu();
  };

  const handleAttendanceClick = () => {
    if (profile?.role === 'teacher' && profile?.default_class_id) {
      navigate(`/teacher/attendance/${profile.default_class_id}`);
    } else if (profile?.role === 'teacher') {
      toast.error('You have not been assigned to a class yet.');
    } else {
      toast.info('Attendance is for teachers only.');
    }
  };

  const handleEvaluationClick = () => {
    if (profile?.role === 'teacher' && profile?.default_class_id) {
      navigate(`/teacher/evaluation/${profile.default_class_id}`);
    } else if (profile?.role === 'teacher') {
      toast.error('You have not been assigned to a class yet.');
    } else {
      toast.info('Evaluation is for teachers only.');
    }
  };

  const handleDashboardClick = () => {
    if (profile?.role === 'teacher' && profile?.default_class_id) {
      navigate('/teacher/extended-dashboard');
    } else if (profile?.role === 'teacher') {
      toast.error('You have not been assigned to a class yet.');
    } else {
      toast.info('Dashboard is for teachers only.');
    }
  };

  const handleLessonPlansClick = () => {
    navigate('/teacher/lesson-plans');
  };

  if (location.pathname.startsWith('/auth')) {
    return null;
  }

  const isAttendancePage = location.pathname.includes('/attendance');
  const isEvaluationPage = location.pathname.includes('/evaluation');
  const isExtendedDashboardPage = location.pathname.includes('/extended-dashboard');
  const isLessonPlansPage = location.pathname.includes('/lesson-plans');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      width: '100%',
      background: '#ffffff',
      color: '#374151',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      margin: 0,
      padding: 0,
      borderBottom: '1px solid #e5e7eb'
    }}>
      <div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: window.innerWidth < 768 ? '8px 16px' : '12px 24px',
  minHeight: window.innerWidth < 768 ? '56px' : '64px',
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  margin: 0,
  gap: window.innerWidth < 768 ? '8px' : '16px'
}}>
        {/* Logo and App Name - Left Side */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            gap: '10px',
            flexShrink: 0,
            minWidth: 'fit-content'
          }}
          onClick={() => handleNavigation('/teacher')}
        >
          <div style={{
            width: '52px',
            height: '52px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
            padding: '4px'
          }}>
            <img 
              src="/churchlogo.jpg" 
              alt="Church Logo" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '📚';
                e.target.parentElement.style.fontSize = '24px';
              }}
            />
          </div>
          <div style={{ display: window.innerWidth < 768 ? 'none' : 'block' }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1a1a1a',
              lineHeight: '1.3',
              whiteSpace: 'nowrap'
            }}>
              School Attendance
            </div>
            <div style={{
              fontSize: '11px',
              color: '#666',
              lineHeight: '1.3',
              whiteSpace: 'nowrap'
            }}>
              Management System
            </div>
          </div>
        </div>

        {/* Navigation Links - Centered */}
        {user && profile?.role === 'teacher' && profile?.default_class_id && (
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '1',
            maxWidth: '400px',
            overflowX: 'auto'
          }}>
            <button
              onClick={handleAttendanceClick}
              style={{
                padding: '8px 16px',
                backgroundColor: isAttendancePage ? '#4CAF50' : 'transparent',
                color: isAttendancePage ? 'white' : '#1a1a1a',
                border: isAttendancePage ? 'none' : '1.5px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: isAttendancePage ? '0 2px 8px rgba(76, 175, 80, 0.3)' : 'none',
                minWidth: '100px',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!isAttendancePage) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAttendancePage) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            >
              Attendance
            </button>

            <button
              onClick={handleEvaluationClick}
              style={{
                padding: '8px 16px',
                backgroundColor: isEvaluationPage ? '#4CAF50' : 'transparent',
                color: isEvaluationPage ? 'white' : '#1a1a1a',
                border: isEvaluationPage ? 'none' : '1.5px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: isEvaluationPage ? '0 2px 8px rgba(76, 175, 80, 0.3)' : 'none',
                minWidth: '100px',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!isEvaluationPage) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }
              }}
              onMouseLeave={(e) => {
                if (!isEvaluationPage) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            >
              Evaluation
            </button>
          </div>
        )}

        {/* User Menu - Right Side */}
        {user && profile ? (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={handleOpenUserMenu}
              style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                color: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                fontSize: '13px',
                fontWeight: '500',
                minWidth: 'fit-content'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9ecef';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: profile.role === 'admin' ? '#ff9800' : '#4CAF50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                flexShrink: 0
              }}>
                {profile.full_name?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase()}
              </div>
              
              <div style={{ textAlign: 'left', display: window.innerWidth < 640 ? 'none' : 'block' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', lineHeight: '1.2' }}>
                  {profile.full_name || 'User'}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#666',
                  textTransform: 'capitalize',
                  lineHeight: '1.2',
                  marginTop: '2px'
                }}>
                  {profile.role}
                </div>
              </div>

              <ChevronDown style={{
                width: '14px',
                height: '14px',
                color: '#666',
                transform: anchorElUser ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }} />
            </button>

            {/* Dropdown Menu */}
            {anchorElUser && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999
                  }}
                  onClick={handleCloseUserMenu}
                />
                
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: '280px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e5e7eb',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}>
                  {/* User Info */}
                  <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: '12px 16px',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                      Signed in as
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1a1a1a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {profile.email}
                    </div>
                  </div>

                  {/* Navigation Links */}
                  {profile.role === 'admin' ? (
                    <>
                      <button
                        onClick={() => handleNavigation('/admin')}
            
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background-color 0.2s ease',
                          borderBottom: '1px solid #f3f4f6'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <Shield style={{ width: '16px', height: '16px' }} />
                        Admin Dashboard
                      </button>

                      <button
                        onClick={() => handleNavigation('/teacher/extended-dashboard')}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background-color 0.2s ease',
                          borderBottom: '1px solid #f3f4f6'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <TrendingUp style={{ width: '16px', height: '16px' }} />
                        Extended Dashboard
                      </button>

                      <button
                        onClick={() => handleNavigation('/teacher/lesson-plans')}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background-color 0.2s ease',
                          borderBottom: '1px solid #f3f4f6'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <BookOpen style={{ width: '16px', height: '16px' }} />
                        Lesson Plans
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleNavigation('/teacher')}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background-color 0.2s ease',
                          borderBottom: '1px solid #f3f4f6'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <Home style={{ width: '16px', height: '16px' }} />
                        Dashboard
                      </button>

                      {profile.default_class_id && (
                        <>
                          <button
                            onClick={() => handleNavigation('/teacher/extended-dashboard')}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'white',
                              cursor: 'pointer',
                              fontSize: '14px',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s ease',
                              borderBottom: '1px solid #f3f4f6'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                          >
                            <TrendingUp style={{ width: '16px', height: '16px' }} />
                            Extended Dashboard
                          </button>

                          <button
                            onClick={() => handleNavigation('/teacher/lesson-plans')}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'white',
                              cursor: 'pointer',
                              fontSize: '14px',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s ease',
                              borderBottom: '1px solid #f3f4f6'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                          >
                            <BookOpen style={{ width: '16px', height: '16px' }} />
                            Lesson Plans
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* Sign Out */}
                  <button
                    onClick={handleSignOut}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#dc2626',
                      fontWeight: '500',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <LogOut style={{ width: '16px', height: '16px' }} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate('/auth')}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              fontWeight: '600',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'background-color 0.2s ease',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#45a049';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#4CAF50';
            }}
          >
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ResponsiveAppBar);
