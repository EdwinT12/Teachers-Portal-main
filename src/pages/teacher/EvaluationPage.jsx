import { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import { batchSyncEvaluations } from '../../utils/googleSheetsEvaluationAPI';
import { 
  getTeacherVisibilitySettings, 
  updateTeacherVisibility 
} from '../../utils/evaluationVisibilityUtils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Save,
  Check,
  Loader,
  Users,
  TrendingUp,
  Award,
  BookOpen,
  Heart,
  Zap,
  FileText,
  X,
  AlertCircle,
  ChevronDown,
  Database,
  Cloud,
  CheckCircle2,
  Plus,
  Lock,
  LogOut,
  Trash2,
  Minus
} from 'lucide-react';

const EvaluationPage = () => {
  const { classId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(classId);
  const [showSyncErrorModal, setShowSyncErrorModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncStep, setSyncStep] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [classInfo, setClassInfo] = useState(null);
  const [evalStudents, setEvalStudents] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [studentNotes, setStudentNotes] = useState({});
  const [isMobile, setIsMobile] = useState(false);

  // Visibility settings state
  const [visibilitySettings, setVisibilitySettings] = useState({
    show_homework: true,
    show_discipline: false,
    show_participation: false,
    show_behaviour: false,
    admin_override: false
  });
  const [showAddCriteriaModal, setShowAddCriteriaModal] = useState(false);
  
  // Per-student criteria management
  const [studentCriteriaOverrides, setStudentCriteriaOverrides] = useState({});
  const [showStudentCriteriaModal, setShowStudentCriteriaModal] = useState(false);
  const [selectedStudentForCriteria, setSelectedStudentForCriteria] = useState(null);

  // All categories with mapping to settings
  const allCategories = [
    { key: 'D', label: 'Discipline', color: '#3b82f6', icon: Award, settingKey: 'show_discipline' },
    { key: 'B', label: 'Behaviour', color: '#10b981', icon: Heart, settingKey: 'show_behaviour' },
    { key: 'HW', label: 'Homework', color: '#f59e0b', icon: BookOpen, settingKey: 'show_homework' },
    { key: 'AP', label: 'Active Participation', color: '#8b5cf6', icon: Zap, settingKey: 'show_participation' }
  ];

  // Filter categories based on visibility settings
  const categories = allCategories.filter(cat => 
    visibilitySettings[cat.settingKey] === true
  );

  // Get hidden categories for the modal
  const hiddenCategories = allCategories.filter(cat => 
    visibilitySettings[cat.settingKey] === false
  );

  // Get categories for a specific student (with overrides)
  const getStudentCategories = (studentId) => {
    const overrides = studentCriteriaOverrides[studentId];
    if (!overrides) return categories;

    return allCategories.filter(cat => {
      // If there's a student-specific override, use it
      if (overrides[cat.settingKey] !== undefined) {
        return overrides[cat.settingKey];
      }
      // Otherwise use the global setting
      return visibilitySettings[cat.settingKey];
    });
  };

  // Get hidden categories for a specific student
  const getStudentHiddenCategories = (studentId) => {
    const overrides = studentCriteriaOverrides[studentId];
    
    return allCategories.filter(cat => {
      // If there's a student-specific override, use it
      if (overrides && overrides[cat.settingKey] !== undefined) {
        return !overrides[cat.settingKey];
      }
      // Otherwise use the global setting
      return !visibilitySettings[cat.settingKey];
    });
  };

  const ratings = [
    { value: 'E', label: 'Excellent', color: '#10b981', bg: '#d1fae5' },
    { value: 'G', label: 'Good', color: '#3b82f6', bg: '#dbeafe' },
    { value: 'I', label: 'Improving', color: '#f59e0b', bg: '#fef3c7' }
  ];

  const chapterOptions = Array.from({ length: 15 }, (_, i) => i + 1);

  // Load visibility settings
  useEffect(() => {
    const loadVisibilitySettings = async () => {
      if (!user) return;
      
      try {
        const settings = await getTeacherVisibilitySettings(user.id);
        setVisibilitySettings(settings);
      } catch (error) {
        console.error('Error loading visibility settings:', error);
      }
    };

    loadVisibilitySettings();
  }, [user]);

  // Handle adding criteria
  const handleAddCriteria = async (categoryKey) => {
    const category = allCategories.find(c => c.key === categoryKey);
    if (!category) return;

    const newSettings = {
      ...visibilitySettings,
      [category.settingKey]: true
    };

    setVisibilitySettings(newSettings);
    const success = await updateTeacherVisibility(user.id, newSettings);
    
    if (!success) {
      setVisibilitySettings(visibilitySettings);
    } else {
      // Close modal if all criteria are now visible
      const allVisible = allCategories.every(cat => newSettings[cat.settingKey]);
      if (allVisible) {
        setShowAddCriteriaModal(false);
      }
    }
  };

  // Handle removing criteria
  const handleRemoveCriteria = async (categoryKey) => {
    const category = allCategories.find(c => c.key === categoryKey);
    if (!category) return;

    // Ensure at least one criteria remains
    const visibleCount = categories.length;
    if (visibleCount <= 1) {
      toast.error('You must have at least one evaluation criteria active');
      return;
    }

    const newSettings = {
      ...visibilitySettings,
      [category.settingKey]: false
    };

    setVisibilitySettings(newSettings);
    const success = await updateTeacherVisibility(user.id, newSettings);
    
    if (!success) {
      setVisibilitySettings(visibilitySettings);
    }
  };

  // Handle opening student criteria modal
  const handleOpenStudentCriteriaModal = (student) => {
    setSelectedStudentForCriteria(student);
    setShowStudentCriteriaModal(true);
  };

  // Handle adding criteria for a specific student
  const handleAddStudentCriteria = (studentId, categoryKey) => {
    const category = allCategories.find(c => c.key === categoryKey);
    if (!category) return;

    setStudentCriteriaOverrides(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [category.settingKey]: true
      }
    }));

    toast.success(`${category.label} added for ${selectedStudentForCriteria?.student_name}`);
  };

  // Handle removing criteria for a specific student
  const handleRemoveStudentCriteria = (studentId, categoryKey) => {
    const category = allCategories.find(c => c.key === categoryKey);
    if (!category) return;

    // Check if at least one criteria will remain
    const studentCategories = getStudentCategories(studentId);
    if (studentCategories.length <= 1) {
      toast.error('You must have at least one evaluation criteria active for this student');
      return;
    }

    setStudentCriteriaOverrides(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [category.settingKey]: false
      }
    }));

    toast.success(`${category.label} removed for ${selectedStudentForCriteria?.student_name}`);
  };

  // Reset student criteria to global defaults
  const handleResetStudentCriteria = (studentId) => {
    setStudentCriteriaOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[studentId];
      return newOverrides;
    });

    toast.success(`Criteria reset to defaults for ${selectedStudentForCriteria?.student_name}`);
  };

  // Prevent window close during sync
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (syncStatus === 'saving' || syncStatus === 'syncing') {
        e.preventDefault();
        e.returnValue = 'Data is being saved and synced. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncStatus]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkAdminAndLoadClasses = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        
        const isUserAdmin = profile.role === 'admin';
        setIsAdmin(isUserAdmin);

        if (isUserAdmin) {
          const { data: classesData, error: classesError } = await supabase
            .from('classes')
            .select('*')
            .order('year_level');

          if (classesError) throw classesError;
          setAllClasses(classesData || []);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    checkAdminAndLoadClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClassId && user) {
      loadClassAndStudents();
    } else if (!selectedClassId && user) {
      navigate('/teacher');
    }
  }, [selectedClassId, user, selectedChapter]);

  const handleClassChange = (newClassId) => {
    setSelectedClassId(newClassId);
    setEvaluations({});
    setStudentNotes({});
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  const loadClassAndStudents = async () => {
    setLoading(true);
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', selectedClassId)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      const { data: evalStudentsData, error: studentsError } = await supabase
        .from('eval_students')
        .select('*')
        .eq('class_id', selectedClassId)
        .order('row_number');

      if (studentsError) throw studentsError;
      setEvalStudents(evalStudentsData);

      setEvaluations({});
      setStudentNotes({});

      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('lesson_evaluations')
        .select(`
          eval_student_id,
          category,
          rating,
          synced_to_sheets,
          teacher_notes,
          eval_students!inner (
            student_name,
            class_id
          )
        `)
        .eq('class_id', selectedClassId)
        .eq('chapter_number', selectedChapter);

      if (evaluationsError && evaluationsError.code !== 'PGRST116') {
        throw evaluationsError;
      }

      const evaluationsMap = {};
      const notesMap = {};
      
      if (evaluationsData && evaluationsData.length > 0) {
        evaluationsData.forEach(record => {
          let matchedStudent = evalStudentsData.find(s => s.id === record.eval_student_id);
          
          if (!matchedStudent && record.eval_students && record.eval_students.student_name) {
            matchedStudent = evalStudentsData.find(
              s => s.student_name.trim().toLowerCase() === record.eval_students.student_name.trim().toLowerCase()
            );
          }
          
          if (matchedStudent) {
            if (!evaluationsMap[matchedStudent.id]) {
              evaluationsMap[matchedStudent.id] = {};
            }
            evaluationsMap[matchedStudent.id][record.category] = {
              rating: record.rating,
              synced: record.synced_to_sheets
            };
            
            if (record.teacher_notes) {
              notesMap[matchedStudent.id] = record.teacher_notes;
            }
          }
        });
      }
      
      setEvaluations(evaluationsMap);
      setStudentNotes(notesMap);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationChange = (evalStudentId, category, rating) => {
    setEvaluations(prev => {
      const currentRating = prev[evalStudentId]?.[category]?.rating;
      
      if (currentRating === rating) {
        const newState = { ...prev };
        if (newState[evalStudentId]) {
          delete newState[evalStudentId][category];
          if (Object.keys(newState[evalStudentId]).length === 0) {
            delete newState[evalStudentId];
          }
        }
        return newState;
      }
      
      return {
        ...prev,
        [evalStudentId]: {
          ...prev[evalStudentId],
          [category]: { rating, synced: false }
        }
      };
    });
  };

  const handleNotesChange = (evalStudentId, notes) => {
    setStudentNotes(prev => ({
      ...prev,
      [evalStudentId]: notes
    }));
  };

  const handleSaveClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmedSave = async () => {
    setShowConfirmation(false);
    setSaving(true);
    setSyncStatus('saving');
    setSyncStep('Saving to database...');

    try {
      const student = evalStudents.find(s => s.class_id === selectedClassId);
      if (!student) {
        throw new Error('No student found for this class');
      }

      const records = [];
      
      for (const evalStudent of evalStudents) {
        const studentEvals = evaluations[evalStudent.id];
        if (studentEvals) {
          // Loop through ALL categories that have data, not just visible ones
          for (const category of allCategories) {
            const evaluation = studentEvals[category.key];
            if (evaluation?.rating) {
              records.push({
                eval_student_id: evalStudent.id,
                teacher_id: user.id,
                class_id: selectedClassId,
                student_name: evalStudent.student_name,
                stored_class_id: selectedClassId,
                chapter_number: selectedChapter,
                category: category.key,
                stored_category: category.key,
                rating: evaluation.rating,
                teacher_notes: studentNotes[evalStudent.id] || null,
                synced_to_sheets: false
              });
            }
          }
        }
      }

      if (records.length === 0) {
        toast.error('Please evaluate at least one student in one category');
        setSaving(false);
        setSyncStatus(null);
        return;
      }

      const { data: savedRecords, error: saveError } = await supabase
        .from('lesson_evaluations')
        .upsert(records, {
          onConflict: 'eval_student_id,chapter_number,category',
          returning: 'representation'
        })
        .select();

      if (saveError) throw saveError;

      toast.success('Evaluations saved to database!');

      toast.success('Evaluations saved to database!');

      // Start sync phase
      setSyncStatus('syncing');
      setSyncStep('Syncing to Google Sheets...');

      try {
        await batchSyncEvaluations(savedRecords);
        
        setSyncStatus('complete');
        setSyncStep('Successfully synced to Google Sheets!');
        toast.success('Synced to Google Sheets!');
        
        const updatedEvaluations = { ...evaluations };
        savedRecords.forEach(record => {
          if (updatedEvaluations[record.eval_student_id]?.[record.category]) {
            updatedEvaluations[record.eval_student_id][record.category].synced = true;
          }
        });
        setEvaluations(updatedEvaluations);
        
        // Auto-close success message after 2 seconds
        setTimeout(() => {
          setSyncStatus(null);
        }, 2000);
        
      } catch (syncError) {
        console.error('Sync error:', syncError);
        setSyncStatus(null);
        setShowSyncErrorModal(true);
      }

    } catch (error) {
      console.error('Error saving evaluations:', error);
      toast.error('Failed to save evaluations');
      setSyncStatus(null);
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: evalStudents.length,
    evaluated: Object.keys(evaluations).length,
    synced: Object.values(evaluations).filter(studentEvals => 
      Object.values(studentEvals).every(e => e.synced)
    ).length
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center', color: 'white' }}
        >
          <Loader style={{ width: '48px', height: '48px', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '18px', fontWeight: '600' }}>Loading Evaluation Page...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      paddingTop: isMobile ? '80px' : '100px',
      paddingBottom: isMobile ? '80px' : '40px',
      paddingLeft: isMobile ? '16px' : '24px',
      paddingRight: isMobile ? '16px' : '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Sync Status Modal */}
      <AnimatePresence>
        {syncStatus && (
          <motion.div
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
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                background: 'white',
                borderRadius: '24px',
                padding: isMobile ? '32px 24px' : '48px 40px',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }}
            >
              {syncStatus === 'saving' && (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Database style={{ width: '64px', height: '64px', color: '#3b82f6', margin: '0 auto 20px' }} />
                  </motion.div>
                  <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
                    Saving to Database
                  </h3>
                  <p style={{ fontSize: '15px', color: '#64748b', marginBottom: 0 }}>
                    {syncStep}
                  </p>
                </>
              )}

              {syncStatus === 'syncing' && (
                <>
                  <motion.div
                    animate={{ 
                      y: [0, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Cloud style={{ width: '64px', height: '64px', color: '#10b981', margin: '0 auto 20px' }} />
                  </motion.div>
                  <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
                    Syncing to Google Sheets
                  </h3>
                  <p style={{ fontSize: '15px', color: '#64748b', marginBottom: 0 }}>
                    {syncStep}
                  </p>
                </>
              )}

              {syncStatus === 'complete' && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.5 }}
                  >
                    <CheckCircle2 style={{ width: '64px', height: '64px', color: '#10b981', margin: '0 auto 20px' }} />
                  </motion.div>
                  <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
                    Success!
                  </h3>
                  <p style={{ fontSize: '15px', color: '#64748b', marginBottom: 0 }}>
                    All evaluations saved and synced
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Criteria Modal */}
      <AnimatePresence>
        {showAddCriteriaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddCriteriaModal(false)}
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
              zIndex: 9998,
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: isMobile ? '24px' : '32px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Plus style={{ width: '24px', height: '24px', color: '#667eea' }} />
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: 0
                  }}>
                    Manage Criteria
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddCriteriaModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px'
                  }}
                >
                  <X style={{ width: '24px', height: '24px' }} />
                </button>
              </div>

              {visibilitySettings.admin_override && (
                <div style={{
                  background: '#fef3c7',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '10px'
                }}>
                  <Lock style={{ width: '20px', height: '20px', color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#92400e',
                      marginBottom: '4px'
                    }}>
                      Settings Locked
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#92400e',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Your evaluation criteria have been configured by an administrator and cannot be changed.
                    </p>
                  </div>
                </div>
              )}

              {/* Active Criteria */}
              {categories.length > 0 && (
                <>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#475569',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Active Criteria ({categories.length})
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    {categories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <motion.div
                          key={category.key}
                          whileHover={{ scale: 1.01 }}
                          style={{
                            width: '100%',
                            padding: '16px',
                            background: `${category.color}10`,
                            border: `2px solid ${category.color}40`,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: category.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Icon style={{ width: '20px', height: '20px', color: 'white' }} />
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>
                              {category.label}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b'
                            }}>
                              Currently active
                            </div>
                          </div>
                          {!visibilitySettings.admin_override && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRemoveCriteria(category.key)}
                              disabled={categories.length <= 1}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: categories.length <= 1 ? '#f1f5f9' : '#fee2e2',
                                border: categories.length <= 1 ? '1.5px solid #e2e8f0' : '1.5px solid #ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: categories.length <= 1 ? 'not-allowed' : 'pointer',
                                flexShrink: 0,
                                opacity: categories.length <= 1 ? 0.5 : 1
                              }}
                              title={categories.length <= 1 ? 'At least one criteria must be active' : 'Remove criteria'}
                            >
                              <span style={{
                                fontSize: '20px',
                                fontWeight: '800',
                                lineHeight: 1,
                                color: categories.length <= 1 ? '#94a3b8' : '#dc2626'
                              }}>
                                −
                              </span>
                            </motion.button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Available Criteria to Add */}
              {hiddenCategories.length === 0 ? (
                categories.length === 0 ? null : (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    color: '#64748b'
                  }}>
                    <CheckCircle2 style={{ width: '40px', height: '40px', margin: '0 auto 12px', color: '#10b981' }} />
                    <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                      All criteria are active
                    </p>
                    <p style={{ fontSize: '12px', margin: 0 }}>
                      You're using all available evaluation criteria.
                    </p>
                  </div>
                )
              ) : (
                <>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#475569',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Available Criteria ({hiddenCategories.length})
                  </div>

                  <p style={{
                    fontSize: '13px',
                    color: '#64748b',
                    marginBottom: '12px'
                  }}>
                    Click to add to your evaluations:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {hiddenCategories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <motion.button
                          key={category.key}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAddCriteria(category.key)}
                          disabled={visibilitySettings.admin_override}
                          style={{
                            width: '100%',
                            padding: '16px',
                            background: 'white',
                            border: `2px solid ${category.color}30`,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: visibilitySettings.admin_override ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            opacity: visibilitySettings.admin_override ? 0.5 : 1
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: `${category.color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Icon style={{ width: '20px', height: '20px', color: category.color }} />
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>
                              {category.label}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b'
                            }}>
                              Click to add to your evaluations
                            </div>
                          </div>
                          <Plus style={{
                            width: '20px',
                            height: '20px',
                            color: category.color,
                            flexShrink: 0
                          }} />
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <button
                  onClick={() => setShowAddCriteriaModal(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student-Specific Criteria Modal */}
      <AnimatePresence>
        {showStudentCriteriaModal && selectedStudentForCriteria && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowStudentCriteriaModal(false)}
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
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: isMobile ? '24px' : '32px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <Plus style={{ width: '24px', height: '24px', color: '#667eea' }} />
                    <h3 style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#1e293b',
                      margin: 0
                    }}>
                      Manage Criteria
                    </h3>
                  </div>
                  <p style={{
                    fontSize: '13px',
                    color: '#64748b',
                    margin: 0,
                    paddingLeft: '36px'
                  }}>
                    {selectedStudentForCriteria.student_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowStudentCriteriaModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px'
                  }}
                >
                  <X style={{ width: '24px', height: '24px' }} />
                </button>
              </div>

              {/* Show if student has custom settings */}
              {studentCriteriaOverrides[selectedStudentForCriteria.id] && (
                <div style={{
                  background: '#fef3c7',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '10px'
                }}>
                  <AlertCircle style={{ width: '18px', height: '18px', color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#92400e',
                      marginBottom: '8px'
                    }}>
                      Custom criteria active for this student
                    </p>
                    <button
                      onClick={() => handleResetStudentCriteria(selectedStudentForCriteria.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'white',
                        border: '1.5px solid #f59e0b',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#92400e',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#fef3c7'}
                      onMouseLeave={(e) => e.target.style.background = 'white'}
                    >
                      Reset to Defaults
                    </button>
                  </div>
                </div>
              )}

              {/* Active Criteria */}
              {getStudentCategories(selectedStudentForCriteria.id).length > 0 && (
                <>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#475569',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Active Criteria ({getStudentCategories(selectedStudentForCriteria.id).length})
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    {getStudentCategories(selectedStudentForCriteria.id).map((category) => {
                      const Icon = category.icon;
                      return (
                        <motion.div
                          key={category.key}
                          whileHover={{ scale: 1.01 }}
                          style={{
                            width: '100%',
                            padding: '16px',
                            background: `${category.color}10`,
                            border: `2px solid ${category.color}40`,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: category.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Icon style={{ width: '20px', height: '20px', color: 'white' }} />
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>
                              {category.label}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b'
                            }}>
                              Currently active
                            </div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleRemoveStudentCriteria(selectedStudentForCriteria.id, category.key)}
                            disabled={getStudentCategories(selectedStudentForCriteria.id).length <= 1}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: getStudentCategories(selectedStudentForCriteria.id).length <= 1 ? '#f1f5f9' : '#fee2e2',
                              border: getStudentCategories(selectedStudentForCriteria.id).length <= 1 ? '1.5px solid #e2e8f0' : '1.5px solid #ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: getStudentCategories(selectedStudentForCriteria.id).length <= 1 ? 'not-allowed' : 'pointer',
                              flexShrink: 0,
                              opacity: getStudentCategories(selectedStudentForCriteria.id).length <= 1 ? 0.5 : 1
                            }}
                            title={getStudentCategories(selectedStudentForCriteria.id).length <= 1 ? 'At least one criteria must be active' : 'Remove criteria'}
                          >
                            <span style={{
                              fontSize: '20px',
                              fontWeight: '800',
                              lineHeight: 1,
                              color: getStudentCategories(selectedStudentForCriteria.id).length <= 1 ? '#94a3b8' : '#dc2626'
                            }}>
                              −
                            </span>
                          </motion.button>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Available Criteria */}
              {getStudentHiddenCategories(selectedStudentForCriteria.id).length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  color: '#64748b'
                }}>
                  <CheckCircle2 style={{ width: '40px', height: '40px', margin: '0 auto 12px', color: '#10b981' }} />
                  <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                    All criteria are active
                  </p>
                  <p style={{ fontSize: '12px', margin: 0 }}>
                    This student is using all available criteria.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#475569',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Available Criteria ({getStudentHiddenCategories(selectedStudentForCriteria.id).length})
                  </div>

                  <p style={{
                    fontSize: '13px',
                    color: '#64748b',
                    marginBottom: '12px'
                  }}>
                    Click to add to this student's evaluations:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {getStudentHiddenCategories(selectedStudentForCriteria.id).map((category) => {
                      const Icon = category.icon;
                      return (
                        <motion.button
                          key={category.key}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAddStudentCriteria(selectedStudentForCriteria.id, category.key)}
                          style={{
                            width: '100%',
                            padding: '16px',
                            background: 'white',
                            border: `2px solid ${category.color}30`,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: `${category.color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Icon style={{ width: '20px', height: '20px', color: category.color }} />
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>
                              {category.label}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b'
                            }}>
                              Click to add
                            </div>
                          </div>
                          <Plus style={{
                            width: '20px',
                            height: '20px',
                            color: category.color,
                            flexShrink: 0
                          }} />
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <button
                  onClick={() => setShowStudentCriteriaModal(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmation(false)}
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
              zIndex: 9998,
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: isMobile ? '24px' : '32px',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <AlertCircle style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>

              <h3 style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '12px',
                textAlign: 'center'
              }}>
                Save & Sync Evaluations?
              </h3>

              <p style={{
                fontSize: '15px',
                color: '#64748b',
                marginBottom: '24px',
                textAlign: 'center',
                lineHeight: '1.6'
              }}>
                This will save <strong>{stats.evaluated}</strong> student evaluation(s) to the database and sync them to Google Sheets.
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowConfirmation(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmedSave}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync Error Modal */}
      <AnimatePresence>
        {showSyncErrorModal && (
          <motion.div
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
            onClick={() => setShowSyncErrorModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '24px',
                padding: isMobile ? '24px' : '32px',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertCircle style={{ width: '28px', height: '28px', color: 'white' }} />
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSyncErrorModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '12px',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X style={{ width: '20px', height: '20px', color: '#64748b' }} />
                </motion.button>
              </div>

              <h2 style={{
                fontSize: isMobile ? '22px' : '26px',
                fontWeight: '800',
                color: '#1e293b',
                margin: '0 0 12px 0'
              }}>
                Google Sheets Sync Failed
              </h2>

              <p style={{
                fontSize: '15px',
                color: '#64748b',
                lineHeight: '1.6',
                margin: '0 0 24px 0'
              }}>
                Your evaluation data has been saved locally, but we couldn't sync it to Google Sheets. This might be due to an authentication issue.
              </p>

              <div style={{
                background: '#fef3c7',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                border: '1px solid #fcd34d'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: '12px'
                }}>
                  <AlertCircle style={{ width: '20px', height: '20px', color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#92400e',
                      margin: '0 0 4px 0'
                    }}>
                      Recommended Action
                    </p>
                    <p style={{
                      fontSize: '13px',
                      color: '#78350f',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Try logging out and logging back in to refresh your Google authentication.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSyncErrorModal(false)}
                  style={{
                    flex: 1,
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 24px',
                    fontSize: '15px',
                    fontWeight: '700',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowSyncErrorModal(false);
                    handleSignOut();
                  }}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 24px',
                    fontSize: '15px',
                    fontWeight: '700',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <LogOut style={{ width: '18px', height: '18px' }} />
                  Logout & Retry
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div style={{
        maxWidth: isMobile ? '100%' : '800px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: isMobile ? '16px' : '20px',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? '12px' : '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <motion.button
                whileHover={{ scale: 1.05, x: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/teacher')}
                style={{
                  padding: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  color: 'white'
                }}
              >
                <ArrowLeft style={{ width: '20px', height: '20px' }} />
              </motion.button>
              <div>
                <h1 style={{
                  fontSize: isMobile ? '20px' : '26px',
                  fontWeight: '800',
                  color: '#1e293b',
                  margin: 0,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  <TrendingUp style={{ width: isMobile ? '24px' : '28px', height: isMobile ? '24px' : '28px', color: '#667eea' }} />
                  Evaluation
                </h1>
                <p style={{
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#64748b',
                  margin: 0,
                  fontWeight: '500'
                }}>
                  Chapter {selectedChapter} • {classInfo?.name || 'Loading...'}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Class Selector */}
          {isAdmin && allClasses.length > 0 && (
            <div style={{
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#475569',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Select Class (Admin View)
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 16px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1e293b',
                    background: 'white',
                    cursor: 'pointer',
                    appearance: 'none'
                  }}
                >
                  {allClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.section ? `(Section ${cls.section})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20px',
                  height: '20px',
                  color: '#64748b',
                  pointerEvents: 'none'
                }} />
              </div>
            </div>
          )}

          {/* Chapter Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '700',
              color: '#475569',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Chapter
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(5, 1fr)' : 'repeat(10, 1fr)',
              gap: '8px'
            }}>
              {chapterOptions.map((chapter) => (
                <motion.button
                  key={chapter}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedChapter(chapter)}
                  style={{
                    padding: '10px',
                    border: selectedChapter === chapter ? 'none' : '1.5px solid #e2e8f0',
                    background: selectedChapter === chapter 
                      ? 'linear-gradient(135deg, #667eea, #764ba2)'
                      : 'white',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: selectedChapter === chapter ? 'white' : '#64748b',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedChapter === chapter 
                      ? '0 4px 12px rgba(102, 126, 234, 0.3)'
                      : 'none'
                  }}
                >
                  {chapter}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Stats and Add Criteria Button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              gap: isMobile ? '8px' : '12px',
              flex: 1,
              overflow: 'auto'
            }}>
              <div style={{
                padding: isMobile ? '8px 12px' : '8px 16px',
                background: 'linear-gradient(135deg, #667eea15, #764ba215)',
                borderRadius: '10px',
                border: '1.5px solid #667eea30',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '16px', height: '16px', color: '#667eea' }} />
                  <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '700', color: '#475569' }}>
                    {stats.total} Students
                  </span>
                </div>
              </div>

              <div style={{
                padding: isMobile ? '8px 12px' : '8px 16px',
                background: 'linear-gradient(135deg, #f59e0b15, #d9770615)',
                borderRadius: '10px',
                border: '1.5px solid #f59e0b30',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                  <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '700', color: '#475569' }}>
                    {stats.evaluated} Evaluated
                  </span>
                </div>
              </div>

              <div style={{
                padding: isMobile ? '8px 12px' : '8px 16px',
                background: 'linear-gradient(135deg, #10b98115, #05966915)',
                borderRadius: '10px',
                border: '1.5px solid #10b98130',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check style={{ width: '16px', height: '16px', color: '#10b981' }} />
                  <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '700', color: '#475569' }}>
                    {stats.synced} Synced
                  </span>
                </div>
              </div>
            </div>

            {/* Add More Criteria Button */}
            {hiddenCategories.length > 0 && !visibilitySettings.admin_override && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddCriteriaModal(true)}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                {isMobile ? 'Add' : 'Add Criteria'}
              </motion.button>
            )}

            {visibilitySettings.admin_override && (
              <div style={{
                padding: '8px 16px',
                background: '#fef3c7',
                borderRadius: '10px',
                border: '1.5px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Lock style={{ width: '14px', height: '14px', color: '#f59e0b' }} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                  Admin Locked
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Student Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: isMobile ? '12px' : '16px',
          marginBottom: '100px'
        }}>
          <AnimatePresence>
            {evalStudents.map((student, index) => {
              const studentEval = evaluations[student.id] || {};
              const hasAnyEval = Object.keys(studentEval).length > 0;

              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.03 }}
                  style={{
                    background: hasAnyEval 
                      ? 'rgba(255, 255, 255, 0.98)' 
                      : 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: isMobile ? '12px' : '16px',
                    padding: isMobile ? '12px' : '16px',
                    boxShadow: hasAnyEval 
                      ? '0 8px 24px rgba(16, 185, 129, 0.15)'
                      : '0 4px 16px rgba(0,0,0,0.08)',
                    border: hasAnyEval 
                      ? '2px solid #10b98120'
                      : '1.5px solid transparent',
                    transition: 'all 0.3s ease',
                    position: 'relative'
                  }}
                >
                  {hasAnyEval && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        zIndex: 10
                      }}
                    >
                      <Check style={{ width: '14px', height: '14px', color: 'white' }} />
                    </motion.div>
                  )}

                  {/* Student Name */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '8px' : '10px',
                    marginBottom: isMobile ? '10px' : '12px',
                    paddingBottom: isMobile ? '10px' : '12px',
                    borderBottom: '1.5px solid #e2e8f0'
                  }}>
                    <div style={{
                      width: isMobile ? '32px' : '36px',
                      height: isMobile ? '32px' : '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '12px' : '14px',
                      fontWeight: '700',
                      color: 'white',
                      flexShrink: 0
                    }}>
                      {student.student_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{
                        fontSize: isMobile ? '14px' : '15px',
                        fontWeight: '700',
                        color: '#1e293b',
                        margin: 0,
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {student.student_name}
                      </h3>
                      {student.house && (
                        <p style={{
                          fontSize: isMobile ? '11px' : '12px',
                          color: '#64748b',
                          margin: 0,
                          fontWeight: '500'
                        }}>
                          🏠 {student.house}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleOpenStudentCriteriaModal(student)}
                        style={{
                          minWidth: isMobile ? '28px' : '32px',
                          height: isMobile ? '28px' : '32px',
                          padding: isMobile ? '4px' : '6px',
                          borderRadius: '8px',
                          background: studentCriteriaOverrides[student.id] ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f1f5f9',
                          border: studentCriteriaOverrides[student.id] ? 'none' : '1.5px solid #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: studentCriteriaOverrides[student.id] ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                          transition: 'all 0.2s ease',
                          marginRight: hasAnyEval ? (isMobile ? '30px' : '36px') : '0'
                        }}
                        title="Add/Remove criteria for this student"
                      >
                        <Plus 
                          size={isMobile ? 16 : 18}
                          strokeWidth={3}
                          style={{
                            color: studentCriteriaOverrides[student.id] ? '#ffffff' : '#475569'
                          }} 
                        />
                      </motion.button>
                    </div>
                  </div>

                  {/* Evaluation Categories */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: isMobile ? '8px' : '10px',
                    marginBottom: isMobile ? '10px' : '12px'
                  }}>
                    {getStudentCategories(student.id).map((category) => {
                      const Icon = category.icon;
                      const currentRating = studentEval[category.key]?.rating;

                      return (
                        <div key={category.key}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: isMobile ? '4px' : '6px',
                            marginBottom: isMobile ? '4px' : '6px'
                          }}>
                            <Icon style={{
                              width: isMobile ? '12px' : '14px',
                              height: isMobile ? '12px' : '14px',
                              color: category.color,
                              flexShrink: 0
                            }} />
                            <span style={{
                              fontSize: isMobile ? '10px' : '11px',
                              fontWeight: '700',
                              color: '#475569',
                              letterSpacing: '0.3px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {category.label}
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            gap: isMobile ? '3px' : '4px'
                          }}>
                            {ratings.map((rating) => {
                              const isSelected = currentRating === rating.value;
                              return (
                                <motion.button
                                  key={rating.value}
                                  whileHover={!saving ? { scale: 1.1 } : {}}
                                  whileTap={!saving ? { scale: 0.9 } : {}}
                                  onClick={() => handleEvaluationChange(student.id, category.key, rating.value)}
                                  disabled={saving}
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    padding: isMobile ? '8px 4px' : '6px',
                                    border: isSelected 
                                      ? 'none'
                                      : `1.5px solid ${rating.color}30`,
                                    background: isSelected 
                                      ? rating.color
                                      : rating.bg,
                                    borderRadius: isMobile ? '6px' : '6px',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: saving ? 0.6 : 1,
                                    boxShadow: isSelected 
                                      ? `0 4px 12px ${rating.color}40`
                                      : 'none'
                                  }}
                                >
                                  <span style={{
                                    fontSize: isMobile ? '13px' : '12px',
                                    fontWeight: '800',
                                    color: isSelected ? 'white' : rating.color
                                  }}>
                                    {rating.value}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes Field */}
                  <div style={{
                    background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                    border: '2px solid #c4b5fd30',
                    borderRadius: isMobile ? '10px' : '12px',
                    padding: isMobile ? '10px' : '12px',
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.08)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: isMobile ? '6px' : '8px'
                    }}>
                      <div style={{
                        width: isMobile ? '20px' : '22px',
                        height: isMobile ? '20px' : '22px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText style={{ 
                          width: isMobile ? '11px' : '12px', 
                          height: isMobile ? '11px' : '12px', 
                          color: 'white',
                          strokeWidth: 2.5
                        }} />
                      </div>
                      <span style={{
                        fontSize: isMobile ? '11px' : '12px',
                        fontWeight: '700',
                        color: '#5b21b6',
                        letterSpacing: '0.3px'
                      }}>
                        Teacher Notes
                      </span>
                    </div>
                    <textarea
                      value={studentNotes[student.id] || ''}
                      onChange={(e) => handleNotesChange(student.id, e.target.value)}
                      placeholder="Add notes about this student..."
                      style={{
                        width: '100%',
                        minHeight: isMobile ? '55px' : '65px',
                        padding: isMobile ? '8px 10px' : '10px 12px',
                        border: '2px solid #c4b5fd',
                        borderRadius: '8px',
                        fontSize: isMobile ? '12px' : '13px',
                        fontFamily: 'inherit',
                        color: '#4c1d95',
                        background: 'white',
                        resize: 'vertical',
                        lineHeight: '1.5',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#8b5cf6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1), inset 0 1px 3px rgba(0,0,0,0.05)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#c4b5fd';
                        e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.05)';
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Floating Save & Sync Button */}
        <motion.div
          initial={{ scale: 0, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 260, 
            damping: 20,
            delay: 0.1 
          }}
          style={{
            position: 'fixed',
            bottom: isMobile ? '20px' : '30px',
            left: isMobile ? '20px' : '30px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '8px'
          }}
        >
          <motion.button
            whileHover={saving || stats.evaluated === 0 ? {} : { 
              scale: 1.05,
              transition: { type: "spring", stiffness: 400, damping: 10 }
            }}
            whileTap={saving || stats.evaluated === 0 ? {} : { scale: 0.95 }}
            onClick={handleSaveClick}
            disabled={saving || stats.evaluated === 0}
            style={{
              backgroundImage: saving || stats.evaluated === 0
                ? 'none'
                : 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
              backgroundColor: saving || stats.evaluated === 0
                ? 'rgba(148, 163, 184, 0.85)'
                : 'transparent',
              backgroundSize: '200% 200%',
              animation: saving || stats.evaluated === 0 
                ? 'none' 
                : 'gradient-shift 3s ease infinite, pulse-glow 2s ease-in-out infinite',
              border: 'none',
              borderRadius: '50px',
              padding: isMobile ? '14px 24px' : '16px 28px',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '700',
              color: 'white',
              cursor: saving || stats.evaluated === 0 ? 'not-allowed' : 'pointer',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              minHeight: isMobile ? '52px' : '56px',
              whiteSpace: 'nowrap',
              transition: 'all 0.3s ease',
              boxShadow: saving || stats.evaluated === 0 
                ? '0 4px 12px rgba(100, 116, 139, 0.2)' 
                : '0 8px 24px rgba(16, 185, 129, 0.4)'
            }}
          >
            {saving ? (
              <>
                <Loader style={{ 
                  width: isMobile ? '18px' : '20px', 
                  height: isMobile ? '18px' : '20px', 
                  animation: 'spin 1s linear infinite', 
                  flexShrink: 0 
                }} />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ 
                    rotate: [0, -10, 10, -10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3
                  }}
                >
                  <Save style={{ 
                    width: isMobile ? '18px' : '20px', 
                    height: isMobile ? '18px' : '20px', 
                    flexShrink: 0 
                  }} />
                </motion.div>
                <span>Save & Sync ({stats.evaluated})</span>
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Rating Legend */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            width: '100%',
            marginTop: '16px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            padding: isMobile ? '12px' : '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
          }}
        >
          <h3 style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Rating Guide
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '8px'
          }}>
            {ratings.map((rating) => (
              <div key={rating.value} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                background: rating.bg,
                borderRadius: '8px',
                border: `1.5px solid ${rating.color}25`
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: rating.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '800',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {rating.value}
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569'
                }}>
                  {rating.label}
                </span>
              </div>
            ))}
          </div>
          <p style={{
            fontSize: '11px',
            color: '#94a3b8',
            marginTop: '10px',
            marginBottom: 0,
            fontWeight: '500'
          }}>
            💡 Tip: Click the same rating again to deselect
          </p>
        </motion.div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 8px 32px rgba(16, 185, 129, 0.6); }
        }
      `}</style>
    </div>
  );
};

export default EvaluationPage;