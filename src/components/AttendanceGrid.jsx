import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import supabase from '../utils/supabase';
import { batchSyncAttendance } from '../utils/googleSheetsAPI';
import toast from 'react-hot-toast';
import { Save, Loader, CheckCircle2, XCircle, Clock, HelpCircle, AlertCircle, Search, Filter, Church, ChevronRight, ChevronLeft } from 'lucide-react';

const AttendanceGrid = ({ students, weeks, attendanceData, classId, teacherId, onDataUpdate }) => {
  const [editMode, setEditMode] = useState(false);
  const [localAttendance, setLocalAttendance] = useState({});
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Hide scroll hint after user scrolls
  useEffect(() => {
    if (!isMobile) return;
    
    const handleScroll = () => {
      setShowScrollHint(false);
    };
    
    const container = document.getElementById('attendance-scroll-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [isMobile]);

  const getAttendanceStatus = (studentId, weekDate) => {
    const localKey = `${studentId}|${weekDate}`;
    if (localKey in localAttendance) {
      return localAttendance[localKey];
    }
    const attendanceKey = `${studentId}-${weekDate}`;
    const record = attendanceData[attendanceKey];
    return record?.status || '';
  };

  const handleCellClick = (studentId, weekDate, currentStatus) => {
    if (!editMode) return;
    const statusCycle = ['', 'P', 'L', 'UM', 'E', 'U'];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    const key = `${studentId}|${weekDate}`;
    setLocalAttendance(prev => ({
      ...prev,
      [key]: nextStatus
    }));
  };

  const formatDateForSheet = (dateString) => {
    const date = new Date(dateString + 'T12:00:00');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month}/${day}`;
  };

  const handleSaveAndSync = async () => {
    if (Object.keys(localAttendance).length === 0) {
      toast.error('No changes to save');
      return;
    }

    setSaving(true);
    setSyncStatus('saving');

    try {
      const recordsToProcess = Object.entries(localAttendance).map(([key, status]) => {
        const [studentId, weekDate] = key.split('|');
        return { studentId, weekDate, status };
      });

      const recordsToSave = recordsToProcess
        .filter(r => r.status !== '')
        .map(r => ({
          student_id: r.studentId,
          teacher_id: teacherId,
          class_id: classId,
          attendance_date: r.weekDate,
          status: r.status,
          column_identifier: formatDateForSheet(r.weekDate),
          synced_to_sheets: false
        }));

      const recordsToDelete = recordsToProcess
        .filter(r => r.status === '')
        .map(r => ({ studentId: r.studentId, weekDate: r.weekDate }));

      if (recordsToDelete.length > 0) {
        for (const record of recordsToDelete) {
          await supabase
            .from('attendance_records')
            .delete()
            .eq('student_id', record.studentId)
            .eq('attendance_date', record.weekDate);
        }
      }

      if (recordsToSave.length > 0) {
        const { data: savedRecords, error: upsertError } = await supabase
          .from('attendance_records')
          .upsert(recordsToSave, {
            onConflict: 'student_id,attendance_date',
            returning: 'representation'
          })
          .select();

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          throw upsertError;
        }

        toast.success(`Saved ${recordsToSave.length} attendance records`);

        setSyncStatus('syncing');
        
        try {
          await batchSyncAttendance(savedRecords);
          
          const recordIds = savedRecords.map(r => r.id);
          await supabase
            .from('attendance_records')
            .update({ synced_to_sheets: true })
            .in('id', recordIds);

          setSyncStatus('complete');
          toast.success('Synced to Google Sheets');
        } catch (syncError) {
          console.error('Sync error:', syncError);
          toast.error('Saved to database but failed to sync to Google Sheets');
        }
      } else if (recordsToDelete.length > 0) {
        toast.success('Deleted records successfully');
      }

      setLocalAttendance({});
      setEditMode(false);
      setTimeout(() => {
        onDataUpdate();
        setSyncStatus(null);
      }, 1500);

    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error(`Failed to save: ${error.message || 'Unknown error'}`);
      setSyncStatus(null);
    } finally {
      setSaving(false);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      'P': { color: '#10b981', bg: '#d1fae5', icon: CheckCircle2, label: 'Present' },
      'L': { color: '#f59e0b', bg: '#fef3c7', icon: Clock, label: 'Late' },
      'UM': { color: '#8b5cf6', bg: '#ede9fe', icon: Church, label: 'Unattended Mass' },
      'E': { color: '#3b82f6', bg: '#dbeafe', icon: AlertCircle, label: 'Excused' },
      'U': { color: '#ef4444', bg: '#fee2e2', icon: XCircle, label: 'Unexcused' },
      '': { color: '#d1d5db', bg: '#ffffff', icon: HelpCircle, label: 'Not Marked' }
    };
    return configs[status] || configs[''];
  };

  const getChangedCount = () => {
    return Object.keys(localAttendance).length;
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.student_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'unmarked') {
        matchesStatus = weeks.some(week => {
          const status = getAttendanceStatus(student.id, week.date);
          return status === '';
        });
      } else {
        matchesStatus = weeks.some(week => {
          const status = getAttendanceStatus(student.id, week.date);
          return status === statusFilter;
        });
      }
    }
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: isMobile ? '12px' : '16px',
      padding: isMobile ? '16px' : '24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        marginBottom: '20px',
        gap: '12px'
      }}>
        <div>
          <h2 style={{
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: '0 0 4px 0'
          }}>
            Attendance Grid
          </h2>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#666',
            margin: 0
          }}>
            {students.length} students × {weeks.length} weeks
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {editMode ? (
            <>
              <button
                onClick={() => {
                  setEditMode(false);
                  setLocalAttendance({});
                }}
                disabled={saving}
                style={{
                  padding: isMobile ? '10px 16px' : '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndSync}
                disabled={saving || getChangedCount() === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: isMobile ? '10px 16px' : '10px 20px',
                  backgroundColor: saving || getChangedCount() === 0 ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: '600',
                  cursor: saving || getChangedCount() === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {saving ? (
                  <>
                    <Loader style={{ 
                      width: isMobile ? '14px' : '16px', 
                      height: isMobile ? '14px' : '16px',
                      animation: 'spin 1s linear infinite'
                    }} />
                    {syncStatus === 'saving' ? 'Saving...' : syncStatus === 'syncing' ? 'Syncing...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <Save style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
                    Save {getChangedCount() > 0 ? `(${getChangedCount()})` : ''}
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              style={{
                padding: isMobile ? '10px 16px' : '10px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              Edit Mode
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ flex: isMobile ? '1' : '2', position: 'relative' }}>
          <Search style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: '#9ca3af'
          }} />
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px 10px 36px' : '10px 12px 10px 40px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
          />
        </div>

        <div style={{ flex: '1', position: 'relative' }}>
          <Filter style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: '#9ca3af'
          }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px 10px 36px' : '10px 12px 10px 40px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              backgroundColor: 'white',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="all">All Students</option>
            <option value="unmarked">Unmarked Only</option>
            <option value="P">Present Only</option>
            <option value="L">Late Only</option>
            <option value="UM">Unattended Mass Only</option>
            <option value="E">Excused Only</option>
            <option value="U">Unexcused Only</option>
          </select>
        </div>
      </div>

      {/* Mobile Scroll Hint */}
      {isMobile && showScrollHint && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#1e40af',
            fontWeight: '600'
          }}
        >
          <ChevronLeft style={{ width: '16px', height: '16px' }} />
          Swipe to see all weeks
          <ChevronRight style={{ width: '16px', height: '16px' }} />
        </motion.div>
      )}

      {/* Attendance Table with Enhanced Mobile Scrolling */}
      <div
        id="attendance-scroll-container"
        style={{
          overflowX: 'auto',
          overflowY: 'visible',
          marginBottom: '16px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          // Enhanced mobile scrolling
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          // Show scrollbar on all devices
          scrollbarWidth: 'thin',
          scrollbarColor: '#10b981 #f1f5f9',
          // Add subtle shadow to indicate scrollable content
          position: 'relative',
          boxShadow: 'inset -4px 0 8px -4px rgba(0, 0, 0, 0.1)'
        }}
      >
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          minWidth: isMobile ? `${140 + (weeks.length * 70)}px` : 'auto'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={{
                padding: isMobile ? '12px' : '12px 16px',
                textAlign: 'left',
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '700',
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: '2px solid #e5e7eb',
                borderRight: '2px solid #e5e7eb',
                position: 'sticky',
                left: 0,
                backgroundColor: '#f9fafb',
                zIndex: 10,
                minWidth: isMobile ? '140px' : '200px',
                maxWidth: isMobile ? '140px' : '200px'
              }}>
                Student Name
              </th>
              {weeks.map((week, idx) => (
                <th
                  key={week.date}
                  style={{
                    padding: isMobile ? '8px 4px' : '12px 8px',
                    textAlign: 'center',
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: isMobile ? '70px' : '80px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '600' }}>
                      {new Date(week.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ fontSize: isMobile ? '9px' : '10px', color: '#9ca3af' }}>W{idx + 1}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={weeks.length + 1} style={{
                  padding: isMobile ? '32px' : '48px',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: isMobile ? '14px' : '16px'
                }}>
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No students match your filters' 
                    : 'No students found'}
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, studentIdx) => (
                <motion.tr
                  key={student.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: studentIdx * 0.03 }}
                  style={{
                    backgroundColor: studentIdx % 2 === 0 ? 'white' : '#f9fafb'
                  }}
                >
                  <td style={{
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    borderBottom: '1px solid #e5e7eb',
                    borderRight: '2px solid #e5e7eb',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: studentIdx % 2 === 0 ? 'white' : '#f9fafb',
                    zIndex: 5,
                    minWidth: isMobile ? '140px' : '200px',
                    maxWidth: isMobile ? '140px' : '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {student.student_name}
                  </td>
                  {weeks.map((week) => {
                    const status = getAttendanceStatus(student.id, week.date);
                    const config = getStatusConfig(status);
                    const Icon = config.icon;
                    const localKey = `${student.id}|${week.date}`;
                    const isChanged = localKey in localAttendance;

                    return (
                      <td
                        key={`${student.id}-${week.date}`}
                        onClick={() => handleCellClick(student.id, week.date, status)}
                        style={{
                          padding: isMobile ? '8px 4px' : '8px',
                          textAlign: 'center',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: editMode ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          backgroundColor: status ? config.bg : 'transparent',
                          position: 'relative',
                          border: isChanged ? '2px solid #3b82f6' : undefined,
                          minWidth: isMobile ? '70px' : '80px',
                          // Add touch feedback
                          ...(editMode && isMobile ? {
                            WebkitTapHighlightColor: 'rgba(16, 185, 129, 0.1)'
                          } : {})
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: isMobile ? '2px' : '4px',
                          minHeight: isMobile ? '40px' : 'auto'
                        }}>
                          {status ? (
                            <>
                              {!isMobile && (
                                <Icon style={{
                                  width: '16px',
                                  height: '16px',
                                  color: config.color
                                }} />
                              )}
                              <span style={{
                                fontSize: isMobile ? '13px' : '14px',
                                fontWeight: '700',
                                color: config.color
                              }}>
                                {status}
                              </span>
                            </>
                          ) : (
                            <span style={{
                              fontSize: isMobile ? '14px' : '16px',
                              color: '#d1d5db',
                              fontWeight: '600'
                            }}>
                              -
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '20px',
        padding: isMobile ? '12px' : '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        <h3 style={{
          fontSize: isMobile ? '12px' : '13px',
          fontWeight: '700',
          color: '#374151',
          margin: '0 0 12px 0',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Status Legend
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: isMobile ? '8px' : '12px'
        }}>
          {['P', 'L', 'UM', 'E', 'U'].map((status) => {
            const config = getStatusConfig(status);
            const Icon = config.icon;
            return (
              <div key={status} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: isMobile ? '28px' : '32px',
                  height: isMobile ? '28px' : '32px',
                  borderRadius: '8px',
                  backgroundColor: config.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon style={{ width: isMobile ? '16px' : '18px', height: isMobile ? '16px' : '18px', color: config.color }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: '#475569',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {config.label}
                  </span>
                  <span style={{
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: '700',
                    color: config.color
                  }}>
                    ({status})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {editMode && (
          <p style={{
            marginTop: '12px',
            marginBottom: 0,
            fontSize: isMobile ? '12px' : '13px',
            color: '#666',
            fontStyle: 'italic'
          }}>
            💡 {isMobile ? 'Tap' : 'Click'} any cell to cycle through statuses
          </p>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Enhanced scrollbar for better visibility on all devices */
          #attendance-scroll-container::-webkit-scrollbar {
            height: 12px;
          }
          
          #attendance-scroll-container::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 6px;
            margin: 0 4px;
          }
          
          #attendance-scroll-container::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, #10b981, #059669);
            border-radius: 6px;
            transition: background 0.3s;
            border: 2px solid #f1f5f9;
          }
          
          #attendance-scroll-container::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, #059669, #047857);
          }
          
          #attendance-scroll-container::-webkit-scrollbar-thumb:active {
            background: #047857;
          }
          
          /* Smooth momentum scrolling on iOS and mobile browsers */
          #attendance-scroll-container {
            -webkit-overflow-scrolling: touch;
            scroll-padding: 0 20px;
          }
          
          /* Add visual indicator when scrollable */
          #attendance-scroll-container::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 40px;
            background: linear-gradient(to left, rgba(255,255,255,0.9), transparent);
            pointer-events: none;
            z-index: 3;
          }
        `}
      </style>
    </div>
  );
};

export default AttendanceGrid;
