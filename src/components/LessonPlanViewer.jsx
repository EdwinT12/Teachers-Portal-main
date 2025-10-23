import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../utils/supabase';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FileText, Upload, Loader, Download, Eye, Trash2, FolderOpen, X, Folder, Plus, ChevronDown, ChevronRight } from 'lucide-react';

const LessonPlanViewer = ({ isModal = false, onClose = null }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [lessonPlansByClass, setLessonPlansByClass] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, default_class_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load all classes
      const { data: classesData, error: classesError} = await supabase
        .from('classes')
        .select('*')
        .order('year_level');

      if (classesError) throw classesError;
      
      // Add "General" as a special class at the beginning
      const generalClass = {
        id: 'general',
        name: 'General Resources',
        year_level: 0,
        description: 'General teaching resources for all classes'
      };
      
      const allClassesWithGeneral = [generalClass, ...classesData];
      setClasses(allClassesWithGeneral);

      // Set all folders as expanded by default
      const initialExpanded = {};
      allClassesWithGeneral.forEach(cls => {
        initialExpanded[cls.id] = true;
      });
      setExpandedFolders(initialExpanded);

      // Load all lesson plans organized by class
      await loadAllLessonPlans(allClassesWithGeneral);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load lesson plans');
    } finally {
      setLoading(false);
    }
  };

  const loadAllLessonPlans = async (classList) => {
    try {
      // List all files in the lesson-plans bucket
      const { data: files, error } = await supabase.storage
        .from('lesson-plans')
        .list('', {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        console.error('Error loading lesson plans list:', error);
        return;
      }

      // Organize files by class folder
      const filesByClass = {};
      
      classList.forEach(cls => {
        filesByClass[cls.id] = [];
      });

      files.forEach(file => {
        if (file.name.endsWith('.pdf')) {
          // Parse filename to determine which class it belongs to
          // Format: classId_filename.pdf or general_filename.pdf
          const parts = file.name.split('_');
          const classIdentifier = parts[0];
          
          // Find matching class
          const matchingClass = classList.find(cls => {
            if (cls.id === 'general') {
              return classIdentifier === 'general';
            }
            // Match by class ID or sanitized name
            const sanitizedName = cls.name.toLowerCase().replace(/\s+/g, '-');
            return classIdentifier === cls.id || classIdentifier === sanitizedName;
          });

          const classId = matchingClass ? matchingClass.id : 'general';

          const { data } = supabase.storage
            .from('lesson-plans')
            .getPublicUrl(file.name);
          
          // Extract display name (remove classId prefix and .pdf extension)
          let displayName = file.name;
          if (displayName.includes('_')) {
            displayName = displayName.split('_').slice(1).join('_');
          }
          displayName = displayName.replace('.pdf', '').replace(/-/g, ' ');
          
          filesByClass[classId].push({
            name: file.name,
            displayName: displayName,
            url: data.publicUrl,
            size: file.metadata?.size,
            updatedAt: file.updated_at,
            classId: classId
          });
        }
      });

      setLessonPlansByClass(filesByClass);
    } catch (error) {
      console.error('Error loading lesson plans list:', error);
    }
  };

  const toggleFolder = (classId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadFile(file);
    // Set a default name based on the file
    setUploadFileName(file.name.replace('.pdf', ''));
  };

  const handleUpload = async () => {
    if (!uploadFile || !selectedClass || !uploadFileName.trim()) {
      toast.error('Please provide a file and a name');
      return;
    }

    setUploading(true);
    try {
      // Create filename with class prefix and custom name
      const classPrefix = selectedClass.id === 'general' 
        ? 'general'
        : selectedClass.id;
      
      // Sanitize the custom filename
      const sanitizedFileName = uploadFileName.trim().replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-');
      const fileName = `${classPrefix}_${sanitizedFileName}.pdf`;

      // Check if file already exists
      const existingFiles = lessonPlansByClass[selectedClass.id] || [];
      if (existingFiles.some(f => f.name === fileName)) {
        const confirmed = window.confirm('A file with this name already exists. Do you want to replace it?');
        if (!confirmed) {
          setUploading(false);
          return;
        }
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('lesson-plans')
        .upload(fileName, uploadFile, {
          cacheControl: '3600',
          upsert: true // Replace if exists
        });

      if (uploadError) throw uploadError;

      toast.success('Lesson plan uploaded successfully!');
      setUploadFile(null);
      setUploadFileName('');
      setShowUploadModal(false);
      
      // Reload the lesson plans
      await loadAllLessonPlans(classes);

    } catch (error) {
      console.error('Error uploading lesson plan:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${file.displayName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.storage
        .from('lesson-plans')
        .remove([file.name]);

      if (error) throw error;

      toast.success('Lesson plan deleted successfully!');
      
      // If the deleted file was selected, clear selection
      if (selectedFile?.name === file.name) {
        setSelectedFile(null);
      }
      
      // Reload lesson plans
      await loadAllLessonPlans(classes);

    } catch (error) {
      console.error('Error deleting lesson plan:', error);
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: isModal ? '400px' : '100vh',
        backgroundColor: isModal ? 'transparent' : '#f5f5f5'
      }}>
        <Loader style={{
          width: '50px',
          height: '50px',
          color: '#4CAF50',
          animation: 'spin 1s linear infinite'
        }} />
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

  const content = (
    <div style={{
      maxWidth: isModal ? '100%' : '1200px',
      margin: isModal ? '0' : '0 auto',
      padding: isModal ? '0' : '24px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: '0 0 8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <FolderOpen style={{ width: '28px', height: '28px', color: '#4CAF50' }} />
              Lesson Plans
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#666',
              margin: 0
            }}>
              Organize and manage lesson plans by class
            </p>
          </div>

          {(profile?.role === 'admin' || profile?.role === 'teacher') && (
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              <Plus style={{ width: '18px', height: '18px' }} />
              Upload New File
            </button>
          )}
        </div>

        {/* Main Content - Split View */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedFile ? '350px 1fr' : '1fr',
          gap: '24px',
          minHeight: '500px'
        }}>
          {/* Folder Tree View */}
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            padding: '20px',
            overflowY: 'auto',
            maxHeight: '700px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#374151',
              margin: '0 0 16px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Classes
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {classes.map((cls) => {
                const files = lessonPlansByClass[cls.id] || [];
                const isExpanded = expandedFolders[cls.id];
                
                return (
                  <div key={cls.id}>
                    {/* Folder Header */}
                    <div
                      onClick={() => toggleFolder(cls.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '1px solid #e5e7eb'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#4CAF50';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                      ) : (
                        <ChevronRight style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                      )}
                      <Folder style={{ 
                        width: '20px', 
                        height: '20px', 
                        color: cls.id === 'general' ? '#3b82f6' : '#f59e0b' 
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1a1a1a'
                        }}>
                          {cls.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          {files.length} file{files.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Folder Contents */}
                    <AnimatePresence>
                      {isExpanded && files.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{
                            overflow: 'hidden',
                            marginLeft: '24px',
                            marginTop: '4px'
                          }}
                        >
                          {files.map((file) => (
                            <div
                              key={file.name}
                              onClick={() => setSelectedFile(file)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                padding: '10px 12px',
                                marginBottom: '4px',
                                backgroundColor: selectedFile?.name === file.name ? '#e0f2fe' : 'white',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: selectedFile?.name === file.name ? '1px solid #3b82f6' : '1px solid transparent'
                              }}
                              onMouseEnter={(e) => {
                                if (selectedFile?.name !== file.name) {
                                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedFile?.name !== file.name) {
                                  e.currentTarget.style.backgroundColor = 'white';
                                }
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                <FileText style={{ width: '16px', height: '16px', color: '#ef4444', flexShrink: 0 }} />
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  color: '#1a1a1a',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {file.displayName}
                                </div>
                              </div>
                              {(profile?.role === 'admin' || profile?.role === 'teacher') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(file);
                                  }}
                                  style={{
                                    padding: '4px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <Trash2 style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                                </button>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                      {isExpanded && files.length === 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{
                            marginLeft: '24px',
                            marginTop: '4px',
                            padding: '12px',
                            fontSize: '13px',
                            color: '#9ca3af',
                            fontStyle: 'italic'
                          }}
                        >
                          No files in this folder
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PDF Viewer */}
          {selectedFile ? (
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* File Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1a1a1a',
                    margin: '0 0 8px 0'
                  }}>
                    {selectedFile.displayName}
                  </h3>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '13px',
                    color: '#6b7280'
                  }}>
                    <span>Size: {formatFileSize(selectedFile.size)}</span>
                    <span>Updated: {formatDate(selectedFile.updatedAt)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => window.open(selectedFile.url, '_blank')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  >
                    <Download style={{ width: '14px', height: '14px' }} />
                    Download
                  </button>
                  <button
                    onClick={() => setSelectedFile(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  >
                    <X style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              </div>

              {/* PDF iframe */}
              <div style={{
                flex: 1,
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'white',
                minHeight: '600px'
              }}>
                <iframe
                  src={selectedFile.url}
                  title={selectedFile.displayName}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    minHeight: '600px'
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              padding: '80px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                marginBottom: '24px',
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText style={{ width: '40px', height: '40px', color: '#9ca3af' }} />
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1a1a1a',
                margin: '0 0 8px 0'
              }}>
                No File Selected
              </h3>
              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                margin: 0,
                maxWidth: '400px'
              }}>
                Click on any lesson plan file from the folders on the left to view it here
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  // Upload Modal
  const uploadModal = showUploadModal && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setShowUploadModal(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
      >
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1a1a1a',
          margin: '0 0 24px 0'
        }}>
          Upload Lesson Plan
        </h3>

        {/* Class Selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Select Class Folder
          </label>
          <select
            value={selectedClass?.id || ''}
            onChange={(e) => {
              const cls = classes.find(c => c.id === e.target.value);
              setSelectedClass(cls);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="">Choose a class...</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* File Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Select PDF File
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        {/* File Name Input */}
        {uploadFile && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              File Name (without .pdf)
            </label>
            <input
              type="text"
              value={uploadFileName}
              onChange={(e) => setUploadFileName(e.target.value)}
              placeholder="e.g., Week 1 - Introduction"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => {
              setShowUploadModal(false);
              setUploadFile(null);
              setUploadFileName('');
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !uploadFile || !selectedClass || !uploadFileName.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: uploading || !uploadFile || !selectedClass || !uploadFileName.trim() ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: uploading || !uploadFile || !selectedClass || !uploadFileName.trim() ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!uploading && uploadFile && selectedClass && uploadFileName.trim()) {
                e.currentTarget.style.backgroundColor = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              if (!uploading && uploadFile && selectedClass && uploadFileName.trim()) {
                e.currentTarget.style.backgroundColor = '#10b981';
              }
            }}
          >
            {uploading ? (
              <>
                <Loader style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                Uploading...
              </>
            ) : (
              <>
                <Upload style={{ width: '16px', height: '16px' }} />
                Upload File
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  // If used as a modal
  if (isModal && onClose) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '1400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            >
              <X style={{ width: '20px', height: '20px', color: '#666' }} />
            </button>

            {content}
          </motion.div>
        </motion.div>
        <AnimatePresence>
          {uploadModal}
        </AnimatePresence>
      </>
    );
  }

  // Standalone page view
  return (
    <>
      <div style={{
        paddingTop: '80px',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        {content}
      </div>
      <AnimatePresence>
        {uploadModal}
      </AnimatePresence>
    </>
  );
};

export default LessonPlanViewer;