import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { Shield, CheckCircle, Lock, Users, Heart, Mail, Eye, EyeOff } from 'lucide-react';

const ParentAuthLanding = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });

  useEffect(() => {
    // If user is already authenticated, check their role and redirect
    const checkUserRole = async () => {
      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, roles')
            .eq('id', user.id)
            .single();

          if (profile) {
            const userRoles = profile.roles || [profile.role];
            if (userRoles.includes('parent')) {
              navigate("/parent");
            } else {
              navigate("/");
            }
          }
        } catch (error) {
          console.error('Error checking role:', error);
        }
      }
    };

    checkUserRole();

    // Security: Clear any sensitive data
    if (window.studentData) delete window.studentData;
    if (window.csvData) delete window.csvData;
  }, [user, navigate]);

  // Countdown timer effect
  useEffect(() => {
    if (showVerificationModal && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showVerificationModal && countdown === 0) {
      setShowVerificationModal(false);
      setAuthMode('signin');
    }
  }, [showVerificationModal, countdown]);

  const handleEmailPasswordAuth = async (e) => {
    e.preventDefault();

    if (authMode === 'signup') {
      // Validation for signup
      if (!formData.fullName.trim()) {
        toast.error('Please enter your full name');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        // Sign up with email and password
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: 'parent' // Pass role in metadata
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          // The trigger will create the profile, but let's ensure it has the right role
          // Wait a moment for the trigger to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify and fix the profile if needed
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile && profile.role !== 'parent') {
            // Fix the role if trigger didn't work
            await supabase
              .from('profiles')
              .update({
                role: 'parent',
                roles: ['parent']
              })
              .eq('id', data.user.id);
          } else if (profileError && profileError.code === 'PGRST116') {
            // Profile doesn't exist, create it manually
            await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: formData.email,
                full_name: formData.fullName,
                role: 'parent',
                roles: ['parent']
              });
          }

          // Sign out the user immediately so they must verify email first
          await supabase.auth.signOut();
          
          // Show verification modal with countdown
          setShowVerificationModal(true);
          setCountdown(5);
          
          // Keep the email so they can sign in easily
          setFormData({
            email: formData.email,
            password: '',
            confirmPassword: '',
            fullName: ''
          });
        }
      } else {
        // Sign in with email and password
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Please verify your email address first');
          } else {
            toast.error(error.message);
          }
          setIsLoading(false);
          return;
        }

        if (data.user) {
          // Check if profile exists with correct role
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            // Ensure profile has parent role
            if (profile.role !== 'parent' || !profile.roles?.includes('parent')) {
              await supabase
                .from('profiles')
                .update({
                  role: 'parent',
                  roles: ['parent']
                })
                .eq('id', data.user.id);
            }
          } else if (profileError && profileError.code === 'PGRST116') {
            // Profile doesn't exist, create it
            await supabase.from('profiles').insert({
              id: data.user.id,
              email: formData.email,
              full_name: data.user.user_metadata?.full_name || formData.email.split('@')[0],
              role: 'parent',
              roles: ['parent']
            });
          }

          toast.success('Signed in successfully!');
          navigate('/parent/signup');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      fullName: ''
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      paddingTop: '100px', // Extra padding for app bar
      background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
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

      <div style={{
        maxWidth: '480px',
        width: '100%',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Main Card */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          padding: '40px',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.6s ease-out'
        }}>
          {/* Logo */}
          <div style={{
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 20px',
              background: 'white',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(14, 165, 233, 0.3)',
              padding: '12px',
              animation: 'scaleIn 0.5s ease-out 0.2s both'
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
                  e.target.parentElement.innerHTML = '👨‍👩‍👧‍👦';
                  e.target.parentElement.style.fontSize = '36px';
                  e.target.parentElement.style.padding = '0';
                }}
              />
            </div>
            
            <h1 style={{
              color: '#1e293b',
              marginBottom: '12px',
              fontSize: '28px',
              fontWeight: '800',
              lineHeight: '1.2',
              animation: 'fadeIn 0.6s ease-out 0.3s both'
            }}>
              Parent Portal
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '15px',
              margin: 0,
              lineHeight: '1.6',
              fontWeight: '500',
              animation: 'fadeIn 0.6s ease-out 0.4s both'
            }}>
              {authMode === 'signin' ? 'Sign in to view your child\'s catechism progress' : 'Create an account to get started'}
            </p>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailPasswordAuth} style={{ marginBottom: '24px' }}>
            {authMode === 'signup' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter your full name"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: authMode === 'signup' ? '16px' : '24px', position: 'relative' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  paddingRight: '48px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '38px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {authMode === 'signup' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm your password"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                color: 'white',
                border: 'none',
                padding: '14px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(14, 165, 233, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.4)';
                }
              }}
            >
              {isLoading ? (
                <>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  {authMode === 'signin' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  <Mail style={{ width: '20px', height: '20px' }} />
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          {/* Toggle Auth Mode */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              {authMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={toggleAuthMode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0ea5e9',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  fontSize: '14px'
                }}
              >
                {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>

          {/* Features */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '24px'
          }}>
            {[
              { icon: Shield, text: 'Secure & Private' },
              { icon: Users, text: 'Track Attendance' },
              { icon: Lock, text: 'Protected Data' },
              { icon: Heart, text: 'Stay Connected' }
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #0ea5e920 0%, #06b6d420 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon style={{ width: '14px', height: '14px', color: '#0ea5e9' }} />
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#475569'
                  }}>
                    {feature.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Info Box */}
          <div style={{
            padding: '14px',
            background: 'linear-gradient(135deg, #0ea5e910 0%, #06b6d410 100%)',
            border: '2px solid #0ea5e930',
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
                background: '#0ea5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>i</span>
              </div>
              <div>
                <p style={{
                  fontSize: '13px',
                  color: '#475569',
                  margin: '0 0 6px 0',
                  fontWeight: '600',
                  lineHeight: '1.5'
                }}>
                  <strong>First time here?</strong>
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#64748b',
                  margin: 0,
                  lineHeight: '1.6'
                }}>
                  After signing {authMode === 'signin' ? 'in' : 'up'}, you'll provide your child's information. An admin will verify and link your account.
                </p>
              </div>
            </div>
          </div>

          {/* Teacher Link */}
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            padding: '10px',
            background: '#f8fafc',
            borderRadius: '8px'
          }}>
            <p style={{
              fontSize: '12px',
              color: '#64748b',
              margin: 0
            }}>
              Are you a teacher?{' '}
              <a 
                href="/auth" 
                style={{
                  color: '#0ea5e9',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
              >
                Sign in here
              </a>
            </p>
          </div>
        </div>

        {/* Footer Text */}
        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '13px',
          fontWeight: '500'
        }}>
          St John Maria Vianney Mission Cheam - Parent Portal
        </p>
      </div>

      {/* Email Verification Modal */}
      {showVerificationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '48px',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
            textAlign: 'center',
            animation: 'scaleIn 0.4s ease-out',
            position: 'relative'
          }}>
            {/* Success Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
              animation: 'scaleIn 0.5s ease-out 0.2s both'
            }}>
              <CheckCircle size={48} color="white" strokeWidth={2.5} />
            </div>

            {/* Title */}
            <h2 style={{
              color: '#1e293b',
              fontSize: '28px',
              fontWeight: '800',
              marginBottom: '16px',
              lineHeight: '1.2'
            }}>
              Account Created!
            </h2>

            {/* Message */}
            <p style={{
              color: '#475569',
              fontSize: '16px',
              lineHeight: '1.6',
              marginBottom: '24px',
              fontWeight: '500'
            }}>
              Please check your email and click the verification link to activate your account.
            </p>

            {/* Email Icon */}
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              padding: '20px',
              borderRadius: '16px',
              marginBottom: '24px',
              border: '2px solid #bfdbfe'
            }}>
              <Mail size={32} color="#0ea5e9" style={{ marginBottom: '12px' }} />
              <p style={{
                color: '#1e40af',
                fontSize: '14px',
                fontWeight: '600',
                margin: 0
              }}>
                Verification email sent to:<br />
                <span style={{ color: '#0ea5e9', wordBreak: 'break-all' }}>
                  {formData.email}
                </span>
              </p>
            </div>

            {/* Countdown */}
            <div style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '8px'
            }}>
              <p style={{
                color: '#64748b',
                fontSize: '14px',
                margin: 0,
                fontWeight: '600'
              }}>
                Redirecting to sign in page in{' '}
                <span style={{
                  display: 'inline-block',
                  backgroundColor: '#0ea5e9',
                  color: 'white',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  lineHeight: '32px',
                  textAlign: 'center',
                  fontSize: '16px',
                  fontWeight: '700',
                  margin: '0 4px',
                  animation: 'pulse 1s ease-in-out infinite'
                }}>
                  {countdown}
                </span>
                {countdown === 1 ? 'second' : 'seconds'}
              </p>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.7);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 0 0 8px rgba(14, 165, 233, 0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default ParentAuthLanding;