import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../utils/supabase';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FileText, Upload, Loader, Download, Eye, Trash2, FolderOpen, X, Folder, Plus, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

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
  const [isMobile, setIsMobile] = useState(false);

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

  const handleOpenFile = (file) => {
    window.open(file.url, '_blank');
  };

  const handleDownloadFile = async (file) => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.displayName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download started!');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: '#666'
      }}>
        <Loader style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const content = (
    <div style={{
      maxWidth: isModal ? '100%' : '1400px',
      margin: isModal ? '0' : '0 auto',
      padding: isModal ? '0' : isMobile ? '16px' : '24px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: isMobile ? '20px' : '32px',
        gap: isMobile ? '16px' : '0'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FolderOpen style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: 'white' }} />
            </div>
            <h2 style={{
              fontSize: isMobile ? '22px' : '28px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Lesson Plans
            </h2>
          </div>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#666',
            margin: 0
          }}>
            Organize and manage lesson plans by class
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: isMobile ? '12px 20px' : '12px 24px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#059669';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#10b981';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          }}
        >
          <Plus style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
          Upload New File
        </button>
      </div>

      {/* Class Folders */}
      <div style={{
        display: 'grid',
        gap: isMobile ? '12px' : '16px'
      }}>
        {classes.map((classItem) => {
          const files = lessonPlansByClass[classItem.id] || [];
          const isExpanded = expandedFolders[classItem.id];
          const fileCount = files.length;

          return (
            <motion.div
              key={classItem.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                backgroundColor: 'white',
                borderRadius: isMobile ? '12px' : '16px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                transition: 'all 0.2s'
              }}
            >
              {/* Folder Header */}
              <div
                onClick={() => toggleFolder(classItem.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isMobile ? '16px' : '20px 24px',
                  cursor: 'pointer',
                  backgroundColor: isExpanded ? '#f9fafb' : 'white',
                  borderBottom: isExpanded && fileCount > 0 ? '1px solid #e5e7eb' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight style={{
                      width: isMobile ? '20px' : '24px',
                      height: isMobile ? '20px' : '24px',
                      color: '#10b981'
                    }} />
                  </motion.div>
                  <Folder style={{
                    width: isMobile ? '24px' : '28px',
                    height: isMobile ? '24px' : '28px',
                    color: classItem.id === 'general' ? '#8b5cf6' : '#10b981'
                  }} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: '700',
                      color: '#1a1a1a',
                      margin: 0
                    }}>
                      {classItem.name}
                    </h3>
                    {classItem.description && (
                      <p style={{
                        fontSize: isMobile ? '12px' : '13px',
                        color: '#666',
                        margin: '2px 0 0 0'
                      }}>
                        {classItem.description}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: '600',
                    color: fileCount > 0 ? '#10b981' : '#9ca3af',
                    backgroundColor: fileCount > 0 ? '#d1fae5' : '#f3f4f6',
                    padding: '4px 12px',
                    borderRadius: '12px'
                  }}>
                    {fileCount} {fileCount === 1 ? 'file' : 'files'}
                  </span>
                </div>
              </div>

              {/* Files List */}
              <AnimatePresence>
                {isExpanded && fileCount > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      padding: isMobile ? '12px' : '16px 24px 24px 24px'
                    }}>
                      <div style={{
                        display: 'grid',
                        gap: isMobile ? '8px' : '12px'
                      }}>
                        {files.map((file, index) => (
                          <motion.div
                            key={file.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: isMobile ? '10px' : '16px',
                              padding: isMobile ? '12px' : '16px',
                              backgroundColor: '#f9fafb',
                              borderRadius: isMobile ? '8px' : '12px',
                              border: '1px solid #e5e7eb',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                              e.currentTarget.style.borderColor = '#10b981';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                              e.currentTarget.style.borderColor = '#e5e7eb';
                            }}
                          >
                            {/* File Icon */}
                            <div style={{
                              width: isMobile ? '36px' : '44px',
                              height: isMobile ? '36px' : '44px',
                              borderRadius: '8px',
                              backgroundColor: '#fee2e2',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <FileText style={{
                                width: isMobile ? '18px' : '22px',
                                height: isMobile ? '18px' : '22px',
                                color: '#dc2626'
                              }} />
                            </div>

                            {/* File Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{
                                fontSize: isMobile ? '14px' : '15px',
                                fontWeight: '600',
                                color: '#1a1a1a',
                                margin: '0 0 4px 0',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: isMobile ? 'normal' : 'nowrap'
                              }}>
                                {file.displayName}
                              </h4>
                              <div style={{
                                display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '2px' : '12px',
                                fontSize: isMobile ? '11px' : '12px',
                                color: '#9ca3af'
                              }}>
                                {file.size && (
                                  <span>{formatFileSize(file.size)}</span>
                                )}
                                {file.updatedAt && (
                                  <span>Updated {formatDate(file.updatedAt)}</span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{
                              display: 'flex',
                              gap: isMobile ? '6px' : '8px',
                              flexShrink: 0
                            }}>
                              {/* Open Button */}
                              <button
                                onClick={() => handleOpenFile(file)}
                                title="Open file"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: isMobile ? '4px' : '6px',
                                  padding: isMobile ? '8px 12px' : '8px 16px',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: isMobile ? '12px' : '13px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#059669';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#10b981';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <ExternalLink style={{
                                  width: isMobile ? '14px' : '16px',
                                  height: isMobile ? '14px' : '16px'
                                }} />
                                {!isMobile && 'Open'}
                              </button>

                              {/* Download Button */}
                              <button
                                onClick={() => handleDownloadFile(file)}
                                title="Download file"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: isMobile ? '8px' : '8px 12px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#2563eb';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#3b82f6';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <Download style={{
                                  width: isMobile ? '14px' : '16px',
                                  height: isMobile ? '14px' : '16px'
                                }} />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDelete(file)}
                                title="Delete file"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: isMobile ? '8px' : '8px 12px',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#dc2626';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#ef4444';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <Trash2 style={{
                                  width: isMobile ? '14px' : '16px',
                                  height: isMobile ? '14px' : '16px'
                                }} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Empty State */}
                {isExpanded && fileCount === 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{
                      padding: isMobile ? '24px' : '32px',
                      textAlign: 'center'
                    }}
                  >
                    <FileText style={{
                      width: isMobile ? '40px' : '48px',
                      height: isMobile ? '40px' : '48px',
                      color: '#d1d5db',
                      margin: '0 auto 12px'
                    }} />
                    <p style={{
                      fontSize: isMobile ? '13px' : '14px',
                      color: '#9ca3af',
                      margin: 0
                    }}>
                      No files in this folder
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  // Upload Modal
  const uploadModal = showUploadModal && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => {
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadFileName('');
      }}
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
        padding: isMobile ? '16px' : '20px',
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
          borderRadius: isMobile ? '16px' : '20px',
          padding: isMobile ? '24px' : '32px',
          maxWidth: isMobile ? '100%' : '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            setShowUploadModal(false);
            setUploadFile(null);
            setUploadFileName('');
          }}
          style={{
            position: 'absolute',
            top: isMobile ? '12px' : '16px',
            right: isMobile ? '12px' : '16px',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '50%',
            width: isMobile ? '32px' : '36px',
            height: isMobile ? '32px' : '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        >
          <X style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#666' }} />
        </button>

        <h3 style={{
          fontSize: isMobile ? '20px' : '24px',
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
            fontSize: isMobile ? '13px' : '14px',
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
              padding: isMobile ? '10px 12px' : '12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
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
            fontSize: isMobile ? '13px' : '14px',
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
              fontSize: isMobile ? '13px' : '14px'
            }}
          />
        </div>

        {/* File Name Input */}
        {uploadFile && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '13px' : '14px',
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
                padding: isMobile ? '10px 12px' : '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px'
              }}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          flexDirection: isMobile ? 'column-reverse' : 'row'
        }}>
          <button
            onClick={() => {
              setShowUploadModal(false);
              setUploadFile(null);
              setUploadFileName('');
            }}
            style={{
              padding: isMobile ? '12px 20px' : '10px 20px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '14px',
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
              justifyContent: 'center',
              gap: '8px',
              padding: isMobile ? '12px 20px' : '10px 20px',
              backgroundColor: uploading || !uploadFile || !selectedClass || !uploadFileName.trim() ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '14px',
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
            padding: isMobile ? '16px' : '20px',
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
              borderRadius: isMobile ? '16px' : '20px',
              padding: isMobile ? '24px' : '32px',
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
        paddingTop: isMobile ? '60px' : '80px',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        {content}
      </div>
      <AnimatePresence>
        {uploadModal}
      </AnimatePresence>
      
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
};

export default LessonPlanViewer;
