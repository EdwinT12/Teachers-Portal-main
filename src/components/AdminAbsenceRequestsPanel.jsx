import { useEffect, useState } from 'react';
import supabase from '../utils/supabase';
import { batchSyncAttendance } from '../utils/googleSheetsAPI';
import toast from 'react-hot-toast';
import { 
  FileText, 
  Check, 
  X, 
  Clock, 
  Calendar, 
  Search,
  Filter,
  RefreshCw,
  User,
  School,
  MessageSquare
} from 'lucide-react';

const AdminAbsenceRequestsPanel = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [classes, setClasses] = useState([]);
  const [processing, setProcessing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  
  // Filters
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'reviewed'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // For reviewed tab
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('year_level')
        .order('name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Load all absence requests with full details
      const { data: requestsData, error: requestsError } = await supabase
        .from('absence_requests')
        .select(`
          *,
          students:student_id (
            id,
            student_name,
            classes:class_id (
              id,
              name,
              year_level
            )
          ),
          parent:parent_id (
            id,
            full_name,
            email
          ),
          reviewer:reviewed_by (
            id,
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading absence requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    const notes = reviewNotes[request.id] || '';
    
    setProcessing(request.id);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      // Find the column identifier for this date
      const dateObj = new Date(request.absence_date);
      const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
      const day = dateObj.getDate().toString().padStart(2, '0');
      const columnId = `${monthShort}/${day}`;

      // Create or update attendance record with E (Excused) status
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', request.student_id)
        .eq('attendance_date', request.absence_date)
        .single();

      let attendanceRecord = null;

      if (existingRecord) {
        // Update existing record
        const { data: updatedRecord, error: updateError } = await supabase
          .from('attendance_records')
          .update({ 
            status: 'E',
            column_identifier: columnId,
            synced_to_sheets: false
          })
          .eq('id', existingRecord.id)
          .select()
          .single();

        if (updateError) throw updateError;
        attendanceRecord = updatedRecord;
      } else {
        // Create new record
        const { data: newRecord, error: insertError } = await supabase
          .from('attendance_records')
          .insert({
            student_id: request.student_id,
            teacher_id: user.id,
            class_id: request.class_id || request.students?.classes?.id,
            attendance_date: request.absence_date,
            status: 'E',
            column_identifier: columnId,
            synced_to_sheets: false
          })
          .select()
          .single();

        if (insertError) throw insertError;
        attendanceRecord = newRecord;
      }

      // Update absence request status
      const { error: requestError } = await supabase
        .from('absence_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          attendance_record_id: attendanceRecord.id
        })
        .eq('id', request.id);

      if (requestError) throw requestError;

      toast.success('✓ Absence request approved and saved to database');

      // Now sync to Google Sheets
      try {
        await batchSyncAttendance([attendanceRecord]);
        toast.success('✓ Successfully synced to Google Sheets');
      } catch (syncError) {
        console.error('Google Sheets sync error:', syncError);
        toast.error('⚠️ Saved locally but failed to sync to Google Sheets. Please try again or check your Google authentication.');
      }

      loadData();
      
      // Clear the review note for this request
      setReviewNotes(prev => {
        const newNotes = { ...prev };
        delete newNotes[request.id];
        return newNotes;
      });
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Error approving absence request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request) => {
    const notes = reviewNotes[request.id] || '';
    
    if (!notes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(request.id);

    try {
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase
        .from('absence_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('✓ Absence request rejected');
      loadData();
      
      // Clear the review note for this request
      setReviewNotes(prev => {
        const newNotes = { ...prev };
        delete newNotes[request.id];
        return newNotes;
      });
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Error rejecting absence request');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      weekday: 'short'
    });
  };

  const formatDateShort = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric'
    });
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { label: 'Pending Review', color: '#f59e0b', icon: Clock, bg: '#fef3c7', border: '#fcd34d' },
      'approved': { label: 'Approved', color: '#10b981', icon: Check, bg: '#d1fae5', border: '#86efac' },
      'rejected': { label: 'Rejected', color: '#ef4444', icon: X, bg: '#fee2e2', border: '#fca5a5' }
    };
    return statusMap[status] || statusMap['pending'];
  };

  const getFilteredRequests = () => {
    let filtered = requests;

    // Filter by tab (pending/reviewed)
    if (activeTab === 'pending') {
      filtered = filtered.filter(r => r.status === 'pending');
    } else {
      filtered = filtered.filter(r => r.status !== 'pending');
      
      // Additional status filter for reviewed tab
      if (filterStatus) {
        filtered = filtered.filter(r => r.status === filterStatus);
      }
    }

    // Filter by class
    if (filterClass) {
      filtered = filtered.filter(r => 
        r.students?.classes?.id === filterClass || r.class_id === filterClass
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.students?.student_name?.toLowerCase().includes(search) ||
        r.student_name?.toLowerCase().includes(search) ||
        r.parent?.full_name?.toLowerCase().includes(search) ||
        r.parent?.email?.toLowerCase().includes(search) ||
        r.reason?.toLowerCase().includes(search) ||
        r.custom_reason?.toLowerCase().includes(search)
      );
    }

    return filtered;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterClass('');
    setFilterStatus('');
  };

  const filteredRequests = getFilteredRequests();
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px',
        minHeight: '400px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            margin: '0 auto 16px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading absence requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Header with Stats */}
      <div style={{
        marginBottom: isMobile ? '20px' : '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h2 style={{
            fontSize: isMobile ? '24px' : '28px',
            fontWeight: '800',
            color: '#1e293b',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <FileText style={{ 
              width: isMobile ? '26px' : '32px', 
              height: isMobile ? '26px' : '32px', 
              color: '#667eea' 
            }} />
            Absence Requests
          </h2>

          <button
            onClick={loadData}
            style={{
              padding: isMobile ? '10px 16px' : '12px 20px',
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#667eea';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white';
              e.target.style.color = '#667eea';
            }}
          >
            <RefreshCw style={{ width: '16px', height: '16px' }} />
            Refresh
          </button>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? '8px' : '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: '#f8fafc',
            padding: isMobile ? '12px' : '16px',
            borderRadius: '12px',
            border: '2px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: '800',
              color: '#667eea',
              marginBottom: '4px'
            }}>
              {requests.length}
            </div>
            <div style={{
              fontSize: isMobile ? '11px' : '12px',
              color: '#64748b',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Total
            </div>
          </div>

          <div style={{
            background: '#fef3c7',
            padding: isMobile ? '12px' : '16px',
            borderRadius: '12px',
            border: '2px solid #fcd34d',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: '800',
              color: '#f59e0b',
              marginBottom: '4px'
            }}>
              {pendingCount}
            </div>
            <div style={{
              fontSize: isMobile ? '11px' : '12px',
              color: '#92400e',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Pending
            </div>
          </div>

          <div style={{
            background: '#d1fae5',
            padding: isMobile ? '12px' : '16px',
            borderRadius: '12px',
            border: '2px solid #86efac',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: '800',
              color: '#10b981',
              marginBottom: '4px'
            }}>
              {approvedCount}
            </div>
            <div style={{
              fontSize: isMobile ? '11px' : '12px',
              color: '#065f46',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Approved
            </div>
          </div>

          {!isMobile && (
            <div style={{
              background: '#fee2e2',
              padding: '16px',
              borderRadius: '12px',
              border: '2px solid #fca5a5',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: '800',
                color: '#ef4444',
                marginBottom: '4px'
              }}>
                {rejectedCount}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#991b1b',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Rejected
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: isMobile ? '16px' : '20px',
        borderBottom: '2px solid #e2e8f0',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: isMobile ? '10px 16px' : '12px 24px',
            background: 'transparent',
            color: activeTab === 'pending' ? '#f59e0b' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '3px solid #f59e0b' : '3px solid transparent',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '-2px',
            whiteSpace: 'nowrap'
          }}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('reviewed')}
          style={{
            padding: isMobile ? '10px 16px' : '12px 24px',
            background: 'transparent',
            color: activeTab === 'reviewed' ? '#667eea' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'reviewed' ? '3px solid #667eea' : '3px solid transparent',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '-2px',
            whiteSpace: 'nowrap'
          }}
        >
          Reviewed ({approvedCount + rejectedCount})
        </button>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '20px',
        marginBottom: isMobile ? '16px' : '20px',
        border: '2px solid #e2e8f0'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: isMobile ? '12px' : '16px',
          marginBottom: '16px'
        }}>
          {/* Search */}
          <div>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '8px'
            }}>
              <Search style={{ 
                width: '14px', 
                height: '14px', 
                display: 'inline', 
                marginRight: '6px',
                verticalAlign: 'middle'
              }} />
              Search
            </label>
            <input
              type="text"
              placeholder="Student, parent, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: isMobile ? '10px 14px' : '12px 16px',
                fontSize: isMobile ? '14px' : '15px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Class Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '8px'
            }}>
              <School style={{ 
                width: '14px', 
                height: '14px', 
                display: 'inline', 
                marginRight: '6px',
                verticalAlign: 'middle'
              }} />
              Filter by Class
            </label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              style={{
                width: '100%',
                padding: isMobile ? '10px 14px' : '12px 16px',
                fontSize: isMobile ? '14px' : '15px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                cursor: 'pointer',
                background: 'white',
                boxSizing: 'border-box'
              }}
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} (Year {cls.year_level})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter (only for reviewed tab) */}
          {activeTab === 'reviewed' && (
            <div>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                <Filter style={{ 
                  width: '14px', 
                  height: '14px', 
                  display: 'inline', 
                  marginRight: '6px',
                  verticalAlign: 'middle'
                }} />
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: isMobile ? '10px 14px' : '12px 16px',
                  fontSize: isMobile ? '14px' : '15px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  cursor: 'pointer',
                  background: 'white',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
        </div>

        {/* Filter Summary */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            fontWeight: '500'
          }}>
            Showing <strong style={{ color: '#1e293b' }}>{filteredRequests.length}</strong> of{' '}
            <strong style={{ color: '#1e293b' }}>
              {activeTab === 'pending' ? pendingCount : approvedCount + rejectedCount}
            </strong> requests
          </div>

          {(searchQuery || filterClass || filterStatus) && (
            <button
              onClick={clearFilters}
              style={{
                padding: '8px 16px',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '6px',
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
              onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
            >
              <X style={{ width: '14px', height: '14px' }} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div style={{
          padding: isMobile ? '40px 20px' : '60px 40px',
          textAlign: 'center',
          color: '#64748b',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #cbd5e1'
        }}>
          <FileText style={{ 
            width: isMobile ? '40px' : '48px', 
            height: isMobile ? '40px' : '48px', 
            margin: '0 auto 16px', 
            opacity: 0.5 
          }} />
          <p style={{ 
            margin: 0, 
            fontSize: isMobile ? '14px' : '16px', 
            fontWeight: '600' 
          }}>
            {searchQuery || filterClass || filterStatus 
              ? 'No requests match your filters' 
              : activeTab === 'pending' 
                ? 'No pending absence requests' 
                : 'No reviewed requests yet'}
          </p>
          {(searchQuery || filterClass || filterStatus) && (
            <button
              onClick={clearFilters}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gap: isMobile ? '12px' : '16px' 
        }}>
          {filteredRequests.map((request) => {
            const statusInfo = getStatusInfo(request.status);
            const StatusIcon = statusInfo.icon;
            const isPending = request.status === 'pending';

            return (
              <div 
                key={request.id} 
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: isMobile ? '16px' : '24px',
                  border: `2px solid ${statusInfo.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: '1', minWidth: isMobile ? '100%' : '250px' }}>
                    <h3 style={{
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '8px'
                    }}>
                      {request.students?.student_name || request.student_name || 'Unknown Student'}
                    </h3>
                    <div style={{
                      fontSize: isMobile ? '13px' : '14px',
                      color: '#64748b',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <School style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                        {request.students?.classes?.name || 'Unknown Class'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                        {formatDate(request.absence_date)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                        {request.parent?.full_name || 'Parent'} ({request.parent?.email})
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '8px 14px',
                    background: statusInfo.bg,
                    borderRadius: '8px',
                    border: `2px solid ${statusInfo.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexShrink: 0
                  }}>
                    <StatusIcon style={{ 
                      width: '16px', 
                      height: '16px', 
                      color: statusInfo.color 
                    }} />
                    <span style={{
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '700',
                      color: statusInfo.color
                    }}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {/* Reason */}
                <div style={{
                  padding: isMobile ? '12px' : '16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '8px'
                  }}>
                    Reason for Absence:
                  </div>
                  <div style={{
                    fontSize: isMobile ? '13px' : '14px',
                    color: '#1e293b',
                    lineHeight: '1.6'
                  }}>
                    {request.reason === 'Other' ? request.custom_reason : request.reason}
                  </div>
                </div>

                {/* Review Section */}
                {isPending ? (
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '600',
                      color: '#475569',
                      marginBottom: '8px'
                    }}>
                      <MessageSquare style={{ 
                        width: '14px', 
                        height: '14px', 
                        display: 'inline', 
                        marginRight: '6px',
                        verticalAlign: 'middle'
                      }} />
                      Review Notes {!request.status !== 'pending' && '(optional for approval, required for rejection)'}
                    </label>
                    <textarea
                      value={reviewNotes[request.id] || ''}
                      onChange={(e) => setReviewNotes({
                        ...reviewNotes,
                        [request.id]: e.target.value
                      })}
                      placeholder="Add any notes about this request..."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: isMobile ? '10px 12px' : '12px 14px',
                        fontSize: isMobile ? '13px' : '14px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        marginBottom: '12px'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    />

                    <div style={{
                      display: 'flex',
                      gap: isMobile ? '8px' : '12px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => handleApprove(request)}
                        disabled={processing === request.id}
                        style={{
                          flex: 1,
                          minWidth: isMobile ? '100%' : '150px',
                          padding: isMobile ? '12px' : '14px',
                          background: processing === request.id ? '#94a3b8' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: isMobile ? '13px' : '14px',
                          fontWeight: '700',
                          cursor: processing === request.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s',
                          opacity: processing === request.id ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (processing !== request.id) {
                            e.target.style.background = '#059669';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (processing !== request.id) {
                            e.target.style.background = '#10b981';
                          }
                        }}
                      >
                        <Check style={{ width: '18px', height: '18px' }} />
                        {processing === request.id ? 'Approving...' : 'Approve & Mark as E'}
                      </button>
                      <button
                        onClick={() => handleReject(request)}
                        disabled={processing === request.id}
                        style={{
                          flex: 1,
                          minWidth: isMobile ? '100%' : '150px',
                          padding: isMobile ? '12px' : '14px',
                          background: processing === request.id ? '#94a3b8' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: isMobile ? '13px' : '14px',
                          fontWeight: '700',
                          cursor: processing === request.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s',
                          opacity: processing === request.id ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (processing !== request.id) {
                            e.target.style.background = '#dc2626';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (processing !== request.id) {
                            e.target.style.background = '#ef4444';
                          }
                        }}
                      >
                        <X style={{ width: '18px', height: '18px' }} />
                        {processing === request.id ? 'Rejecting...' : 'Reject Request'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {request.review_notes && (
                      <div style={{
                        padding: isMobile ? '12px' : '14px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        borderLeft: '4px solid #667eea'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#64748b',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <MessageSquare style={{ width: '14px', height: '14px' }} />
                          Review Notes:
                        </div>
                        <p style={{ 
                          color: '#475569', 
                          margin: 0, 
                          fontSize: isMobile ? '13px' : '14px',
                          lineHeight: '1.5'
                        }}>
                          {request.review_notes}
                        </p>
                      </div>
                    )}
                    {request.reviewed_at && (
                      <div style={{
                        marginTop: '12px',
                        fontSize: isMobile ? '12px' : '13px',
                        color: '#94a3b8',
                        display: 'flex',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <span>
                          Reviewed by: <strong style={{ color: '#64748b' }}>{request.reviewer?.full_name || 'Admin'}</strong>
                        </span>
                        <span>
                          {formatDateShort(request.reviewed_at)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
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

export default AdminAbsenceRequestsPanel;
