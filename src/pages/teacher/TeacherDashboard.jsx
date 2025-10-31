import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import AbsenceRequestsManager from '../../components/AbsenceRequestsManager';

const TeacherDashboard = () => {
  const { user } = useContext(AuthContext); 
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showAbsenceManager, setShowAbsenceManager] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

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

  useEffect(() => {
    if (profile?.default_class_id) {
      loadPendingRequestsCount();
    }
  }, [profile]);

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

  const loadPendingRequestsCount = async () => {
    try {
      // Get students in the teacher's class
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', profile.default_class_id);

      if (studentsError) throw studentsError;

      const studentIds = students.map(s => s.id);

      if (studentIds.length === 0) {
        setPendingRequestsCount(0);
        return;
      }

      // Count pending absence requests
      const { count, error: countError } = await supabase
        .from('absence_requests')
        .select('*', { count: 'exact', head: true })
        .in('student_id', studentIds)
        .eq('status', 'pending');

      if (countError) throw countError;

      setPendingRequestsCount(count || 0);
    } catch (error) {
      console.error('Error loading pending requests count:', error);
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

  const handleAbsenceRequests = () => {
    if (!profile?.default_class_id) {
      toast.error('You have not been assigned to a class yet. Please contact an administrator.');
      return;
    }
    setShowAbsenceManager(true);
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

  // If showing absence manager, render that instead
  if (showAbsenceManager) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#f8f9fa',
        paddingTop: isMobile ? '100px' : '120px',
        paddingBottom: isMobile ? '80px' : '60px',
        paddingLeft: isMobile ? '16px' : '60px',
        paddingRight: isMobile ? '16px' : '60px',
        boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%'
        }}>
          {/* Back Button */}
          <button
            onClick={() => {
              setShowAbsenceManager(false);
              loadPendingRequestsCount(); // Refresh count when going back
            }}
            style={{
              marginBottom: '24px',
              padding: '12px 24px',
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f9fafb';
              e.target.style.borderColor = '#d1d5db';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'white';
              e.target.style.borderColor = '#e5e7eb';
            }}
          >
            ← Back to Dashboard
          </button>

          {/* Absence Requests Manager */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: isMobile ? '24px' : '32px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <AbsenceRequestsManager 
              classId={profile.default_class_id}
              userId={user.id}
            />
          </div>
        </div>
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

        {/* Pending Requests Alert */}
        {profile?.default_class_id && pendingRequestsCount > 0 && (
          <div style={{
            marginBottom: isMobile ? '24px' : '28px',
            padding: isMobile ? '16px 20px' : '18px 24px',
            backgroundColor: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(251, 191, 36, 0.2)'
          }}
          onClick={handleAbsenceRequests}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.2)';
          }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>⏰</span>
              <div>
                <p style={{
                  color: '#92400e',
                  fontSize: isMobile ? '15px' : '16px',
                  margin: 0,
                  fontWeight: '700'
                }}>
                  {pendingRequestsCount} Absence Request{pendingRequestsCount !== 1 ? 's' : ''} Pending
                </p>
                <p style={{
                  color: '#78350f',
                  fontSize: isMobile ? '13px' : '14px',
                  margin: '4px 0 0 0',
                  fontWeight: '500'
                }}>
                  Click to review and approve
                </p>
              </div>
            </div>
            <span style={{
              fontSize: '20px',
              color: '#92400e'
            }}>
              →
            </span>
          </div>
        )}

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

          {/* Absence Requests Button */}
          <button
            onClick={handleAbsenceRequests}
            disabled={!profile?.default_class_id}
            style={{
              padding: isMobile ? '20px 24px' : '24px 32px',
              backgroundColor: profile?.default_class_id ? '#FF9800' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              cursor: profile?.default_class_id ? 'pointer' : 'not-allowed',
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: '700',
              boxShadow: profile?.default_class_id ? '0 4px 16px rgba(255, 152, 0, 0.3)' : 'none',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              minHeight: isMobile ? '68px' : '72px',
              width: '100%',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (profile?.default_class_id) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 24px rgba(255, 152, 0, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = profile?.default_class_id ? '0 4px 16px rgba(255, 152, 0, 0.3)' : 'none';
            }}
          >
            <span style={{ fontSize: isMobile ? '26px' : '28px' }}>📨</span>
            Absence Requests
            {pendingRequestsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: isMobile ? '12px' : '16px',
                right: isMobile ? '12px' : '16px',
                backgroundColor: '#dc2626',
                color: 'white',
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '700',
                padding: '4px 10px',
                borderRadius: '12px',
                minWidth: '24px',
                textAlign: 'center'
              }}>
                {pendingRequestsCount}
              </span>
            )}
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