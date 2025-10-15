// context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';

export const AuthContext = createContext({});

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        if (session) {
          console.log('Initial session loaded for:', session.user.email);
        }
      } catch (error) {
        console.error('Error getting session:', error);
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
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Token was refreshed successfully');
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setUser(null);
          // Security: Clear sensitive data on sign out
          if (window.studentData) delete window.studentData;
          if (window.csvData) delete window.csvData;
          if (window.emailData) delete window.emailData;
        }
        
        if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user?.email);
          setUser(session?.user ?? null);
        }
        
        if (event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null);
        }
        
        setLoading(false);
      }
    );

    // Background session refresh - refresh every 45 minutes to stay ahead of expiry
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session) {
          const expiresAt = session.expires_at;
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = expiresAt - now;
          
          // If less than 10 minutes until expiry, refresh now
          if (timeUntilExpiry < 600) {
            console.log('Session expiring soon, refreshing...');
            const { data, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.error('Background refresh failed:', refreshError);
            } else {
              console.log('✅ Background session refresh successful');
            }
          }
        }
      } catch (err) {
        console.error('Error in background refresh:', err);
      }
    }, 45 * 60 * 1000); // Every 45 minutes

    // Cleanup
    return () => {
      subscription?.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const value = {
    user,
    loading,
    signOut: async () => {
      try {
        await supabase.auth.signOut();
        toast.success('Signed out successfully');
      } catch (error) {
        console.error('Error signing out:', error);
        toast.error('Error signing out');
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