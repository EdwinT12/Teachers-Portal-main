import { useState, memo, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";

import { AuthContext } from "../context/AuthContext";
import supabase from "../utils/supabase";
import toast from "react-hot-toast";

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

  // Don't show app bar on auth pages
  if (location.pathname.startsWith('/auth')) {
    return null;
  }

  return (
    <AppBar position="sticky" elevation={1} sx={{ backgroundColor: '#fff', color: '#333' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: '64px !important' }}>
          {/* Logo and App Name */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              mr: 'auto'
            }}
            onClick={() => handleNavigation(profile?.role === 'admin' ? '/admin' : '/teacher')}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                backgroundColor: '#4CAF50',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                mr: 1.5
              }}
            >
              📚
            </Box>
            <Box>
              <Box sx={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                color: '#1a1a1a',
                lineHeight: 1
              }}>
                School Attendance
              </Box>
              <Box sx={{ 
                fontSize: '12px', 
                color: '#666',
                lineHeight: 1
              }}>
                Management System
              </Box>
            </Box>
          </Box>

          {/* User Menu */}
          {user && profile ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Open menu">
                <Button
                  onClick={handleOpenUserMenu}
                  sx={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    textTransform: 'none',
                    color: '#1a1a1a',
                    '&:hover': {
                      backgroundColor: '#e9ecef'
                    },
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}
                >
                  <Avatar 
                    sx={{ 
                      bgcolor: profile.role === 'admin' ? '#ff9800' : '#4CAF50',
                      width: 36,
                      height: 36,
                      fontSize: '16px',
                      fontWeight: 600
                    }}
                  >
                    {profile.full_name?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase()}
                  </Avatar>
                  
                  <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
                    <Box sx={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.2 }}>
                      {profile.full_name || 'User'}
                    </Box>
                    <Box sx={{ 
                      fontSize: '12px', 
                      color: '#666',
                      textTransform: 'capitalize',
                      lineHeight: 1.2,
                      mt: 0.5
                    }}>
                      {profile.role}
                    </Box>
                  </Box>

                  {/* Dropdown Arrow */}
                  <Box sx={{ 
                    width: 16, 
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path 
                        d="M4 6L8 10L12 6" 
                        stroke="#666" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Box>
                </Button>
              </Tooltip>

              <Menu
                sx={{ mt: '8px' }}
                anchorEl={anchorElUser}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                open={Boolean(anchorElUser)}
                onClose={handleCloseUserMenu}
                PaperProps={{
                  sx: {
                    minWidth: 220,
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e5e7eb'
                  }
                }}
              >
                {/* User Info */}
                <MenuItem disabled sx={{ backgroundColor: '#f8f9fa !important', opacity: '1 !important' }}>
                  <Box>
                    <Box sx={{ fontSize: '12px', color: '#666', mb: 0.5 }}>
                      Signed in as
                    </Box>
                    <Box sx={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-all' }}>
                      {profile.email}
                    </Box>
                  </Box>
                </MenuItem>

                <Divider />

                {/* Navigation Links */}
                {profile.role === 'admin' ? (
                  <MenuItem onClick={() => handleNavigation('/admin')}>
                    <Box sx={{ fontSize: '14px' }}>
                      📊 Admin Dashboard
                    </Box>
                  </MenuItem>
                ) : (
                  <MenuItem onClick={() => handleNavigation('/teacher')}>
                    <Box sx={{ fontSize: '14px' }}>
                      🏠 Dashboard
                    </Box>
                  </MenuItem>
                )}

                <Divider />

                {/* Sign Out */}
                <MenuItem onClick={handleSignOut}>
                  <Box sx={{ 
                    fontSize: '14px', 
                    color: '#dc2626',
                    fontWeight: 500 
                  }}>
                    🚪 Sign Out
                  </Box>
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Button
              onClick={() => navigate('/auth')}
              variant="contained"
              sx={{
                backgroundColor: '#4CAF50',
                color: 'white',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: '8px',
                px: 3,
                '&:hover': {
                  backgroundColor: '#45a049',
                }
              }}
            >
              Sign In
            </Button>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default memo(ResponsiveAppBar);