import { useEffect, useState } from 'react';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { Calendar, Check, X, Clock, AlertCircle } from 'lucide-react';

const AttendanceOverview = ({ linkedChildren }) => {
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);
  const [showAllTiles, setShowAllTiles] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);

  useEffect(() => {
    if (linkedChildren && linkedChildren.length > 0) {
      setSelectedChild(linkedChildren[0].students?.id);
      loadAttendanceData();
    }
  }, [linkedChildren]);

  const loadAttendanceData = async () => {
    if (!linkedChildren || linkedChildren.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = {};

      for (const child of linkedChildren) {
        if (!child.students?.id) continue;

        const { data: records, error } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('student_id', child.students.id)
          .order('attendance_date', { ascending: false })
          .limit(30); // Last 30 records

        if (error) throw error;

        // Calculate stats
        const total = records.length;
        const present = records.filter(r => r.status === 'P').length;
        const late = records.filter(r => r.status === 'L').length;
        const excused = records.filter(r => r.status === 'E').length;
        const unexcused = records.filter(r => r.status === 'U').length;
        const unattendedMass = records.filter(r => r.status === 'UM').length; // Present for catechism, missed mass
        
        // For catechism attendance: P, L, and UM all count as "present for catechism"
        const presentForCatechism = present + late + unattendedMass;

        data[child.students.id] = {
          records,
          stats: {
            total,
            present,
            late,
            excused,
            unexcused,
            unattendedMass,
            presentForCatechism,
            attendanceRate: total > 0 ? Math.round((presentForCatechism / total) * 100) : 0
          }
        };
      }

      setAttendanceData(data);
    } catch (error) {
      console.error('Error loading attendance:', error);
      toast.error('Error loading attendance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'P': { label: 'Present', color: '#10b981', icon: Check },
      'L': { label: 'Late', color: '#f59e0b', icon: Clock },
      'E': { label: 'Excused', color: '#3b82f6', icon: AlertCircle },
      'U': { label: 'Unexcused', color: '#ef4444', icon: X },
      'UM': { label: 'Unattended Mass', color: '#8b5cf6', icon: AlertCircle } // Purple color for UM
    };
    return statusMap[status] || statusMap['U'];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          margin: '0 auto 16px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading attendance data...</p>
      </div>
    );
  }

  const currentChild = linkedChildren.find(c => c.students?.id === selectedChild);
  const currentData = attendanceData[selectedChild];

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
        <Calendar style={{ width: '28px', height: '28px', color: '#667eea' }} />
        Attendance Overview
      </h2>

      {/* Child Selector (if multiple children) */}
      {linkedChildren.length > 1 && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#475569',
            marginBottom: '8px'
          }}>
            Select Child
          </label>
          <select
            value={selectedChild || ''}
            onChange={(e) => setSelectedChild(e.target.value)}
            style={{
              padding: '12px 16px',
              fontSize: '15px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              outline: 'none',
              cursor: 'pointer',
              background: 'white',
              minWidth: '250px'
            }}
          >
            {linkedChildren.map((child) => (
              <option key={child.id} value={child.students?.id}>
                {child.students?.student_name} - {child.students?.classes?.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentData && (
        <>
          {/* Two Column Layout: Stats on Left, History on Right */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1.5fr',
            gap: '24px',
            alignItems: 'start'
          }}>
            {/* Left Column: Student Name & Stats */}
            <div>
              {/* Student Name Card */}
              <div style={{
                padding: '24px',
                background: 'white',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  margin: '0 auto 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '32px',
                  fontWeight: '700'
                }}>
                  {currentChild?.students?.student_name?.charAt(0) || 'S'}
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: '0 0 4px 0'
                }}>
                  {currentChild?.students?.student_name}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: 0
                }}>
                  {currentChild?.students?.classes?.name || `Year ${currentChild?.year_group}`}
                </p>
              </div>

              {/* Attendance Rate Tile */}
              <div 
                onClick={() => setShowAllTiles(!showAllTiles)}
                style={{
                  padding: '32px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  marginBottom: '16px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                }}
              >
                <div style={{
                  fontSize: '56px',
                  fontWeight: '800',
                  marginBottom: '8px',
                  lineHeight: 1
                }}>
                  {currentData.stats.attendanceRate}%
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  opacity: 0.9,
                  marginBottom: '8px'
                }}>
                  Catechism Attendance
                </div>
                <div style={{
                  fontSize: '13px',
                  opacity: 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  {showAllTiles ? 'Hide details' : 'View details'}
                  <span style={{
                    transform: showAllTiles ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Expanded Stats Cards */}
              {showAllTiles && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  opacity: 0,
                  animation: 'slideInUp 0.3s ease 0.1s forwards'
                }}>
                  <div style={{
                    padding: '16px',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    border: '2px solid #86efac',
                    textAlign: 'center',
                    opacity: 0,
                    animation: 'fadeInScale 0.3s ease 0.2s forwards'
                  }}>
                    <div style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#16a34a',
                      marginBottom: '4px'
                    }}>
                      {currentData.stats.present}
                    </div>
                    <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
                      Present
                    </div>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    border: '2px solid #fcd34d',
                    textAlign: 'center',
                    opacity: 0,
                    animation: 'fadeInScale 0.3s ease 0.3s forwards'
                  }}>
                    <div style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#d97706',
                      marginBottom: '4px'
                    }}>
                      {currentData.stats.late}
                    </div>
                    <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '600' }}>
                      Late
                    </div>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: '#dbeafe',
                    borderRadius: '8px',
                    border: '2px solid #93c5fd',
                    textAlign: 'center',
                    opacity: 0,
                    animation: 'fadeInScale 0.3s ease 0.4s forwards'
                  }}>
                    <div style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#2563eb',
                      marginBottom: '4px'
                    }}>
                      {currentData.stats.excused}
                    </div>
                    <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>
                      Excused
                    </div>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: '#f3e8ff',
                    borderRadius: '8px',
                    border: '2px solid #c4b5fd',
                    textAlign: 'center',
                    opacity: 0,
                    animation: 'fadeInScale 0.3s ease 0.5s forwards'
                  }}>
                    <div style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#8b5cf6',
                      marginBottom: '4px'
                    }}>
                      {currentData.stats.unattendedMass}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '600' }}>
                      Unattended Mass
                    </div>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: '#fee2e2',
                    borderRadius: '8px',
                    border: '2px solid #fca5a5',
                    textAlign: 'center',
                    gridColumn: '1 / -1',
                    opacity: 0,
                    animation: 'fadeInScale 0.3s ease 0.6s forwards'
                  }}>
                    <div style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#dc2626',
                      marginBottom: '4px'
                    }}>
                      {currentData.stats.unexcused}
                    </div>
                    <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '600' }}>
                      Unexcused
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Recent Records */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0
                }}>
                  Recent Attendance
                </h3>
                <div style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>
                  {showAllRecords ? `Showing all ${currentData.records.length}` : `Showing last 5 of ${currentData.records.length}`}
                </div>
              </div>

            {currentData.records.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '2px dashed #cbd5e1'
              }}>
                <Calendar style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No attendance records yet</p>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gap: '12px',
                  marginBottom: currentData.records.length > 5 ? '16px' : '0'
                }}>
                  {(showAllRecords ? currentData.records : currentData.records.slice(0, 5)).map((record) => {
                    const statusInfo = getStatusInfo(record.status);
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <div key={record.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            background: `${statusInfo.color}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <StatusIcon style={{ width: '20px', height: '20px', color: statusInfo.color }} />
                          </div>
                          <div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>
                              {formatDate(record.attendance_date)}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b'
                            }}>
                              {record.column_identifier}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: statusInfo.color,
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {statusInfo.label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* View More / View Less Button */}
                {currentData.records.length > 5 && (
                  <button
                    onClick={() => setShowAllRecords(!showAllRecords)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'white',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      color: '#667eea',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#667eea';
                      e.currentTarget.style.color = 'white';
                      e.currentTarget.style.borderColor = '#667eea';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = '#667eea';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    {showAllRecords ? (
                      <>
                        Show Less
                        <span style={{
                          transform: 'rotate(180deg)',
                          transition: 'transform 0.2s ease'
                        }}>▼</span>
                      </>
                    ) : (
                      <>
                        View More ({currentData.records.length - 5} more records)
                        <span>▼</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
            </div>
          </div>
        </>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes fadeInScale {
            0% { 
              opacity: 0; 
              transform: scale(0.8); 
            }
            100% { 
              opacity: 1; 
              transform: scale(1); 
            }
          }
          @keyframes slideInUp {
            0% { 
              opacity: 0; 
              transform: translateY(20px); 
            }
            100% { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
        `}
      </style>
    </div>
  );
};

export default AttendanceOverview;