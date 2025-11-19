import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { UserPlus, Users, CheckCircle } from 'lucide-react';
import emailjs from '@emailjs/browser';

// EmailJS configuration
const EMAILJS_SERVICE_ID = 'service_77lcszr';
const EMAILJS_TEMPLATE_ID = 'template_litvhfj';
const EMAILJS_PUBLIC_KEY = 'fWof-EcizNlRVj-Lw';

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

const ParentSignUp = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState([{ name: '', yearGroup: '' }]);
  const [existingProfile, setExistingProfile] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/parent/auth');
      return;
    }

    checkExistingProfile();
  }, [user, navigate]);

  const checkExistingProfile = async () => {
    try {
      // Fetch the profile with parent_children relationship
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*, parent_children!parent_children_parent_id_fkey(*)')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (profile) {
        setExistingProfile(profile);
        
        // If parent already has linked children, redirect to dashboard
        if (profile.parent_children && profile.parent_children.length > 0) {
          toast.success('Welcome back!');
          navigate('/parent');
          return;
        }

        // Verify profile has correct parent role
        if (profile.role !== 'parent') {
          console.warn('Profile role is not parent, fixing...', profile.role);
          
          // Fix the role
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              role: 'parent',
              roles: ['parent']
            })
            .eq('id', user.id);
          
          if (updateError) {
            console.error('Error updating profile role:', updateError);
            toast.error('Error updating profile. Please contact an administrator.');
          } else {
            console.log('Profile role updated to parent successfully');
          }
        }
      } else {
        // This shouldn't happen if the trigger worked, but handle it just in case
        console.warn('No profile found for user, creating one...');
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email.split('@')[0],
            role: 'parent',
            roles: ['parent']
          });

        if (insertError && insertError.code !== '23505') {
          console.error('Error creating profile:', insertError);
          toast.error('Error creating profile. Please contact an administrator.');
        } else {
          console.log('New parent profile created successfully');
        }
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      toast.error('Error loading profile');
    }
  };

  const addChild = () => {
    setChildren([...children, { name: '', yearGroup: '' }]);
  };

  const removeChild = (index) => {
    if (children.length > 1) {
      setChildren(children.filter((_, i) => i !== index));
    }
  };

  const updateChild = (index, field, value) => {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  };

  // Function to get year group display name
  const getYearGroupName = (yearGroup) => {
    if (yearGroup === '0') return 'Reception';
    return `Year ${yearGroup}`;
  };

  // Function to send email notification to admin users
  const notifyAdminUsers = async (parentEmail, parentName, childrenData) => {
    try {
      console.log('Starting admin notification process...');
      
      // Fetch all admin users from the profiles table
      const { data: adminUsers, error } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('role', 'admin')
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching admin users:', error);
        return;
      }

      console.log('Admin users found:', adminUsers);

      if (!adminUsers || adminUsers.length === 0) {
        console.warn('No admin users found to notify');
        return;
      }

      // Format children information for email
      const childrenList = childrenData.map(child => 
        `• ${child.name.trim()} - ${getYearGroupName(child.yearGroup)}`
      ).join('\n');

      // Send email to each admin
      for (const admin of adminUsers) {
        const templateParams = {
          to_email: admin.email,
          to_name: admin.full_name || 'Admin',
          parent_email: parentEmail,
          parent_name: parentName,
          children_list: childrenList,
          children_count: childrenData.length,
          registration_date: new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        };

        console.log('Sending email to:', admin.email);
        console.log('Template params:', templateParams);

        try {
          const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams,
            EMAILJS_PUBLIC_KEY
          );
          console.log('Email sent successfully to', admin.email, response);
        } catch (emailError) {
          console.error('Failed to send email to', admin.email, emailError);
        }
      }

      console.log(`Email notification process completed for ${adminUsers.length} admin(s)`);
    } catch (error) {
      console.error('Error in notifyAdminUsers:', error);
      // Don't throw - email notification failure shouldn't block registration
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all children have names and year groups
    const invalidChildren = children.filter(child => !child.name.trim() || !child.yearGroup);
    if (invalidChildren.length > 0) {
      toast.error('Please fill in all child information');
      return;
    }

    setLoading(true);

    try {
      // Create parent-child link records with student_id as null (to be linked by admin)
      const childRecords = children.map(child => ({
        parent_id: user.id,
        child_name_submitted: child.name.trim(),
        year_group: parseInt(child.yearGroup),
        verified: false,
        student_id: null // NULL until admin verifies and links
      }));

      const { error: insertError } = await supabase
        .from('parent_children')
        .insert(childRecords);

      if (insertError) {
        throw insertError;
      }

      // Send email notification to admin users
      const parentName = user.user_metadata?.full_name || user.email.split('@')[0];
      await notifyAdminUsers(user.email, parentName, children);

      toast.success('Registration submitted! An admin will verify your account soon.');
      navigate('/parent');
    } catch (error) {
      console.error('Error submitting registration:', error);
      toast.error('Error submitting registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserPlus style={{ width: '40px', height: '40px', color: 'white' }} />
            </div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#1e293b',
              marginBottom: '8px'
            }}>
              Complete Your Registration
            </h1>
            <p style={{
              fontSize: '15px',
              color: '#64748b',
              lineHeight: '1.6'
            }}>
              Please provide your child's information. An admin will verify and link your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {children.map((child, index) => (
              <div key={index} style={{
                marginBottom: '24px',
                padding: '24px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '2px solid #e2e8f0'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#334155',
                    margin: 0
                  }}>
                    Child {index + 1}
                  </h3>
                  {children.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChild(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        padding: '4px 8px'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '8px'
                  }}>
                    Child's Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={child.name}
                    onChange={(e) => updateChild(index, 'name', e.target.value)}
                    placeholder="Enter child's full name"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '8px'
                  }}>
                    Year Group *
                  </label>
                  <select
                    required
                    value={child.yearGroup}
                    onChange={(e) => updateChild(index, 'yearGroup', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      background: 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  >
                    <option value="">Select year group</option>
                    <option value="0">Reception</option>
                    <option value="1">Year 1</option>
                    <option value="2">Year 2</option>
                    <option value="3">Year 3</option>
                    <option value="4">Year 4</option>
                    <option value="5">Year 5</option>
                    <option value="6">Year 6</option>
                    <option value="7">Year 7</option>
                    <option value="8">Year 8</option>
                    <option value="9">Year 9</option>
                    <option value="10">Year 10</option>
                    <option value="11">Year 11</option>
                    <option value="12">Year 12</option>
                  </select>
                </div>
              </div>
            ))}

            {/* Add Another Child Button */}
            <button
              type="button"
              onClick={addChild}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '24px',
                background: 'white',
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                color: '#667eea',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = '#cbd5e1';
                e.target.style.background = 'white';
              }}
            >
              <Users style={{ width: '20px', height: '20px' }} />
              Add Another Child
            </button>

            {/* Info Note */}
            <div style={{
              padding: '16px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              marginBottom: '24px'
            }}>
              <p style={{
                fontSize: '13px',
                color: '#1e40af',
                margin: 0,
                lineHeight: '1.6'
              }}>
                <strong>Privacy Note:</strong> Your child's name will be verified by an admin and securely linked to their catechism records. You'll be notified once verification is complete.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle style={{ width: '20px', height: '20px' }} />
                  Complete Registration
                </>
              )}
            </button>
          </form>
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

export default ParentSignUp;