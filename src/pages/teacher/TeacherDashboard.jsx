import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';

const TeacherDashboard = () => {
  const { user } = useContext(AuthContext); 
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          classes:default_class_id (
            id,
            name,
            year_level,
            section
          )
        `)
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      if (!profileData.default_class_id) {
        toast.error('Your account is pending approval. Please contact an administrator.', {
          duration: 5000
        });
      }

    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeAttendance = () => {
    if (!profile?.default_class_id) {
      toast.error('You have not been assigned to a class yet. Please contact an administrator.');
      return;
    }
    navigate(`/teacher/attendance/${profile.default_class_id}`);
  };

  const handleEvaluation = () => {
    if (!profile?.default_class_id) {
      toast.error('You have not been assigned to a class yet. Please contact an administrator.');
      return;
    }
    navigate(`/teacher/evaluation/${profile.default_class_id}`);
  };

  const handlePublishResults = () => {
    if (!profile?.default_class_id) {
      toast.error('You have not been assigned to a class yet. Please contact an administrator.');
      return;
    }
    toast.info('Publish Results feature coming soon!');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #4CAF50',
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
      width: '100%',
      backgroundColor: '#f8f9fa',
      paddingTop: isMobile ? '100px' : '120px',
      paddingBottom: isMobile ? '80px' : '60px',
      paddingLeft: isMobile ? '16px' : '60px',
      paddingRight: isMobile ? '16px' : '60px',
      boxSizing: 'border-box',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start'
    }}>
      <div style={{
        maxWidth: isMobile ? '100%' : '900px',
        margin: '0 auto',
        width: '100%'
      }}>
      {/* Welcome Message */}
      <div style={{
        textAlign: 'center',
        marginBottom: isMobile ? '40px' : '48px'
      }}>
        <h1 style={{
          fontSize: isMobile ? '32px' : '40px',
          fontWeight: '800',
          color: '#1a1a1a',
          margin: '0 0 16px 0',
          lineHeight: 1.2
        }}>
          Welcome, {profile?.full_name || 'Teacher'}
        </h1>
        {profile?.classes && (
          <p style={{
            fontSize: isMobile ? '17px' : '20px',
            color: '#666',
            margin: 0,
            fontWeight: '500'
          }}>
            {profile.classes.name} Teacher
          </p>
        )}
        {!profile?.default_class_id && (
          <div style={{
            marginTop: isMobile ? '28px' : '32px',
            padding: isMobile ? '18px 20px' : '20px 24px',
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '16px',
            maxWidth: '100%'
          }}>
            <p style={{
              color: '#856404',
              fontSize: isMobile ? '15px' : '15px',
              margin: 0,
              lineHeight: '1.6',
              fontWeight: '500'
            }}>
              ⚠️ Your account is pending approval. You will be able to access the system once an administrator assigns you to a class.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '20px' : '24px',
        width: '100%'
      }}>
        <button
          onClick={handleTakeAttendance}
          disabled={!profile?.default_class_id}
          style={{
            padding: isMobile ? '20px 24px' : '24px 32px',
            backgroundColor: profile?.default_class_id ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            cursor: profile?.default_class_id ? 'pointer' : 'not-allowed',
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: '700',
            boxShadow: profile?.default_class_id ? '0 4px 16px rgba(76, 175, 80, 0.3)' : 'none',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            minHeight: isMobile ? '68px' : '72px',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            if (profile?.default_class_id) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 24px rgba(76, 175, 80, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = profile?.default_class_id ? '0 4px 16px rgba(76, 175, 80, 0.3)' : 'none';
          }}
        >
          <span style={{ fontSize: isMobile ? '26px' : '28px' }}>📋</span>
          Take Attendance
        </button>

        <button
          onClick={handleEvaluation}
          disabled={!profile?.default_class_id}
          style={{
            padding: isMobile ? '20px 24px' : '24px 32px',
            backgroundColor: profile?.default_class_id ? '#9C27B0' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            cursor: profile?.default_class_id ? 'pointer' : 'not-allowed',
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: '700',
            boxShadow: profile?.default_class_id ? '0 4px 16px rgba(156, 39, 176, 0.3)' : 'none',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            minHeight: isMobile ? '68px' : '72px',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            if (profile?.default_class_id) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 24px rgba(156, 39, 176, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = profile?.default_class_id ? '0 4px 16px rgba(156, 39, 176, 0.3)' : 'none';
          }}
        >
          <span style={{ fontSize: isMobile ? '26px' : '28px' }}>⭐</span>
          Lesson Evaluation
        </button>

        <button
          onClick={handlePublishResults}
          disabled={!profile?.default_class_id}
          style={{
            padding: isMobile ? '20px 24px' : '24px 32px',
            backgroundColor: profile?.default_class_id ? '#2196F3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            cursor: profile?.default_class_id ? 'pointer' : 'not-allowed',
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: '700',
            boxShadow: profile?.default_class_id ? '0 4px 16px rgba(33, 150, 243, 0.3)' : 'none',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            minHeight: isMobile ? '68px' : '72px',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            if (profile?.default_class_id) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 24px rgba(33, 150, 243, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = profile?.default_class_id ? '0 4px 16px rgba(33, 150, 243, 0.3)' : 'none';
          }}
        >
          <span style={{ fontSize: isMobile ? '26px' : '28px' }}>📊</span>
          Publish Results
        </button>
      </div>

      {/* Warning Message */}
      {!profile?.default_class_id && (
        <div style={{
          marginTop: isMobile ? '28px' : '32px',
          padding: isMobile ? '18px 20px' : '20px 24px',
          backgroundColor: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '16px',
          width: '100%'
        }}>
          <p style={{
            color: '#856404',
            fontSize: isMobile ? '15px' : '15px',
            margin: 0,
            lineHeight: '1.6',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            ⚠️ Your account is pending approval. You will be able to access the system once an administrator assigns you to a class.
          </p>
        </div>
      )}

      {/* Help Text */}
      {profile?.default_class_id && (
        <div style={{
          marginTop: isMobile ? '40px' : '48px',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: isMobile ? '14px' : '15px',
          fontWeight: '500'
        }}>
          <p style={{ margin: 0 }}>
            Click a button above to get started
          </p>
        </div>
      )}
      </div>
    </div>
  );
};

export default TeacherDashboard;