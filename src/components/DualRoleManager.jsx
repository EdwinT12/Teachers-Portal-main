import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Check, UserPlus, AlertCircle } from 'lucide-react';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';

const DualRoleManager = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showAddParentModal, setShowAddParentModal] = useState(false);
  const [parentFormData, setParentFormData] = useState({
    children: []
  });
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState({});
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
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
        .order('full_name');

      if (teachersError) throw teachersError;

      // Check which teachers have parent role by checking roles array
      const teachersWithParentStatus = (teachersData || []).map(teacher => ({
        ...teacher,
        hasParentRole: teacher.roles && Array.isArray(teacher.roles) && teacher.roles.includes('parent')
      }));

      setTeachers(teachersWithParentStatus);

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, student_name, class_id, classes(name, year_level)')
        .order('student_name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('year_level')
        .order('name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddParentModal = (teacher) => {
    setSelectedTeacher(teacher);
    setParentFormData({ children: [] });
    setSelectedStudents({});
    setSelectedClass('');
    setShowAddParentModal(true);
  };

  const handleAddChild = () => {
    setParentFormData({
      ...parentFormData,
      children: [...parentFormData.children, { id: `${Date.now()}-${Math.random()}` }]
    });
  };

  const handleRemoveChild = (index) => {
    const newChildren = parentFormData.children.filter((_, i) => i !== index);
    setParentFormData({ ...parentFormData, children: newChildren });
    
    const newSelectedStudents = { ...selectedStudents };
    delete newSelectedStudents[index];
    setSelectedStudents(newSelectedStudents);
  };

  const handleStudentSelection = (childIndex, studentId) => {
    setSelectedStudents({
      ...selectedStudents,
      [childIndex]: studentId
    });
  };

  const handleAddParentRole = async () => {
    if (!selectedTeacher) return;

    if (parentFormData.children.length === 0) {
      toast.error('Please add at least one child');
      return;
    }

    const unselectedChildren = parentFormData.children.filter(
      (_, index) => !selectedStudents[index]
    );

    if (unselectedChildren.length > 0) {
      toast.error('Please select a student for each child');
      return;
    }

    try {
      // Update existing teacher profile to add parent role
      const { error: parentError } = await supabase
        .from('profiles')
        .update({
          roles: ['teacher', 'parent'] // Add both roles
        })
        .eq('id', selectedTeacher.id);

      if (parentError) {
        console.error('Error updating teacher profile with parent role:', parentError);
        throw parentError;
      }

      const childrenToInsert = parentFormData.children.map((child, index) => {
        const studentId = selectedStudents[index];
        const student = students.find(s => s.id === studentId);
        
        return {
          parent_id: selectedTeacher.id,
          student_id: studentId,
          class_id: student.class_id,
          child_name_submitted: student.student_name,
          year_group: student.classes?.year_level || 0,
          verified: true,
          verified_at: new Date().toISOString()
        };
      });

      const { error: childrenError } = await supabase
        .from('parent_children')
        .insert(childrenToInsert);

      if (childrenError) {
        console.error('Error adding children:', childrenError);
        throw childrenError;
      }

      toast.success('✓ Parent role added successfully!');
      setShowAddParentModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding parent role:', error);
      toast.error('Failed to add parent role: ' + error.message);
    }
  };

  const handleRemoveParentRole = async (teacherId) => {
    if (!confirm('Are you sure you want to remove the parent role from this teacher?')) {
      return;
    }

    try {
      // Remove all children links
      const { error: childrenError } = await supabase
        .from('parent_children')
        .delete()
        .eq('parent_id', teacherId);

      if (childrenError) throw childrenError;

      // Update profile to remove 'parent' from roles array, keeping only 'teacher'
      const { error: parentError } = await supabase
        .from('profiles')
        .update({
          roles: ['teacher'] // Keep only teacher role
        })
        .eq('id', teacherId);

      if (parentError) throw parentError;

      toast.success('✓ Parent role removed successfully');
      loadData();
    } catch (error) {
      console.error('Error removing parent role:', error);
      toast.error('Failed to remove parent role');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="main-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'white',
            borderRadius: '20px',
            padding: isMobile ? '24px' : '32px',
            maxWidth: '900px',
            width: '100%',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
          className="dual-role-scrollbar"
        >
          <style>{`
            .dual-role-scrollbar::-webkit-scrollbar { width: 8px; }
            .dual-role-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
            .dual-role-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
            .dual-role-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          `}</style>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #e2e8f0',
                  borderTop: '4px solid #8b5cf6',
                  borderRadius: '50%'
                }}
              />
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: isMobile ? '16px' : '20px',
                paddingBottom: isMobile ? '12px' : '16px',
                borderBottom: '2px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: isMobile ? '40px' : '48px',
                    height: isMobile ? '40px' : '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Users style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: 'white' }} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: isMobile ? '18px' : '22px',
                      fontWeight: '800',
                      color: '#1e293b',
                      margin: 0
                    }}>
                      Dual Role Management
                    </h2>
                    <p style={{
                      fontSize: isMobile ? '12px' : '13px',
                      color: '#64748b',
                      margin: 0
                    }}>
                      Assign parent roles to teachers with children in catechism
                    </p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X style={{ width: '18px', height: '18px', color: '#64748b' }} />
                </motion.button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: '#eff6ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '12px',
                  padding: isMobile ? '12px' : '16px',
                  marginBottom: isMobile ? '16px' : '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <AlertCircle style={{ width: '20px', height: '20px', color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: isMobile ? '12px' : '13px',
                    color: '#1e40af',
                    margin: 0,
                    fontWeight: '600',
                    lineHeight: '1.5'
                  }}>
                    Teachers with the parent role can access both dashboards and will be automatically verified as parents.
                  </p>
                </div>
              </motion.div>

              <div style={{ maxHeight: isMobile ? '500px' : '600px', overflowY: 'auto', paddingRight: '4px' }} className="dual-role-scrollbar">
                {teachers.map((teacher, index) => (
                  <motion.div
                    key={teacher.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                      background: 'white',
                      border: `2px solid ${teacher.hasParentRole ? '#8b5cf6' : '#e2e8f0'}`,
                      borderRadius: '12px',
                      padding: isMobile ? '14px' : '16px',
                      marginBottom: '12px',
                      boxShadow: teacher.hasParentRole ? '0 4px 16px rgba(139, 92, 246, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: isMobile ? '15px' : '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '4px'
                        }}>
                          {teacher.full_name || 'N/A'}
                        </div>
                        <div style={{
                          fontSize: isMobile ? '12px' : '13px',
                          color: '#64748b',
                          marginBottom: '8px',
                          wordBreak: 'break-all'
                        }}>
                          {teacher.email}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: '#dbeafe',
                            color: '#1e40af',
                            border: '1px solid #3b82f6'
                          }}>
                            👨‍🏫 Teacher
                          </div>
                          {teacher.hasParentRole && (
                            <div style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: '#f3e8ff',
                              color: '#6b21a8',
                              border: '1px solid #8b5cf6'
                            }}>
                              👨‍👩‍👧‍👦 Parent
                            </div>
                          )}
                          {teacher.classes?.name && (
                            <div style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: '#d1fae5',
                              color: '#065f46',
                              border: '1px solid #10b981'
                            }}>
                              {teacher.classes.name}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        {teacher.hasParentRole ? (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRemoveParentRole(teacher.id)}
                            style={{
                              padding: isMobile ? '8px 12px' : '10px 16px',
                              background: '#fee2e2',
                              border: '2px solid #ef4444',
                              borderRadius: '8px',
                              color: '#dc2626',
                              fontSize: isMobile ? '12px' : '13px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <X style={{ width: '14px', height: '14px' }} />
                            Remove Parent
                          </motion.button>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleOpenAddParentModal(teacher)}
                            style={{
                              padding: isMobile ? '8px 12px' : '10px 16px',
                              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                              border: 'none',
                              borderRadius: '8px',
                              color: 'white',
                              fontSize: isMobile ? '12px' : '13px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <UserPlus style={{ width: '14px', height: '14px' }} />
                            Add Parent
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {teachers.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#94a3b8',
                    fontSize: isMobile ? '13px' : '14px'
                  }}>
                    No teachers found
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
      )}

      {showAddParentModal && (
        <motion.div
          key="add-parent-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setShowAddParentModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: isMobile ? '24px' : '32px',
              maxWidth: '700px',
              width: '100%',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            className="dual-role-scrollbar"
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserPlus style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div>
                  <h2 style={{
                    fontSize: isMobile ? '18px' : '22px',
                    fontWeight: '800',
                    color: '#1e293b',
                    margin: 0
                  }}>
                    Add Parent Role
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    {selectedTeacher?.full_name}
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddParentModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X style={{ width: '18px', height: '18px', color: '#64748b' }} />
              </motion.button>
            </div>

            {/* Class Filter */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block',
                fontSize: '13px', 
                fontWeight: '700', 
                color: '#475569',
                marginBottom: '8px'
              }}>
                📚 Filter by Class (Optional)
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#334155',
                  background: 'white'
                }}
              >
                <option value="">All Classes</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                  👶 Children *
                </label>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddChild}
                  style={{
                    padding: '6px 12px',
                    background: '#dbeafe',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    color: '#1e40af',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  + Add Child
                </motion.button>
              </div>

              {parentFormData.children.map((child, index) => {
                const selectedStudentId = selectedStudents[index];
                const selectedStudent = students.find(s => s.id === selectedStudentId);
                
                // Filter students by selected class
                const filteredStudents = selectedClass 
                  ? students.filter(s => s.class_id === selectedClass)
                  : students;
                
                return (
                  <motion.div
                    key={child.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: '#f8fafc',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                        Child {index + 1}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRemoveChild(index)}
                        style={{
                          background: '#fee2e2',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X style={{ width: '14px', height: '14px', color: '#dc2626' }} />
                      </motion.button>
                    </div>

                    <select
                      value={selectedStudentId || ''}
                      onChange={(e) => handleStudentSelection(index, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '2px solid #e2e8f0',
                        fontSize: '13px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#334155'
                      }}
                    >
                      <option value="">Select a student...</option>
                      {filteredStudents.map(student => (
                        <option key={student.id} value={student.id}>
                          {student.student_name} - {student.classes?.name || 'No Class'}
                        </option>
                      ))}
                    </select>

                    {filteredStudents.length === 0 && selectedClass && (
                      <div style={{
                        padding: '8px',
                        background: '#fef3c7',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#92400e',
                        marginBottom: '8px'
                      }}>
                        ⚠️ No students found in selected class. Try changing the class filter.
                      </div>
                    )}

                    {selectedStudent && (
                      <div style={{
                        padding: '8px',
                        background: '#e0f2fe',
                        border: '1px solid #0ea5e9',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#0c4a6e'
                      }}>
                        ✓ Selected: {selectedStudent.student_name} ({selectedStudent.classes?.name || 'No Class'})
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {parentFormData.children.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  background: '#f8fafc',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  color: '#94a3b8',
                  fontSize: '13px'
                }}>
                  No children added yet. Click "Add Child" to start.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddParentModal(false)}
                style={{
                  flex: 1,
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleAddParentRole}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(139, 92, 246, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Check style={{ width: '16px', height: '16px' }} />
                Add Parent Role
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DualRoleManager;
