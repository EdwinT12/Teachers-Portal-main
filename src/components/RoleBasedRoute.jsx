// components/RoleBasedRoute.jsx
import { useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';

const RoleBasedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [roleLoading, setRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userRoles, setUserRoles] = useState([]);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setRoleLoading(false);
        return;
      }

      try {
        console.log('Checking role for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, roles, full_name')
          .eq('id', user.id)
          .single();

        console.log('Profile data:', profile);
        console.log('Profile error:', error);

        if (error) {
          console.error('Error fetching user profile:', error);
          // If profile doesn't exist, treat as teacher by default
          setUserRole('teacher');
          setUserRoles(['teacher']);
        } else {
          const primaryRole = profile?.role || 'teacher';
          const allRoles = profile?.roles || [primaryRole];
          
          console.log('Setting user role to:', primaryRole);
          console.log('All user roles:', allRoles);
          
          setUserRole(primaryRole);
          setUserRoles(allRoles);
          
          // Role-based redirection logic
          setTimeout(() => {
            const currentPath = location.pathname;
            console.log('Current path:', currentPath, 'User role:', primaryRole, 'All roles:', allRoles);
            
            // Parent trying to access teacher/admin routes
            if (primaryRole === 'parent' && !allRoles.includes('teacher') && !allRoles.includes('admin')) {
              if (currentPath.startsWith('/teacher') || currentPath.startsWith('/admin') || currentPath === '/') {
                console.log('Redirecting parent to parent dashboard');
                toast.error('Access denied. This area is for teachers and administrators.');
                navigate('/parent', { replace: true });
                return;
              }
            }
            
            // Teacher trying to access admin routes
            if (primaryRole === 'teacher' && !allRoles.includes('admin')) {
              if (currentPath === '/admin' || currentPath.startsWith('/admin/')) {
                console.log('Redirecting teacher away from admin');
                toast.error('Access denied. Admin privileges required.');
                navigate('/', { replace: true });
                return;
              }
            }
            
            // Teacher trying to access parent routes
            if ((primaryRole === 'teacher' || primaryRole === 'admin') && !allRoles.includes('parent')) {
              if (currentPath.startsWith('/parent')) {
                console.log('Redirecting non-parent away from parent area');
                toast.error('Access denied. This area is for parents.');
                navigate('/', { replace: true });
                return;
              }
            }
            
            // Users with multiple roles can access their respective areas
            // No auto-redirect for multi-role users - they can navigate freely
          }, 100);
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setUserRole('teacher');
        setUserRoles(['teacher']);
      } finally {
        setRoleLoading(false);
      }
    };

    if (!loading && user) {
      checkUserRole();
    }
  }, [user, loading, navigate, location.pathname]);

  // Show loading spinner while checking role
  if (loading || roleLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #4CAF50',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
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
  }

  // If not authenticated, don't render anything (ProtectedRoute will handle redirect)
  if (!user) {
    return null;
  }

  return children;
};


export default RoleBasedRoute;