import { useState, memo, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { AuthContext } from "../context/AuthContext";
import supabase from "../utils/supabase";
import toast from "react-hot-toast";
import { User, LogOut, Home, Shield, ChevronDown } from 'lucide-react';

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
          .select('id, email, full_name, role, status')
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

  if (location.pathname.startsWith('/auth')) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      width: '100vw',
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
        padding: '12px 24px',
        minHeight: '64px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        margin: 0
      }}>
        {/* Logo and App Name - Left Side */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            gap: '12px',
            flexShrink: 0
          }}
          onClick={() => handleNavigation(profile?.role === 'admin' ? '/admin' : '/teacher')}
        >
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#4CAF50',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            flexShrink: 0
          }}>
            📚
          </div>
          <div>
            <div style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1a1a1a',
              lineHeight: '1.2',
              marginBottom: '2px'
            }}>
              School Attendance
            </div>
            <div style={{
              fontSize: '12px',
              color: '#666',
              lineHeight: '1.2'
            }}>
              Management System
            </div>
          </div>
        </div>

        {/* User Menu - Right Side */}
        {user && profile ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={handleOpenUserMenu}
              style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                color: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9ecef';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: profile.role === 'admin' ? '#ff9800' : '#4CAF50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '600',
                color: 'white',
                flexShrink: 0
              }}>
                {profile.full_name?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase()}
              </div>
              
              <div style={{ textAlign: 'left', display: window.innerWidth < 640 ? 'none' : 'block' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', lineHeight: '1.2' }}>
                  {profile.full_name || 'User'}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  textTransform: 'capitalize',
                  lineHeight: '1.2',
                  marginTop: '4px'
                }}>
                  {profile.role}
                </div>
              </div>

              <ChevronDown style={{
                width: '16px',
                height: '16px',
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
                  minWidth: '220px',
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
                      wordBreak: 'break-all'
                    }}>
                      {profile.email}
                    </div>
                  </div>

                  {/* Navigation Links */}
                  {profile.role === 'admin' ? (
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
                  ) : (
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
              padding: '10px 24px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background-color 0.2s ease'
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