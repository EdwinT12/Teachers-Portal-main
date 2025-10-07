import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';

const GoogleAuthLanding = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If user is already authenticated, redirect to main app
    if (user) {
      navigate("/");
    }

    // Security: Clear any sensitive data
    if (window.studentData) delete window.studentData;
    if (window.csvData) delete window.csvData;
  }, [user, navigate]);

  const signInWithGoogle = async () => {
  setIsLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Request Google Sheets API access
        scopes: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

      if (error) {
        console.error('OAuth error:', error);
        toast.error('Failed to initiate Google sign-in');
        setIsLoading(false);
      }
      // The user will be redirected to Google's OAuth page
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img 
            src="/logo.png"
            alt="SJMV Logo" 
            style={{
              width: '120px',
              height: 'auto',
              marginBottom: '20px',
              display: 'block',
              margin: '0 auto 20px',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'
            }}
            onError={(e) => e.target.style.display = 'none'}
          />
          
          <h1 style={{
            color: '#333',
            marginBottom: '10px',
            fontSize: '32px',
            fontWeight: 'bold'
          }}>
            School Attendance System
          </h1>
          <p style={{
            color: '#666',
            fontSize: '16px',
            margin: '0 0 30px 0',
            lineHeight: '1.5'
          }}>
            Sign in with your school Google account to access the attendance management system
          </p>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={isLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            backgroundColor: 'white',
            color: '#444',
            border: '2px solid #ddd',
            padding: '14px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isLoading ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              e.target.style.borderColor = '#4285f4';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.boxShadow = 'none';
            e.target.style.borderColor = '#ddd';
          }}
        >
          {isLoading ? (
            <>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #4285f4',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Redirecting to Google...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#e8f5fe',
          border: '1px solid #bbdefb',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#1565c0',
          lineHeight: '1.6'
        }}>
          <strong>🔒 What happens when you sign in:</strong>
          <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
            <li>You'll be redirected to Google's secure login page</li>
            <li>The system will request access to your Google Sheets</li>
            <li>Your attendance data will sync with the school spreadsheet</li>
            <li>All sessions are encrypted and secure</li>
          </ul>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#856404'
        }}>
          ⚠️ <strong>Important:</strong> Only use your official school Google account. Personal Gmail accounts will not have access to the attendance system.
        </div>
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

export default GoogleAuthLanding;