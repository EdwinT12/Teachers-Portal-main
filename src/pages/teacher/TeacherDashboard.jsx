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

      // Check if teacher has no class assigned
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
        minHeight: '80vh'
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

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Welcome Message */}
      <div style={{
        textAlign: 'center',
        marginBottom: '48px'
      }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: '700',
          color: '#1a1a1a',
          margin: '0 0 12px 0'
        }}>
          Welcome, {profile?.full_name || 'Teacher'}
        </h1>
        {profile?.classes && (
          <p style={{
            fontSize: '18px',
            color: '#666',
            margin: 0
          }}>
            {profile.classes.name} Teacher
          </p>
        )}
        {!profile?.default_class_id && (
          <div style={{
            marginTop: '20px',
            padding: '16px 24px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            maxWidth: '500px',
            margin: '20px auto 0'
          }}>
            <p style={{
              color: '#856404',
              fontSize: '14px',
              margin: 0,
              lineHeight: '1.5'
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
        gap: '24px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <button
          onClick={handleTakeAttendance}
          disabled={!profile?.default_class_id}
          style={{
            padding: '24px 32px',
            backgroundColor: profile?.default_class_id ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: profile?.default_class_id ? 'pointer' : 'not-allowed',
            fontSize: '20px',
            fontWeight: '600',
            boxShadow: profile?.default_class_id ? '0 4px 12px rgba(76, 175, 80, 0.3)' : 'none',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
          onMouseEnter={(e) => {
            if (profile?.default_class_id) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = profile?.default_class_id ? '0 4px 12px rgba(76, 175, 80, 0.3)' : 'none';
          }}
        >
          <span style={{ fontSize: '24px' }}>📋</span>
          Take Attendance
        </button>

        <button
          onClick={handleEvaluation}
          disabled={!profile?.default_class_id}
          style={{
            padding: '24px 32px',
            backgroundColor: profile?.default_class_id ? '#9C27B0' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: profile?.default_class_id ? 'pointer' : 'not-allowed',
            fontSize: '20px',
            fontWeight: '600',
            boxShadow: profile?.default_class_id ? '0 4px 12px rgba(156, 39, 176, 0.3)' : 'none',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
          onMouseEnter={(e) => {
            if (profile?.default_class_id) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(156, 39, 176, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = profile?.default_class_id ? '0 4px 12px rgba(156, 39, 176, 0.3)' : 'none';
          }}
        >
          <span style={{ fontSize: '24px' }}>⭐</span>
          Lesson Evaluation
        </button>

        <button
          onClick={handlePublishResults}
          disabled={!profile?.default_class_id}
          style={{
            padding: '24px 32px',
            backgroundColor: profile?.default_class_id ? '#2196F3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: profile?.default_class_id ? 'pointer' : 'not-allowed',
            fontSize: '20px',
            fontWeight: '600',
            boxShadow: profile?.default_class_id ? '0 4px 12px rgba(33, 150, 243, 0.3)' : 'none',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
          onMouseEnter={(e) => {
            if (profile?.default_class_id) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = profile?.default_class_id ? '0 4px 12px rgba(33, 150, 243, 0.3)' : 'none';
          }}
        >
          <span style={{ fontSize: '24px' }}>📊</span>
          Publish Results
        </button>
      </div>

      {/* Help Text */}
      {profile?.default_class_id && (
        <div style={{
          marginTop: '48px',
          textAlign: 'center',
          color: '#999',
          fontSize: '14px'
        }}>
          <p style={{ margin: 0 }}>
            Click a button above to get started
          </p>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
