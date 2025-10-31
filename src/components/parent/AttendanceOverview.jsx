import { useEffect, useState } from 'react';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { Calendar, Check, X, Clock, AlertCircle } from 'lucide-react';

const AttendanceOverview = ({ linkedChildren }) => {
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);
  const [showAllTiles, setShowAllTiles] = useState(false);

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
          {/* Expandable Stats Cards */}
          <div style={{ marginBottom: '32px' }}>
            {/* Default Attendance Rate Tile */}
            <div 
              onClick={() => setShowAllTiles(!showAllTiles)}
              style={{
                padding: '24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                maxWidth: '300px',
                margin: '0 auto'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }}
            >
              <div style={{
                fontSize: '48px',
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
                marginBottom: '4px'
              }}>
                Catechism Attendance
              </div>
              <div style={{
                fontSize: '13px',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {showAllTiles ? 'Click to collapse' : 'Click to view details'}
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '14px',
                marginTop: '20px',
                opacity: 0,
                animation: 'slideInUp 0.3s ease 0.1s forwards'
              }}>
                <div style={{
                  padding: '20px',
                  background: '#f0fdf4',
                  borderRadius: '12px',
                  border: '2px solid #86efac',
                  opacity: 0,
                  animation: 'fadeInScale 0.3s ease 0.2s forwards'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    color: '#16a34a',
                    marginBottom: '4px'
                  }}>
                    {currentData.stats.present}
                  </div>
                  <div style={{ fontSize: '13px', color: '#15803d', fontWeight: '600' }}>
                    Present
                  </div>
                </div>

                <div style={{
                  padding: '20px',
                  background: '#fef3c7',
                  borderRadius: '12px',
                  border: '2px solid #fcd34d',
                  opacity: 0,
                  animation: 'fadeInScale 0.3s ease 0.3s forwards'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    color: '#d97706',
                    marginBottom: '4px'
                  }}>
                    {currentData.stats.late}
                  </div>
                  <div style={{ fontSize: '13px', color: '#b45309', fontWeight: '600' }}>
                    Late
                  </div>
                </div>

                <div style={{
                  padding: '20px',
                  background: '#dbeafe',
                  borderRadius: '12px',
                  border: '2px solid #93c5fd',
                  opacity: 0,
                  animation: 'fadeInScale 0.3s ease 0.4s forwards'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    color: '#2563eb',
                    marginBottom: '4px'
                  }}>
                    {currentData.stats.excused}
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>
                    Excused
                  </div>
                </div>

                <div style={{
                  padding: '20px',
                  background: '#f3e8ff',
                  borderRadius: '12px',
                  border: '2px solid #c4b5fd',
                  opacity: 0,
                  animation: 'fadeInScale 0.3s ease 0.5s forwards'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    color: '#8b5cf6',
                    marginBottom: '4px'
                  }}>
                    {currentData.stats.unattendedMass}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7c3aed', fontWeight: '600' }}>
                    Unattended Mass
                  </div>
                </div>

                <div style={{
                  padding: '20px',
                  background: '#fee2e2',
                  borderRadius: '12px',
                  border: '2px solid #fca5a5',
                  opacity: 0,
                  animation: 'fadeInScale 0.3s ease 0.6s forwards'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    color: '#dc2626',
                    marginBottom: '4px'
                  }}>
                    {currentData.stats.unexcused}
                  </div>
                  <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>
                    Unexcused
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Records */}
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '16px'
            }}>
              Recent Attendance (Last 30 Records)
            </h3>

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
              <div style={{
                display: 'grid',
                gap: '12px'
              }}>
                {currentData.records.map((record) => {
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
                      border: '1px solid #e2e8f0'
                    }}>
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
            )}
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