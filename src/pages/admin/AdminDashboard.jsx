import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import BulkStudentImport from '../../components/BulkStudentImport';

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assigningTeacher, setAssigningTeacher] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select(`
          *,
          classes:default_class_id (
            id,
            name,
            year_level
          )
        `)
        .eq('role', 'teacher')
        .order('created_at', { ascending: false });

      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      // Load all classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('year_level');

      if (classesError) throw classesError;
      setClasses(classesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const assignTeacherToClass = async (teacherId, classId) => {
    setAssigningTeacher(teacherId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_class_id: classId })
        .eq('id', teacherId);

      if (error) throw error;

      toast.success('Teacher assigned successfully!');
      loadData();
    } catch (error) {
      console.error('Error assigning teacher:', error);
      toast.error('Failed to assign teacher');
    } finally {
      setAssigningTeacher(null);
    }
  };

  const removeTeacherAssignment = async (teacherId) => {
    if (!confirm('Are you sure you want to remove this teacher\'s class assignment?')) {
      return;
    }

    setAssigningTeacher(teacherId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_class_id: null })
        .eq('id', teacherId);

      if (error) throw error;

      toast.success('Teacher assignment removed');
      loadData();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('Failed to remove assignment');
    } finally {
      setAssigningTeacher(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #4CAF50',
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

  const unapprovedTeachers = teachers.filter(t => !t.default_class_id);
  const approvedTeachers = teachers.filter(t => t.default_class_id);

  const renderOverviewTab = () => (
    <>
      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '8px'
          }}>
            Total Teachers
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1a1a1a'
          }}>
            {teachers.length}
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '8px'
          }}>
            Pending Approval
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#ff9800'
          }}>
            {unapprovedTeachers.length}
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '8px'
          }}>
            Approved Teachers
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#4CAF50'
          }}>
            {approvedTeachers.length}
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '8px'
          }}>
            Total Classes
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#2196F3'
          }}>
            {classes.length}
          </div>
        </div>
      </div>

      {/* Unapproved Teachers */}
      {unapprovedTeachers.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '32px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px 24px',
            backgroundColor: '#fff3cd',
            borderBottom: '1px solid #ffc107'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#856404',
              margin: 0
            }}>
              ⚠️ Pending Teacher Approvals ({unapprovedTeachers.length})
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Teacher Name
                  </th>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Email
                  </th>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Joined
                  </th>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Assign to Class
                  </th>
                </tr>
              </thead>
              <tbody>
                {unapprovedTeachers.map((teacher, index) => (
                  <tr
                    key={teacher.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#1a1a1a',
                      fontWeight: '500'
                    }}>
                      {teacher.full_name || 'N/A'}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      {teacher.email}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      {new Date(teacher.created_at).toLocaleDateString()}
                    </td>
                    <td style={{
                      padding: '16px 24px'
                    }}>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            assignTeacherToClass(teacher.id, e.target.value);
                          }
                        }}
                        disabled={assigningTeacher === teacher.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          fontSize: '14px',
                          cursor: 'pointer',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="">Select a class...</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approved Teachers */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a1a1a',
            margin: 0
          }}>
            ✅ Approved Teachers ({approvedTeachers.length})
          </h2>
        </div>

        {approvedTeachers.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: '#999'
          }}>
            No approved teachers yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Teacher Name
                  </th>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Email
                  </th>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Assigned Class
                  </th>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Status
                  </th>
                  <th style={{
                    padding: '16px 24px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {approvedTeachers.map((teacher, index) => (
                  <tr
                    key={teacher.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#1a1a1a',
                      fontWeight: '500'
                    }}>
                      {teacher.full_name || 'N/A'}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      {teacher.email}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      color: '#1a1a1a',
                      fontWeight: '500'
                    }}>
                      {teacher.classes?.name || 'N/A'}
                    </td>
                    <td style={{
                      padding: '16px 24px'
                    }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: teacher.status === 'active' ? '#d4edda' : '#f8d7da',
                        color: teacher.status === 'active' ? '#155724' : '#721c24'
                      }}>
                        {teacher.status}
                      </span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      textAlign: 'center'
                    }}>
                      <button
                        onClick={() => removeTeacherAssignment(teacher.id)}
                        disabled={assigningTeacher === teacher.id}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#b91c1c'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
                      >
                        Remove Class
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '32px 20px'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '32px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#1a1a1a',
          margin: '0 0 8px 0'
        }}>
          Admin Dashboard
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#666',
          margin: 0
        }}>
          Manage teacher assignments, classes, and import students
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '32px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        {['overview', 'import'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              backgroundColor: activeTab === tab ? '#4CAF50' : 'transparent',
              color: activeTab === tab ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {tab === 'import' ? '📥 Import Students' : '📊 Overview'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'import' && <BulkStudentImport />}
    </div>
  );
};

export default AdminDashboard;