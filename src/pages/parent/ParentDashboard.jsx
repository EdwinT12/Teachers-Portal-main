import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { 
  Calendar, 
  FileText, 
  Settings, 
  Users, 
  AlertCircle, 
  Clock,
  Award
} from 'lucide-react';

// Import child components
import AttendanceOverview from '../../components/parent/AttendanceOverview';
import AbsenceRequests from '../../components/parent/AbsenceRequests';
import TestResults from '../../components/parent/TestResults';
import ParentSettings from '../../components/parent/ParentSettings';
import EvaluationOverview from '../../components/parent/EvaluationOverview';

const ParentDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance');
  const [profile, setProfile] = useState(null);
  const [linkedChildren, setLinkedChildren] = useState([]);
  const [pendingChildren, setPendingChildren] = useState([]);
  const [brokenLinks, setBrokenLinks] = useState([]);
  const [showAllTiles, setShowAllTiles] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/parent/auth');
      return;
    }

    loadParentData();
  }, [user, navigate]);

  /**
   * Enhanced function to load parent data with resilient student matching
   */
  const loadParentData = async () => {
    try {
      setLoading(true);

      // Load parent profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load verified parent_children records
      const { data: parentChildrenData, error: parentChildrenError } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', user.id)
        .eq('verified', true)
        .not('student_id', 'is', null);

      if (parentChildrenError) throw parentChildrenError;

      // Process each parent_children record with resilient matching
      const enrichedChildren = [];
      const broken = [];
      
      for (const pc of parentChildrenData || []) {
        try {
          // First, try to fetch using student_id (the normal case)
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select(`
              id,
              student_name,
              class_id,
              classes:class_id (
                id,
                name,
                year_level
              )
            `)
            .eq('id', pc.student_id)
            .maybeSingle(); // Use maybeSingle instead of single to avoid error on no match

          if (studentData) {
            // Student found by ID - perfect!
            enrichedChildren.push({
              ...pc,
              students: studentData
            });
          } else {
            // Student not found by ID - try to match by name + class
            console.log(`Student ID ${pc.student_id} not found, attempting to rematch...`);
            
            const matchedStudent = await attemptStudentMatch(pc);
            
            if (matchedStudent) {
              // Found a match! Update the parent_children record
              await updateStudentLink(pc.id, matchedStudent.id);
              
              enrichedChildren.push({
                ...pc,
                students: matchedStudent,
                _wasRematched: true
              });
              
              toast.success(`Automatically re-linked ${pc.child_name_submitted}`, {
                duration: 3000
              });
            } else {
              // Could not find a match - mark as broken
              broken.push({
                ...pc,
                _studentNotFound: true
              });
              
              console.warn(`Could not find matching student for: ${pc.child_name_submitted} (Year ${pc.year_group})`);
            }
          }
        } catch (error) {
          console.error('Error processing parent-child link:', error);
          broken.push({
            ...pc,
            _error: error.message
          });
        }
      }

      setLinkedChildren(enrichedChildren);
      setBrokenLinks(broken);

      // Show warning if there are broken links
      if (broken.length > 0) {
        toast.error(
          `${broken.length} child${broken.length > 1 ? 'ren' : ''} could not be found. Please contact an administrator.`,
          { duration: 5000 }
        );
      }

      // Load pending children (not yet verified)
      const { data: pendingData, error: pendingError } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', user.id)
        .eq('verified', false);

      if (pendingError) throw pendingError;
      setPendingChildren(pendingData || []);

      // If no children at all, redirect to signup
      if (!enrichedChildren?.length && !pendingData?.length && !broken.length) {
        navigate('/parent/signup');
      }

    } catch (error) {
      console.error('Error loading parent data:', error);
      toast.error('Error loading your information');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Attempt to match a student by name and year/class
   */
  const attemptStudentMatch = async (parentChildRecord) => {
    try {
      // Strategy 1: Match by name + class_id (if class_id is set)
      if (parentChildRecord.class_id) {
        const { data: exactMatch, error: exactError } = await supabase
          .from('students')
          .select(`
            id,
            student_name,
            class_id,
            classes:class_id (
              id,
              name,
              year_level
            )
          `)
          .ilike('student_name', parentChildRecord.child_name_submitted.trim())
          .eq('class_id', parentChildRecord.class_id)
          .maybeSingle();

        if (exactMatch) {
          console.log('✓ Found exact match by name + class_id');
          return exactMatch;
        }
      }

      // Strategy 2: Match by name + year_level
      const { data: yearMatches, error: yearError } = await supabase
        .from('students')
        .select(`
          id,
          student_name,
          class_id,
          classes:class_id (
            id,
            name,
            year_level
          )
        `)
        .ilike('student_name', parentChildRecord.child_name_submitted.trim());

      if (yearMatches && yearMatches.length > 0) {
        // Filter by year level
        const matchingYear = yearMatches.filter(
          s => s.classes?.year_level === parentChildRecord.year_group
        );

        if (matchingYear.length === 1) {
          console.log('✓ Found unique match by name + year level');
          return matchingYear[0];
        } else if (matchingYear.length > 1) {
          console.warn('✗ Multiple students with same name in same year');
          // Return first match as a fallback, but this needs admin attention
          return matchingYear[0];
        }
      }

      // No match found
      return null;
    } catch (error) {
      console.error('Error in attemptStudentMatch:', error);
      return null;
    }
  };

  /**
   * Update the student_id in parent_children after successful rematch
   */
  const updateStudentLink = async (parentChildId, newStudentId) => {
    try {
      const { error } = await supabase
        .from('parent_children')
        .update({
          student_id: newStudentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', parentChildId);

      if (error) {
        console.error('Error updating student link:', error);
        throw error;
      }

      console.log(`✓ Updated parent_children record ${parentChildId} with student_id ${newStudentId}`);
    } catch (error) {
      console.error('Failed to update student link:', error);
    }
  };

  /**
   * Manual refresh function for users
   */
  const handleRefresh = async () => {
    toast.loading('Refreshing...', { id: 'refresh' });
    await loadParentData();
    toast.success('Refreshed!', { id: 'refresh' });
  };

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'evaluations', label: 'Evaluations', icon: Award },
    { id: 'absences', label: 'Absence Requests', icon: FileText },
    { id: 'results', label: 'Test Results', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            margin: '0 auto 16px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading your dashboard...</p>
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
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px',
      paddingTop: '88px', // Add extra top padding to account for fixed AppBar
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '24px',
          color: 'white'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '800',
            marginBottom: '8px'
          }}>
            Welcome, {profile?.full_name || 'Parent'}!
          </h1>
          <p style={{
            fontSize: '16px',
            opacity: 0.9,
            margin: 0
          }}>
            Track your {linkedChildren.length > 1 ? 'children\'s' : 'child\'s'} attendance, submit absence requests, and view test results
          </p>
        </div>

        {/* Broken Links Alert */}
        {brokenLinks.length > 0 && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertCircle style={{ width: '24px', height: '24px', color: '#dc2626', flexShrink: 0 }} />
            <div>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#7f1d1d',
                margin: '0 0 8px 0'
              }}>
                Unable to Load {brokenLinks.length} Child{brokenLinks.length > 1 ? 'ren' : ''}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#991b1b',
                margin: '0 0 12px 0',
                lineHeight: '1.5'
              }}>
                The following children could not be found in the system. This may happen after student data is updated. Please contact an administrator to re-link your account.
              </p>
              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '14px',
                color: '#991b1b'
              }}>
                {brokenLinks.map((link, index) => (
                  <li key={index}>
                    {link.child_name_submitted} (Year {link.year_group})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Pending Verification Alert */}
        {pendingChildren.length > 0 && (
          <div style={{
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Clock style={{ width: '24px', height: '24px', color: '#f59e0b', flexShrink: 0 }} />
            <div>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#92400e',
                margin: '0 0 4px 0'
              }}>
                Account Verification Pending
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#78350f',
                margin: 0,
                lineHeight: '1.5'
              }}>
                {pendingChildren.length} child{pendingChildren.length > 1 ? 'ren' : ''} pending admin verification. 
                You'll receive access once an admin links your account.
              </p>
            </div>
          </div>
        )}

        {/* No Verified Children Alert */}
        {linkedChildren.length === 0 && pendingChildren.length === 0 && brokenLinks.length === 0 && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertCircle style={{ width: '24px', height: '24px', color: '#dc2626', flexShrink: 0 }} />
            <div>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#7f1d1d',
                margin: '0 0 4px 0'
              }}>
                No Children Linked
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#991b1b',
                margin: 0,
                lineHeight: '1.5'
              }}>
                Please complete your registration to link your children.
              </p>
            </div>
          </div>
        )}

        {/* Children Cards - Dice-5 Layout */}
        {linkedChildren.length > 0 && (
          <div style={{
            maxWidth: '600px',
            margin: '0 auto 24px auto'
          }}>
            {/* Mobile: Simple vertical layout */}
            {window.innerWidth <= 768 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {linkedChildren.slice(0, 5).map((child, index) => (
                  <div key={child.id} style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: child._wasRematched ? '2px solid #10b981' : '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Users style={{ width: '18px', height: '18px', color: 'white' }} />
                    </div>
                    <div>
                      <h3 style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: '0 0 2px 0'
                      }}>
                        {child.students?.student_name || 'Student'}
                      </h3>
                      <p style={{
                        fontSize: '12px',
                        color: '#64748b',
                        margin: 0
                      }}>
                        {child.students?.classes?.name || `Year ${child.year_group}`}
                      </p>
                    </div>
                    {child._wasRematched && (
                      <div style={{
                        marginLeft: 'auto',
                        padding: '3px 6px',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        AUTO
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: Flexible grid layout */
              <div style={{
                display: 'grid',
                gridTemplateColumns: linkedChildren.length >= 3 ? 'repeat(3, 1fr)' : `repeat(${linkedChildren.length}, 1fr)`,
                gap: '16px',
                justifyItems: 'center'
              }}>
                {linkedChildren.slice(0, 5).map((child, index) => (
                  <div key={child.id} style={{
                    width: '180px',
                    height: '140px',
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    border: child._wasRematched ? '2px solid #10b981' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    position: 'relative'
                  }}>
                      {child._wasRematched && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          padding: '4px 8px',
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          AUTO
                        </div>
                      )}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px'
                      }}>
                        <Users style={{ width: '24px', height: '24px', color: 'white' }} />
                      </div>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1e293b',
                        margin: '0 0 4px 0',
                        lineHeight: '1.2',
                        textAlign: 'center'
                      }}>
                        {child.students?.student_name || 'Student'}
                      </h3>
                      <p style={{
                        fontSize: '13px',
                        color: '#64748b',
                        margin: 0,
                        lineHeight: '1.2',
                        textAlign: 'center'
                      }}>
                        {child.students?.classes?.name || `Year ${child.year_group}`}
                      </p>
                    </div>
                  ))
                }
              </div>
            )}
            
            {/* Additional children beyond 5 */}
            {linkedChildren.length > 5 && (
              <div style={{
                marginTop: window.innerWidth > 768 ? '20px' : '12px',
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  margin: '0 0 8px 0'
                }}>
                  Additional Children ({linkedChildren.length - 5})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {linkedChildren.slice(5).map((child) => (
                    <div key={child.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#64748b'
                    }}>
                      <Users style={{ width: '14px', height: '14px' }} />
                      <span>{child.students?.student_name || 'Student'} - {child.students?.classes?.name || `Year ${child.year_group}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area with Tabs */}
        {linkedChildren.length > 0 && (
          <>
            {/* Tab Navigation */}
            <div style={{
              background: 'white',
              borderRadius: '12px 12px 0 0',
              padding: '16px 24px',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              borderBottom: '2px solid #e2e8f0'
            }}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '12px 20px',
                      background: isActive ? '#667eea' : 'transparent',
                      color: isActive ? 'white' : '#64748b',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.target.style.background = '#f1f5f9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.target.style.background = 'transparent';
                      }
                    }}
                  >
                    <Icon style={{ width: '18px', height: '18px' }} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div style={{
              background: 'white',
              borderRadius: '0 0 12px 12px',
              padding: '24px',
              minHeight: '400px'
            }}>
              {activeTab === 'attendance' && (
                <AttendanceOverview linkedChildren={linkedChildren} />
              )}
              {activeTab === 'evaluations' && (
                <EvaluationOverview linkedChildren={linkedChildren} />
              )}
              {activeTab === 'absences' && (
                <AbsenceRequests linkedChildren={linkedChildren} onRequestSubmitted={loadParentData} />
              )}
              {activeTab === 'results' && (
                <TestResults linkedChildren={linkedChildren} />
              )}
              {activeTab === 'settings' && (
                <ParentSettings profile={profile} linkedChildren={linkedChildren} onUpdate={loadParentData} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;