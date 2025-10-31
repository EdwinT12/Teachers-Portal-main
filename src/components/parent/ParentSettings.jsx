import { useState } from 'react';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { Settings, User, Mail, Users, CheckCircle, Clock, Plus, Trash2, X } from 'lucide-react';

const ParentSettings = ({ profile, linkedChildren, onUpdate }) => {
  const [updating, setUpdating] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  
  // For adding new child
  const [newChild, setNewChild] = useState({
    name: '',
    yearGroup: ''
  });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setUpdating(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error updating profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddChild = async () => {
    if (!newChild.name.trim() || !newChild.yearGroup) {
      toast.error('Please fill in all fields');
      return;
    }

    setUpdating(true);

    try {
      const { error } = await supabase
        .from('parent_children')
        .insert({
          parent_id: profile.id,
          child_name_submitted: newChild.name.trim(),
          year_group: parseInt(newChild.yearGroup),
          verified: false,
          student_id: null
        });

      if (error) throw error;

      toast.success('Child added! Awaiting admin verification.');
      setShowAddModal(false);
      setNewChild({ name: '', yearGroup: '' });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error('Error adding child');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteChild = async (childId, childName) => {
    if (!window.confirm(`Are you sure you want to remove ${childName} from your account?`)) {
      return;
    }

    setDeleting(childId);

    try {
      const { error } = await supabase
        .from('parent_children')
        .delete()
        .eq('id', childId)
        .eq('parent_id', profile.id); // Security: ensure parent owns this record

      if (error) throw error;

      toast.success('Child removed from your account');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting child:', error);
      toast.error('Error removing child');
    } finally {
      setDeleting(null);
    }
  };

  const yearOptions = [
    { value: 'R', label: 'Reception' },
    { value: '1', label: 'Year 1' },
    { value: '2', label: 'Year 2' },
    { value: '3', label: 'Year 3' },
    { value: '4', label: 'Year 4' },
    { value: '5', label: 'Year 5' },
    { value: '6', label: 'Year 6' },
    { value: '7', label: 'Year 7' },
    { value: '8', label: 'Year 8' },
    { value: '9', label: 'Year 9' },
    { value: '10', label: 'Year 10' },
    { value: '11', label: 'Year 11' },
    { value: '12', label: 'Year 12' }
  ];

  return (
    <div>
      <h2 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <Settings style={{ width: '28px', height: '28px', color: '#667eea' }} />
        Settings
      </h2>

      {/* Profile Information */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '2px solid #e2e8f0'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '20px'
        }}>
          Profile Information
        </h3>

        <form onSubmit={handleUpdateProfile}>
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
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '8px'
            }}>
              Email Address
            </label>
            <div style={{
              padding: '12px 16px',
              background: '#e2e8f0',
              borderRadius: '8px',
              fontSize: '15px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Mail style={{ width: '18px', height: '18px' }} />
              {profile?.email}
            </div>
            <p style={{
              fontSize: '12px',
              color: '#64748b',
              margin: '6px 0 0 0'
            }}>
              Email cannot be changed. Please contact an administrator if needed.
            </p>
          </div>

          <button
            type="submit"
            disabled={updating}
            style={{
              padding: '12px 24px',
              background: updating ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: updating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {updating ? 'Updating...' : 'Update Profile'}
          </button>
        </form>
      </div>

      {/* Manage Children */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '24px',
        border: '2px solid #e2e8f0'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Users style={{ width: '22px', height: '22px' }} />
            My Children
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Add Child
          </button>
        </div>

        {linkedChildren.length === 0 ? (
          <div style={{
            padding: '40px 32px',
            textAlign: 'center',
            color: '#64748b',
            background: 'white',
            borderRadius: '8px',
            border: '2px dashed #cbd5e1'
          }}>
            <Users style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '600' }}>No children linked yet</p>
            <p style={{ margin: 0, fontSize: '13px' }}>Click "Add Child" above to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {linkedChildren.map((child) => (
              <div key={child.id} style={{
                background: 'white',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1e293b',
                    marginBottom: '4px'
                  }}>
                    {child.verified ? child.students?.student_name : child.child_name_submitted}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#64748b'
                  }}>
                    {child.verified 
                      ? (child.students?.classes?.name || `Year ${child.year_group}`)
                      : `Year ${child.year_group} • Awaiting verification`
                    }
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: child.verified ? '#d1fae5' : '#fef3c7',
                    borderRadius: '6px'
                  }}>
                    {child.verified ? (
                      <>
                        <CheckCircle style={{ width: '16px', height: '16px', color: '#10b981' }} />
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#059669'
                        }}>
                          Verified
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#d97706'
                        }}>
                          Pending
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteChild(
                      child.id, 
                      child.verified ? child.students?.student_name : child.child_name_submitted
                    )}
                    disabled={deleting === child.id}
                    style={{
                      padding: '8px',
                      background: deleting === child.id ? '#fecaca' : '#fee2e2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      cursor: deleting === child.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    title="Remove child"
                    onMouseEnter={(e) => {
                      if (deleting !== child.id) {
                        e.target.style.background = '#fecaca';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (deleting !== child.id) {
                        e.target.style.background = '#fee2e2';
                      }
                    }}
                  >
                    <Trash2 style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px'
        }}>
          <p style={{
            fontSize: '13px',
            color: '#1e40af',
            margin: 0,
            lineHeight: '1.6'
          }}>
            <strong>ℹ️ How it works:</strong> When you add a child, an administrator will verify and link them to the correct student record in our system. You'll see the status change from "Pending" to "Verified" once complete.
          </p>
        </div>
      </div>

      {/* Add Child Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>
                Add Child
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewChild({ name: '', yearGroup: '' });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b'
                }}
              >
                <X style={{ width: '24px', height: '24px' }} />
              </button>
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
                value={newChild.name}
                onChange={(e) => setNewChild({ ...newChild, name: e.target.value })}
                placeholder="Enter child's full name"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
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
                value={newChild.yearGroup}
                onChange={(e) => setNewChild({ ...newChild, yearGroup: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  cursor: 'pointer',
                  background: 'white',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              >
                <option value="">Select year group</option>
                {yearOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{
              padding: '14px',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <p style={{
                fontSize: '13px',
                color: '#92400e',
                margin: 0,
                lineHeight: '1.6'
              }}>
                <strong>⏳ Verification Required:</strong> An administrator will review and verify your child's information before linking them to their catechism records.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleAddChild}
                disabled={updating}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: updating ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: updating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {updating ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus style={{ width: '18px', height: '18px' }} />
                    Add Child
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewChild({ name: '', yearGroup: '' });
                }}
                disabled={updating}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: updating ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

export default ParentSettings;