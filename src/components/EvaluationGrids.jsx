import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import supabase from '../utils/supabase';
import { batchSyncEvaluations } from '../utils/googleSheetsEvaluationAPI';
import toast from 'react-hot-toast';
import { Save, Loader, Award, Heart, BookOpen, Zap, Search, Filter, ChevronRight, ChevronLeft } from 'lucide-react';

const EvaluationGrid = ({ evalStudents, chapters, evaluationsData, classId, teacherId, selectedChapter, onDataUpdate }) => {
  const [editMode, setEditMode] = useState(false);
  const [localEvaluations, setLocalEvaluations] = useState({});
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);

  const categories = [
    { key: 'D', label: 'Discipline', color: '#3b82f6', bg: '#dbeafe', icon: Award },
    { key: 'B', label: 'Behaviour', color: '#10b981', bg: '#d1fae5', icon: Heart },
    { key: 'HW', label: 'Homework', color: '#f59e0b', bg: '#fef3c7', icon: BookOpen },
    { key: 'AP', label: 'Active Participation', color: '#8b5cf6', bg: '#ede9fe', icon: Zap }
  ];

  const ratings = [
    { value: 'E', label: 'Excellent', color: '#10b981', bg: '#d1fae5' },
    { value: 'G', label: 'Good', color: '#3b82f6', bg: '#dbeafe' },
    { value: 'I', label: 'Improving', color: '#f59e0b', bg: '#fef3c7' }
  ];

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    
    const handleScroll = () => {
      setShowScrollHint(false);
    };
    
    const container = document.getElementById('evaluation-scroll-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [isMobile]);

  const getEvaluationRating = (studentId, category) => {
    const localKey = `${studentId}|${category}`;
    if (localKey in localEvaluations) {
      return localEvaluations[localKey];
    }
    // Include chapter number in the key to match the evaluationsData map structure
    const evalKey = `${studentId}-${selectedChapter}-${category}`;
    const record = evaluationsData[evalKey];
    return record?.rating || '';
  };

  const handleCellClick = (studentId, category, currentRating) => {
    if (!editMode) return;
    const ratingCycle = ['', 'E', 'G', 'I'];
    const currentIndex = ratingCycle.indexOf(currentRating);
    const nextRating = ratingCycle[(currentIndex + 1) % ratingCycle.length];
    const key = `${studentId}|${category}`;
    setLocalEvaluations(prev => ({
      ...prev,
      [key]: nextRating
    }));
  };

  const handleSaveAndSync = async () => {
    if (Object.keys(localEvaluations).length === 0) {
      toast.error('No changes to save');
      return;
    }

    setSaving(true);
    setSyncStatus('saving');

    try {
      const recordsToProcess = Object.entries(localEvaluations).map(([key, rating]) => {
        const [studentId, category] = key.split('|');
        return { studentId, category, rating };
      });

      const recordsToSave = recordsToProcess
        .filter(r => r.rating !== '')
        .map(r => ({
          eval_student_id: r.studentId,
          teacher_id: teacherId,
          class_id: classId,
          chapter_number: selectedChapter,
          category: r.category,
          rating: r.rating,
          synced_to_sheets: false
        }));

      const recordsToDelete = recordsToProcess
        .filter(r => r.rating === '')
        .map(r => ({ studentId: r.studentId, category: r.category }));

      if (recordsToDelete.length > 0) {
        for (const record of recordsToDelete) {
          await supabase
            .from('lesson_evaluations')
            .delete()
            .eq('eval_student_id', record.studentId)
            .eq('category', record.category)
            .eq('chapter_number', selectedChapter);
        }
      }

      if (recordsToSave.length > 0) {
        const { data: savedRecords, error: upsertError } = await supabase
          .from('lesson_evaluations')
          .upsert(recordsToSave, {
            onConflict: 'eval_student_id,chapter_number,category',
            returning: 'representation'
          })
          .select();

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          throw upsertError;
        }

        toast.success(`Saved ${recordsToSave.length} evaluation records`);

        setSyncStatus('syncing');
        
        try {
          await batchSyncEvaluations(savedRecords);
          
          const recordIds = savedRecords.map(r => r.id);
          await supabase
            .from('lesson_evaluations')
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

      setLocalEvaluations({});
      setEditMode(false);
      setTimeout(() => {
        onDataUpdate();
        setSyncStatus(null);
      }, 1500);

    } catch (error) {
      console.error('Error saving evaluations:', error);
      toast.error(`Failed to save: ${error.message || 'Unknown error'}`);
      setSyncStatus(null);
    } finally {
      setSaving(false);
    }
  };

  const getRatingConfig = (rating) => {
    return ratings.find(r => r.value === rating) || { value: '', color: '#d1d5db', bg: '#ffffff' };
  };

  const getChangedCount = () => {
    return Object.keys(localEvaluations).length;
  };

  const filteredStudents = evalStudents.filter(student => {
    const matchesSearch = student.student_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesCategory = true;
    if (categoryFilter !== 'all') {
      const rating = getEvaluationRating(student.id, categoryFilter);
      matchesCategory = rating !== '';
    }
    
    return matchesSearch && matchesCategory;
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
            Evaluation Grid - Chapter {selectedChapter}
          </h2>
          <p style={{
            fontSize: isMobile ? '12px' : '13px',
            color: '#666',
            margin: 0
          }}>
            {filteredStudents.length} students
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setEditMode(!editMode)}
            style={{
              padding: isMobile ? '10px 16px' : '10px 20px',
              backgroundColor: editMode ? '#10b981' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              minWidth: isMobile ? 'auto' : '100px'
            }}
          >
            {editMode ? '✓ Editing' : 'Edit Mode'}
          </button>

          {editMode && getChangedCount() > 0 && (
            <button
              onClick={handleSaveAndSync}
              disabled={saving}
              style={{
                padding: isMobile ? '10px 16px' : '10px 20px',
                backgroundColor: saving ? '#94a3b8' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {saving ? (
                <>
                  <Loader style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                  Saving...
                </>
              ) : (
                <>
                  <Save style={{ width: '16px', height: '16px' }} />
                  Save ({getChangedCount()})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          position: 'relative'
        }}>
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
              padding: isMobile ? '10px 10px 10px 40px' : '10px 12px 10px 40px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
          />
        </div>

        <div style={{
          position: 'relative'
        }}>
          <Filter style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            color: '#9ca3af'
          }} />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '10px 10px 10px 40px' : '10px 12px 10px 40px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              outline: 'none',
              cursor: 'pointer',
              backgroundColor: 'white'
            }}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scroll hint for mobile */}
      {isMobile && showScrollHint && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#1e40af'
          }}
        >
          <ChevronRight style={{ width: '16px', height: '16px' }} />
          Swipe to see all categories
        </motion.div>
      )}

      {/* Grid Table */}
      <div
        id="evaluation-scroll-container"
        style={{
          overflowX: 'auto',
          overflowY: 'visible',
          marginBottom: '20px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}
      >
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: isMobile ? '800px' : '100%'
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#f9fafb',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <th style={{
                padding: isMobile ? '12px' : '14px 16px',
                textAlign: 'left',
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: '700',
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                position: 'sticky',
                left: 0,
                backgroundColor: '#f9fafb',
                zIndex: 10,
                minWidth: isMobile ? '140px' : '200px'
              }}>
                Student Name
              </th>
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <th
                    key={category.key}
                    style={{
                      padding: isMobile ? '12px 8px' : '14px 16px',
                      textAlign: 'center',
                      fontSize: isMobile ? '11px' : '12px',
                      fontWeight: '700',
                      color: category.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      backgroundColor: category.bg,
                      minWidth: isMobile ? '100px' : '120px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}>
                      <Icon style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
                      {!isMobile && <span>{category.label}</span>}
                      {isMobile && <span>{category.key}</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={categories.length + 1} style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: isMobile ? '14px' : '16px'
                }}>
                  {searchTerm || categoryFilter !== 'all' 
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
                  {categories.map((category) => {
                    const rating = getEvaluationRating(student.id, category.key);
                    const config = getRatingConfig(rating);
                    const localKey = `${student.id}|${category.key}`;
                    const isChanged = localKey in localEvaluations;

                    return (
                      <td
                        key={`${student.id}-${category.key}`}
                        onClick={() => handleCellClick(student.id, category.key, rating)}
                        style={{
                          padding: isMobile ? '8px 4px' : '8px',
                          textAlign: 'center',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: editMode ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          backgroundColor: rating ? config.bg : 'transparent',
                          position: 'relative',
                          border: isChanged ? '2px solid #3b82f6' : undefined,
                          minWidth: isMobile ? '100px' : '120px',
                          ...(editMode && isMobile ? {
                            WebkitTapHighlightColor: 'rgba(16, 185, 129, 0.1)'
                          } : {})
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: isMobile ? '40px' : 'auto'
                        }}>
                          {rating ? (
                            <div style={{
                              width: isMobile ? '28px' : '32px',
                              height: isMobile ? '28px' : '32px',
                              borderRadius: '6px',
                              backgroundColor: config.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: isMobile ? '13px' : '14px',
                              fontWeight: '800',
                              color: 'white'
                            }}>
                              {rating}
                            </div>
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
          Rating Legend
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? '8px' : '12px'
        }}>
          {ratings.map((rating) => (
            <div key={rating.value} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '6px',
                backgroundColor: rating.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '800',
                color: 'white',
                flexShrink: 0
              }}>
                {rating.value}
              </div>
              <span style={{
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                color: '#475569'
              }}>
                {rating.label}
              </span>
            </div>
          ))}
        </div>
        {editMode && (
          <p style={{
            marginTop: '12px',
            marginBottom: 0,
            fontSize: isMobile ? '12px' : '13px',
            color: '#666',
            fontStyle: 'italic'
          }}>
            💡 {isMobile ? 'Tap' : 'Click'} any cell to cycle through ratings
          </p>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          #evaluation-scroll-container::-webkit-scrollbar {
            height: 8px;
          }
          
          #evaluation-scroll-container::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          
          #evaluation-scroll-container::-webkit-scrollbar-thumb {
            background: #8b5cf6;
            border-radius: 4px;
            transition: background 0.2s;
          }
          
          #evaluation-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #7c3aed;
          }
          
          #evaluation-scroll-container {
            -webkit-overflow-scrolling: touch;
          }
        `}
      </style>
    </div>
  );
};

export default EvaluationGrid;