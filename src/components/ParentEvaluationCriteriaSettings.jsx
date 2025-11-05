import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, Unlock, Search, RefreshCw, Users, Settings } from 'lucide-react';
import {
  getAllParentsVisibility,
  adminUpdateParentVisibility,
  adminBulkUpdateParentVisibility,
  adminResetParentVisibility,
  adminToggleParentCategory
} from '../utils/parentEvaluationVisibilityUtils';

const ParentEvaluationCriteriaSettings = () => {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkSettings, setBulkSettings] = useState({
    show_homework: true,
    show_discipline: true,
    show_participation: true,
    show_behaviour: true
  });
  const [bulkOverride, setBulkOverride] = useState(false);

  const categories = [
    { key: 'show_homework', label: 'Homework' },
    { key: 'show_discipline', label: 'Discipline' },
    { key: 'show_participation', label: 'Participation' },
    { key: 'show_behaviour', label: 'Behaviour' }
  ];

  useEffect(() => {
    fetchParentsSettings();
  }, []);

  const fetchParentsSettings = async () => {
    setLoading(true);
    const data = await getAllParentsVisibility();
    setParents(data);
    setLoading(false);
  };

  const handleToggleCategory = async (parentId, settingKey, currentValue) => {
    const success = await adminToggleParentCategory(parentId, settingKey, currentValue);
    if (success) {
      setParents(prevParents =>
        prevParents.map(parent =>
          parent.parent_id === parentId
            ? { ...parent, [settingKey]: !currentValue }
            : parent
        )
      );
    }
  };

  const handleToggleOverride = async (parentId, currentOverride) => {
    const parent = parents.find(p => p.parent_id === parentId);
    if (!parent) return;

    const success = await adminUpdateParentVisibility(
      parentId,
      {
        show_homework: parent.show_homework,
        show_discipline: parent.show_discipline,
        show_participation: parent.show_participation,
        show_behaviour: parent.show_behaviour
      },
      !currentOverride
    );

    if (success) {
      setParents(prevParents =>
        prevParents.map(p =>
          p.parent_id === parentId
            ? { ...p, admin_override: !currentOverride }
            : p
        )
      );
    }
  };

  const handleResetParent = async (parentId) => {
    const success = await adminResetParentVisibility(parentId);
    if (success) {
      await fetchParentsSettings();
    }
  };

  const handleBulkUpdate = async () => {
    const success = await adminBulkUpdateParentVisibility(bulkSettings, bulkOverride);
    if (success) {
      await fetchParentsSettings();
    }
  };

  const filteredParents = parents.filter(parent => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      parent.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      parent.profiles?.email?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: parents.length,
    withOverride: parents.filter(p => p.admin_override).length,
    showingAll: parents.filter(p => 
      p.show_homework && p.show_discipline && p.show_participation && p.show_behaviour
    ).length
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: '#64748b'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #8b5cf6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }}/>
          <p>Loading parent settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '32px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Settings size={20} color="white" />
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#1e293b',
            margin: 0
          }}>
            Parent Evaluation Visibility Settings
          </h2>
        </div>
        <p style={{
          color: '#64748b',
          fontSize: '14px',
          margin: 0
        }}>
          Control which evaluation criteria parents can view for their children
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
          border: '2px solid #c4b5fd',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Users size={18} color="#8b5cf6" />
            <span style={{ fontSize: '13px', color: '#6b21a8', fontWeight: '500' }}>Total Parents</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#5b21b6', margin: 0 }}>
            {stats.total}
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid #fcd34d',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Lock size={18} color="#d97706" />
            <span style={{ fontSize: '13px', color: '#92400e', fontWeight: '500' }}>Locked Settings</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#b45309', margin: 0 }}>
            {stats.withOverride}
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
          border: '2px solid #86efac',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Eye size={18} color="#16a34a" />
            <span style={{ fontSize: '13px', color: '#14532d', fontWeight: '500' }}>All Visible</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#15803d', margin: 0 }}>
            {stats.showingAll}
          </p>
        </div>
      </div>

      {/* Bulk Update Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'white',
          border: '2px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}
      >
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1e293b',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <RefreshCw size={20} color="#8b5cf6" />
          Bulk Update All Parents
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '16px'
        }}>
          {categories.map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                background: bulkSettings[key] ? '#f5f3ff' : '#f8fafc',
                border: `2px solid ${bulkSettings[key] ? '#c4b5fd' : '#e2e8f0'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                checked={bulkSettings[key]}
                onChange={(e) => setBulkSettings({ ...bulkSettings, [key]: e.target.checked })}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#8b5cf6'
                }}
              />
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: bulkSettings[key] ? '#5b21b6' : '#64748b'
              }}>
                {label}
              </span>
            </label>
          ))}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: bulkOverride ? '#fef3c7' : '#f8fafc',
            border: `2px solid ${bulkOverride ? '#fcd34d' : '#e2e8f0'}`,
            borderRadius: '10px',
            cursor: 'pointer',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={bulkOverride}
              onChange={(e) => setBulkOverride(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: '#f59e0b'
              }}
            />
            <Lock size={16} color={bulkOverride ? '#d97706' : '#94a3b8'} />
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              color: bulkOverride ? '#92400e' : '#64748b'
            }}>
              Lock Settings (Admin Override)
            </span>
          </label>

          <button
            onClick={handleBulkUpdate}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.2s',
              boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <RefreshCw size={16} />
            Apply to All Parents
          </button>
        </div>
      </motion.div>

      {/* Search Bar */}
      <div style={{
        position: 'relative',
        marginBottom: '24px'
      }}>
        <Search
          size={20}
          color="#94a3b8"
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }}
        />
        <input
          type="text"
          placeholder="Search parents by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px 12px 48px',
            border: '2px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
        />
      </div>

      {/* Parents List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <AnimatePresence>
          {filteredParents.map((parent) => (
            <motion.div
              key={parent.parent_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                background: 'white',
                border: '2px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.borderColor = '#c4b5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              {/* Parent Info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1e293b',
                    margin: '0 0 4px 0'
                  }}>
                    {parent.profiles?.full_name || 'Unknown Parent'}
                  </h4>
                  <p style={{
                    fontSize: '13px',
                    color: '#64748b',
                    margin: 0
                  }}>
                    {parent.profiles?.email || 'No email'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleToggleOverride(parent.parent_id, parent.admin_override)}
                    style={{
                      padding: '8px 12px',
                      background: parent.admin_override ? '#fef3c7' : '#f8fafc',
                      border: `2px solid ${parent.admin_override ? '#fcd34d' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: parent.admin_override ? '#92400e' : '#64748b',
                      transition: 'all 0.2s'
                    }}
                    title={parent.admin_override ? 'Settings locked' : 'Settings unlocked'}
                  >
                    {parent.admin_override ? <Lock size={14} /> : <Unlock size={14} />}
                    {parent.admin_override ? 'Locked' : 'Unlocked'}
                  </button>

                  <button
                    onClick={() => handleResetParent(parent.parent_id)}
                    style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#64748b',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#f1f5f9';
                      e.target.style.borderColor = '#cbd5e1';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f8fafc';
                      e.target.style.borderColor = '#e2e8f0';
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Categories Toggle */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px'
              }}>
                {categories.map(({ key, label }) => {
                  const isVisible = parent[key];
                  return (
                    <button
                      key={key}
                      onClick={() => handleToggleCategory(parent.parent_id, key, isVisible)}
                      disabled={parent.admin_override}
                      style={{
                        padding: '12px',
                        background: isVisible ? 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' : '#f8fafc',
                        border: `2px solid ${isVisible ? '#c4b5fd' : '#e2e8f0'}`,
                        borderRadius: '10px',
                        cursor: parent.admin_override ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        transition: 'all 0.2s',
                        opacity: parent.admin_override ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!parent.admin_override) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: isVisible ? '#5b21b6' : '#94a3b8'
                      }}>
                        {label}
                      </span>
                      {isVisible ? (
                        <Eye size={16} color="#8b5cf6" />
                      ) : (
                        <EyeOff size={16} color="#cbd5e1" />
                      )}
                    </button>
                  );
                })}
              </div>

              {parent.admin_override && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px',
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Lock size={14} />
                  Settings locked by administrator
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredParents.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: '#94a3b8'
          }}>
            <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ fontSize: '16px', fontWeight: '500', margin: '0 0 8px 0' }}>
              No parents found
            </p>
            <p style={{ fontSize: '14px', margin: 0 }}>
              {searchTerm ? 'Try adjusting your search' : 'No parents have been added yet'}
            </p>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default ParentEvaluationCriteriaSettings;
