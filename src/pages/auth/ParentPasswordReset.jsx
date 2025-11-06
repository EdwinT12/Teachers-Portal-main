import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

const ParentPasswordReset = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    // Check if we have a valid recovery token
    const checkRecoveryToken = async () => {
      // Check both hash (new format) and search params (old format)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const type = hashParams.get('type') || searchParams.get('type');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
      const token = searchParams.get('token'); // Old recovery token format
      
      console.log('🔍 Password Reset Page - Full Debug:', {
        fullURL: window.location.href,
        hash: window.location.hash,
        search: window.location.search,
        pathname: window.location.pathname,
        type,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasToken: !!token,
        allHashParams: Object.fromEntries(hashParams.entries()),
        allSearchParams: Object.fromEntries(searchParams.entries())
      });

      // Check current auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Current Auth Session:', {
        hasSession: !!session,
        sessionError,
        user: session?.user?.email,
        userId: session?.user?.id
      });
      
      // Check if this is a recovery session
      if (type === 'recovery' || (session && token)) {
        console.log('✅ Valid recovery token detected');
        setIsValidToken(true);
        return;
      }
      
      console.log('❌ Invalid token - redirecting to auth');
      toast.error('Invalid or expired reset link');
      setTimeout(() => {
        navigate('/parent/auth');
      }, 2000);
    };

    checkRecoveryToken();
  }, [navigate]);

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[^a-zA-Z0-9]/.test(password);

    if (password.length < minLength) {
      return "Password must be at least 8 characters long.";
    }
    if (!hasUpperCase) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!hasLowerCase) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!hasNumbers) {
      return "Password must contain at least one number.";
    }
    if (!hasSpecialChar) {
      return "Password must contain at least one special character.";
    }
    return null;
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    console.log('🔄 Starting password reset...');

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Validate password requirements
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      console.log('📝 Calling updateUser...');
      
      // Update the password
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      console.log('📝 updateUser response:', { data, error });

      if (error) throw error;

      console.log('✅ Password updated successfully');
      toast.success('Password updated successfully!');
      
      // Clear form
      setNewPassword('');
      setConfirmNewPassword('');
      
      console.log('🚪 Signing out user...');
      // Sign out the user so they can sign in with the new password
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        console.error('❌ Sign out error:', signOutError);
      } else {
        console.log('✅ User signed out successfully');
      }
      
      // Wait a moment then redirect to login
      setTimeout(() => {
        console.log('➡️ Redirecting to /parent/auth');
        toast.success('Please sign in with your new password');
        navigate('/parent/auth');
      }, 1500);
      
    } catch (error) {
      console.error('❌ Password update error:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
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
      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background circles */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-5%',
        width: '500px',
        height: '500px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        animation: 'float 6s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        left: '-5%',
        width: '400px',
        height: '400px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        animation: 'float 8s ease-in-out infinite reverse'
      }} />

      {!isValidToken ? (
        <div style={{
          maxWidth: '480px',
          width: '100%',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '40px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 20px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #8b5cf6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <h3 style={{ color: '#1e293b', marginBottom: '10px' }}>
              Validating reset link...
            </h3>
          </div>
        </div>
      ) : (
      <div style={{
        maxWidth: '480px',
        width: '100%',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Main Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
          animation: 'scaleIn 0.4s ease-out'
        }}>
          {/* Logo/Icon */}
          <div style={{
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
              animation: 'scaleIn 0.5s ease-out 0.2s both'
            }}>
              <Lock size={40} color="white" strokeWidth={2.5} />
            </div>

            <h1 style={{
              color: '#1e293b',
              marginBottom: '12px',
              fontSize: '28px',
              fontWeight: '800',
              lineHeight: '1.2'
            }}>
              Create New Password
            </h1>

            <p style={{
              color: '#64748b',
              fontSize: '15px',
              lineHeight: '1.6'
            }}>
              Please enter your new password below that meets all security requirements.
            </p>
          </div>

          {/* Password Requirements Banner */}
          <div style={{
            backgroundColor: '#f8faff',
            border: '2px solid #e3f2fd',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#1565c0',
            boxShadow: '0 2px 8px rgba(33, 150, 243, 0.08)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <div style={{
                backgroundColor: '#8b5cf6',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <span style={{ color: 'white', fontSize: '12px' }}>🔒</span>
              </div>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>Password Requirements</strong>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '8px',
              fontSize: '12px',
              color: '#475569'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#8b5cf6', marginRight: '6px', fontWeight: 'bold' }}>•</span>
                At least 8 characters long
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#8b5cf6', marginRight: '6px', fontWeight: 'bold' }}>•</span>
                Include uppercase letter (A-Z)
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#8b5cf6', marginRight: '6px', fontWeight: 'bold' }}>•</span>
                Include lowercase letter (a-z)
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#8b5cf6', marginRight: '6px', fontWeight: 'bold' }}>•</span>
                Include at least one number (0-9)
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#8b5cf6', marginRight: '6px', fontWeight: 'bold' }}>•</span>
                Include special character (!@#$%^&*)
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleResetPassword}>
            {/* New Password Field */}
            <div style={{ marginBottom: '20px', position: 'relative' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={{
                  width: '100%',
                  padding: '14px 48px 14px 16px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '42px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#8b5cf6'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Confirm Password Field */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                padding: '16px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: isLoading ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.4)'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                }
              }}
            >
              {isLoading ? (
                <>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Updating Password...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Reset Password
                </>
              )}
            </button>
          </form>

          {/* Info Box */}
          <div style={{
            marginTop: '24px',
            padding: '14px',
            background: 'linear-gradient(135deg, #8b5cf610 0%, #7c3aed10 100%)',
            border: '2px solid #8b5cf630',
            borderRadius: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                <Lock style={{ width: '12px', height: '12px', color: 'white' }} />
              </div>
              <p style={{
                fontSize: '13px',
                color: '#475569',
                lineHeight: '1.6',
                margin: 0,
                fontWeight: '500'
              }}>
                After resetting your password, you'll be redirected to the login page where you can sign in with your new credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Text */}
        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '13px',
          fontWeight: '500'
        }}>
          St John Maria Vianney Mission Cheam - Parent Portal
        </p>
      </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ParentPasswordReset;
