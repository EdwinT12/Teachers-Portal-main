import { useState } from 'react';
import { motion } from 'framer-motion';
import supabase from '../utils/supabase';
import { batchSyncAttendance } from '../utils/googleSheetsAPI';
import toast from 'react-hot-toast';
import { Save, Loader, CheckCircle2, XCircle, Clock, HelpCircle, AlertCircle, Search, Filter, Church } from 'lucide-react';

const AttendanceGrid = ({ students, weeks, attendanceData, classId, teacherId, onDataUpdate }) => {
  const [editMode, setEditMode] = useState(false);
  const [localAttendance, setLocalAttendance] = useState({});
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'P', 'L', 'UM', 'E', 'U', 'unmarked'

  const getAttendanceStatus = (studentId, weekDate) => {
    // Check local changes first
    const localKey = `${studentId}|${weekDate}`;
    if (localKey in localAttendance) {
      return localAttendance[localKey];
    }

    // Find attendance record for this student and week
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
      // Prepare records for batch insert/update
      const recordsToProcess = Object.entries(localAttendance).map(([key, status]) => {
        const [studentId, weekDate] = key.split('|');
        return { studentId, weekDate, status };
      });

      // Separate into saves and deletes
      const recordsToSave = recordsToProcess
        .filter(r => r.status !== '')
        .map(r => ({
          student_id: r.studentId,
          teacher_id: teacherId,
          class_id: classId,
          attendance_date: r.weekDate, // This is already in YYYY-MM-DD format
          status: r.status,
          column_identifier: formatDateForSheet(r.weekDate),
          synced_to_sheets: false
        }));

      const recordsToDelete = recordsToProcess
        .filter(r => r.status === '')
        .map(r => ({ studentId: r.studentId, weekDate: r.weekDate }));

      // Delete records with empty status
      if (recordsToDelete.length > 0) {
        for (const record of recordsToDelete) {
          await supabase
            .from('attendance_records')
            .delete()
            .eq('student_id', record.studentId)
            .eq('attendance_date', record.weekDate);
        }
      }

      // Upsert records to Supabase
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

        toast.success(`Saved ${recordsToSave.length} attendance records to database`);

        // Sync to Google Sheets
        setSyncStatus('syncing');
        
        try {
          await batchSyncAttendance(savedRecords);
          
          // Mark as synced in database
          const recordIds = savedRecords.map(r => r.id);
          await supabase
            .from('attendance_records')
            .update({ synced_to_sheets: true })
            .in('id', recordIds);

          setSyncStatus('complete');
          toast.success('Successfully synced to Google Sheets');
        } catch (syncError) {
          console.error('Sync error:', syncError);
          toast.error('Saved to database but failed to sync to Google Sheets');
        }
      } else if (recordsToDelete.length > 0) {
        toast.success('Deleted records successfully');
      }

      // Clear local changes and refresh
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

  // Filter students based on search term and status filter
  const filteredStudents = students.filter(student => {
    // Search filter
    const matchesSearch = student.student_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'unmarked') {
        // Check if student has any unmarked weeks
        matchesStatus = weeks.some(week => {
          const status = getAttendanceStatus(student.id, week.date);
          return status === '';
        });
      } else {
        // Check if student has the selected status in any week
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
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: '0 0 4px 0'
          }}>
            Attendance Grid
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: 0
          }}>
            {filteredStudents.length} students × {weeks.length} weeks
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              style={{
                padding: '10px 24px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
            >
              Edit Mode
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditMode(false);
                  setLocalAttendance({});
                }}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
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
                  padding: '10px 24px',
                  backgroundColor: saving || getChangedCount() === 0 ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: saving || getChangedCount() === 0 ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!saving && getChangedCount() > 0) {
                    e.currentTarget.style.backgroundColor = '#059669';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving && getChangedCount() > 0) {
                    e.currentTarget.style.backgroundColor = '#10b981';
                  }
                }}
              >
                {saving ? (
                  <>
                    <Loader style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    {syncStatus === 'saving' ? 'Saving...' : 'Syncing...'}
                  </>
                ) : (
                  <>
                    <Save style={{ width: '16px', height: '16px' }} />
                    Save & Sync ({getChangedCount()})
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <div style={{ flex: '1 1 250px', position: 'relative' }}>
          <Search style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            color: '#9ca3af'
          }} />
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#4CAF50'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
          />
        </div>

        {/* Status Filter */}
        <div style={{ position: 'relative', minWidth: '200px' }}>
          <Filter style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            color: '#9ca3af',
            pointerEvents: 'none'
          }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: 'white',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center'
            }}
          >
            <option value="all">All Students</option>
            <option value="P">Present (P)</option>
            <option value="L">Late (L)</option>
            <option value="UM">Unattended Mass (UM)</option>
            <option value="E">Excused (E)</option>
            <option value="U">Unexcused (U)</option>
            <option value="unmarked">Unmarked</option>
          </select>
        </div>
      </div>

      {/* Grid Table */}
      <div style={{
        overflowX: 'auto',
        overflowY: 'visible',
        maxHeight: 'calc(100vh - 450px)',
        position: 'relative'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          minWidth: '800px'
        }}>
          <thead style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            zIndex: 10
          }}>
            <tr>
              <th style={{
                padding: '12px 16px',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: '700',
                color: '#374151',
                backgroundColor: '#f9fafb',
                borderBottom: '2px solid #e5e7eb',
                borderRight: '2px solid #e5e7eb',
                position: 'sticky',
                left: 0,
                zIndex: 11,
                minWidth: '200px'
              }}>
                Student Name
              </th>
              {weeks.map((week, idx) => (
                <th key={idx} style={{
                  padding: '12px 8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#374151',
                  backgroundColor: '#f9fafb',
                  borderBottom: '2px solid #e5e7eb',
                  minWidth: '80px',
                  whiteSpace: 'nowrap'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>{week.label}</span>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>Week {idx + 1}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={weeks.length + 1} style={{
                  padding: '48px',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: '16px'
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
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    borderBottom: '1px solid #e5e7eb',
                    borderRight: '2px solid #e5e7eb',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: studentIdx % 2 === 0 ? 'white' : '#f9fafb',
                    zIndex: 5
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
                          padding: '8px',
                          textAlign: 'center',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: editMode ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          backgroundColor: status ? config.bg : 'transparent',
                          position: 'relative',
                          border: isChanged ? '2px solid #3b82f6' : undefined
                        }}
                        onMouseEnter={(e) => {
                          if (editMode && !isChanged) {
                            e.currentTarget.style.opacity = '0.7';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (editMode) {
                            e.currentTarget.style.opacity = '1';
                          }
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}>
                          {status ? (
                            <>
                              <Icon style={{
                                width: '16px',
                                height: '16px',
                                color: config.color
                              }} />
                              <span style={{
                                fontSize: '13px',
                                fontWeight: '700',
                                color: config.color
                              }}>
                                {status}
                              </span>
                            </>
                          ) : (
                            <span style={{
                              fontSize: '14px',
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
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        <h3 style={{
          fontSize: '13px',
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
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
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: config.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon style={{ width: '18px', height: '18px', color: config.color }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569'
                  }}>
                    {config.label}
                  </span>
                  <span style={{
                    fontSize: '12px',
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
            fontSize: '13px',
            color: '#666',
            fontStyle: 'italic'
          }}>
            💡 Click on any cell to cycle through statuses: Blank → P → L → UM → E → U → Blank
          </p>
        )}
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

export default AttendanceGrid;