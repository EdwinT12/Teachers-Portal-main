// context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';

export const AuthContext = createContext({});

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenStatus, setTokenStatus] = useState('active');

  useEffect(() => {
    // Get initial session and handle expired sessions
    const getInitialSession = async () => {
      try {
        // Check if this is a password recovery flow FIRST
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        const isRecovery = hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
        
        if (isRecovery) {
          console.log('🔐 Password recovery detected in initial load - redirecting to reset page');
          const currentHash = window.location.hash;
          const currentSearch = window.location.search;
          setLoading(false);
          // Use replace to avoid history issues
          window.location.replace('/parent/reset-password' + (currentHash || currentSearch));
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setUser(null);
          setLoading(false);
          return;
        }

        // Check if session exists but is expired
        if (session) {
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = session.expires_at;
          const isExpired = expiresAt && (expiresAt - now) <= 0;

          if (isExpired) {
            console.log('🔄 Session expired, attempting automatic refresh...');
            
            // Try to refresh the expired session
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshData?.session) {
              console.error('❌ Failed to refresh expired session:', refreshError);
              // Session is truly expired and can't be refreshed
              await supabase.auth.signOut();
              setUser(null);
              toast.error('Your session has expired. Please sign in again.', {
                duration: 5000,
              });
            } else {
              console.log('✅ Session successfully refreshed on startup!');
              setUser(refreshData.session.user);
              setTokenStatus('active');
              toast.success('Welcome back! Session refreshed.', {
                duration: 3000,
                icon: '👋',
              });
            }
          } else {
            // Session is still valid
            console.log('Initial session loaded for:', session.user.email);
            setUser(session.user);
            setTokenStatus('active');
            
            // Check if it's expiring soon and refresh proactively
            const timeUntilExpiry = expiresAt - now;
            if (timeUntilExpiry < 900) { // Less than 15 minutes
              console.log('⚠️ Session expiring soon, refreshing proactively...');
              supabase.auth.refreshSession();
            }
          }
        } else {
          // No session at all
          setUser(null);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        // Check if this is a password recovery flow
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        const isRecovery = hashParams.get('type') === 'recovery' || 
                          searchParams.get('type') === 'recovery' || 
                          event === 'PASSWORD_RECOVERY';
        
        if (isRecovery && event === 'SIGNED_IN') {
          console.log('🔐 Password recovery sign-in detected - redirecting to reset page');
          setUser(session?.user ?? null);
          setLoading(false);
          const currentHash = window.location.hash;
          const currentSearch = window.location.search;
          // Redirect to password reset page with hash/search params
          window.location.replace('/parent/reset-password' + (currentHash || currentSearch));
          return;
        }
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Token was refreshed successfully');
          setTokenStatus('active');
          setUser(session?.user ?? null);
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setUser(null);
          setTokenStatus('expired');
          // Security: Clear sensitive data on sign out
          if (window.studentData) delete window.studentData;
          if (window.csvData) delete window.csvData;
          if (window.emailData) delete window.emailData;
        }
        
        if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user?.email);
          setUser(session?.user ?? null);
          setTokenStatus('active');
        }
        
        setLoading(false);
      }
    );

    // Proactive token refresh - check every 10 minutes
    // Only runs when app is actively open
    const proactiveRefreshInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          const expiresAt = session.expires_at;
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = expiresAt - now;
          
          // If less than 15 minutes until expiry, refresh now
          if (timeUntilExpiry < 900) {
            console.log('⏰ Token expiring in', Math.floor(timeUntilExpiry / 60), 'minutes, refreshing proactively...');
            setTokenStatus('refreshing');
            
            const { data, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.error('Proactive refresh failed:', refreshError);
              setTokenStatus('expired');
              toast.error('Session expiring soon. Please refresh your connection.', {
                duration: 5000,
              });
            } else {
              console.log('✅ Proactive session refresh successful');
              setTokenStatus('active');
            }
          }
        }
      } catch (err) {
        console.error('Error in proactive refresh:', err);
      }
    }, 10 * 60 * 1000); // Every 10 minutes

    // Background session refresh - refresh every 30 minutes to stay ahead of expiry
    // Only runs when app is actively open
    const backgroundRefreshInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          console.log('🔄 Background refresh starting...');
          setTokenStatus('refreshing');
          
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Background refresh failed:', refreshError);
            setTokenStatus('expired');
          } else {
            console.log('✅ Background session refresh successful');
            setTokenStatus('active');
          }
        }
      } catch (err) {
        console.error('Error in background refresh:', err);
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    // Handle page visibility change (when app comes back to foreground)
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('📱 App returned to foreground, checking session...');
        
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session && !error) {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = session.expires_at;
            const timeUntilExpiry = expiresAt - now;
            
            // If expired or expiring soon, refresh immediately
            if (timeUntilExpiry < 900) {
              console.log('🔄 Session needs refresh after coming to foreground...');
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              
              if (!refreshError && refreshData?.session) {
                console.log('✅ Session refreshed after foreground return');
                setTokenStatus('active');
              }
            }
          }
        } catch (err) {
          console.error('Error checking session on visibility change:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      subscription?.unsubscribe();
      clearInterval(proactiveRefreshInterval);
      clearInterval(backgroundRefreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const value = {
    user,
    loading,
    tokenStatus,
    signOut: async () => {
      try {
        await supabase.auth.signOut();
        toast.success('Signed out successfully');
      } catch (error) {
        console.error('Error signing out:', error);
        toast.error('Error signing out');
      }
    },
    refreshSession: async () => {
      try {
        setTokenStatus('refreshing');
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        setTokenStatus('active');
        toast.success('Connection refreshed!');
        return { success: true };
      } catch (error) {
        setTokenStatus('expired');
        toast.error('Failed to refresh. Please sign in again.');
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;