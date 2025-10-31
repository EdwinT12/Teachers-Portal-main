import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import { GraduationCap, Users, ArrowRight } from 'lucide-react';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, loading } = useContext(AuthContext);

  useEffect(() => {
    // If user is already authenticated, redirect them to appropriate dashboard
    const checkUserAndRedirect = async () => {
      if (user) {
        try {
          // Fetch user profile to determine role
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching profile:', error);
            return;
          }

          // Redirect based on role
          if (profile.role === 'admin') {
            navigate('/admin', { replace: true });
          } else if (profile.role === 'teacher') {
            navigate('/teacher', { replace: true });
          } else if (profile.role === 'parent') {
            navigate('/parent', { replace: true });
          }
        } catch (error) {
          console.error('Error checking user role:', error);
        }
      }
    };

    if (!loading) {
      checkUserAndRedirect();
    }
  }, [user, loading, navigate]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(255,255,255,0.3)',
          borderTop: '3px solid white',
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      paddingTop: '100px', // Extra padding for app bar
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        maxWidth: '1000px',
        width: '100%',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '48px',
          animation: 'fadeIn 0.6s ease-out'
        }}>
          <div style={{
            width: '100px',
            height: '100px',
            margin: '0 auto 24px',
            background: 'white',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            padding: '16px',
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
                e.target.parentElement.innerHTML = '🏫';
                e.target.parentElement.style.fontSize = '56px';
              }}
            />
          </div>
          
          <h1 style={{
            color: 'white',
            marginBottom: '16px',
            fontSize: '38px',
            fontWeight: '800',
            lineHeight: '1.2',
            animation: 'fadeIn 0.6s ease-out 0.3s both',
            textShadow: '0 2px 20px rgba(0, 0, 0, 0.2)'
          }}>
            SJMV Catechism Portal
          </h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.95)',
            fontSize: '18px',
            margin: 0,
            lineHeight: '1.6',
            fontWeight: '500',
            animation: 'fadeIn 0.6s ease-out 0.4s both'
          }}>
            Welcome! Please select your role to continue
          </p>
        </div>

        {/* Selection Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          maxWidth: '800px',
          margin: '0 auto',
          animation: 'fadeIn 0.6s ease-out 0.5s both'
        }}>
          {/* Teacher Card - Purple Theme */}
          <button
            onClick={() => navigate('/auth')}
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              padding: '32px 28px',
              borderRadius: '24px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '320px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(102, 126, 234, 0.3)';
            }}
          >
            {/* Purple gradient background overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              borderRadius: '0 24px 0 100%',
              opacity: 1
            }} />

            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
              }}>
                <GraduationCap style={{ 
                  width: '40px', 
                  height: '40px', 
                  color: 'white' 
                }} />
              </div>

              <h2 style={{
                fontSize: '32px',
                fontWeight: '800',
                color: '#1e293b',
                marginBottom: '16px',
                lineHeight: '1.2'
              }}>
                Teacher
              </h2>
              
              <p style={{
                fontSize: '15px',
                color: '#64748b',
                lineHeight: '1.7',
                marginBottom: '24px',
                padding: '0 8px'
              }}>
                Access the teacher's portal to manage attendance, evaluations, and view lesson plans. Sign in with your official Google account.
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#667eea',
              fontWeight: '700',
              fontSize: '16px',
              marginTop: 'auto'
            }}>
              Continue as Teacher
              <ArrowRight style={{ width: '20px', height: '20px' }} />
            </div>
          </button>

          {/* Parent Card - Blue Theme */}
          <button
            onClick={() => navigate('/parent/auth')}
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              padding: '32px 28px',
              borderRadius: '24px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 40px rgba(14, 165, 233, 0.3)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '320px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(14, 165, 233, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(14, 165, 233, 0.3)';
            }}
          >
            {/* Blue gradient background overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'linear-gradient(135deg, #0ea5e915 0%, #06b6d415 100%)',
              borderRadius: '0 24px 0 100%',
              opacity: 1
            }} />

            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 8px 24px rgba(14, 165, 233, 0.4)'
              }}>
                <Users style={{ 
                  width: '40px', 
                  height: '40px', 
                  color: 'white' 
                }} />
              </div>

              <h2 style={{
                fontSize: '32px',
                fontWeight: '800',
                color: '#1e293b',
                marginBottom: '16px',
                lineHeight: '1.2'
              }}>
                Parent
              </h2>
              
              <p style={{
                fontSize: '15px',
                color: '#64748b',
                lineHeight: '1.7',
                marginBottom: '24px',
                padding: '0 8px'
              }}>
                Access the parent portal to view your child's catechism attendance and progress. Sign in with email or create a new account.
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#0ea5e9',
              fontWeight: '700',
              fontSize: '16px',
              marginTop: 'auto'
            }}>
              Continue as Parent
              <ArrowRight style={{ width: '20px', height: '20px' }} />
            </div>
          </button>
        </div>

        {/* Footer Text */}
        <p style={{
          textAlign: 'center',
          marginTop: '40px',
          color: 'rgba(255, 255, 255, 0.95)',
          fontSize: '14px',
          fontWeight: '500',
          animation: 'fadeIn 0.6s ease-out 0.8s both'
        }}>
          St John Maria Vianney Mission Cheam
        </p>
      </div>

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
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

          @media (max-width: 640px) {
            h1 {
              font-size: 28px !important;
            }
            
            h2 {
              font-size: 26px !important;
            }
            
            button > div:first-child > p {
              font-size: 14px !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default HomePage;