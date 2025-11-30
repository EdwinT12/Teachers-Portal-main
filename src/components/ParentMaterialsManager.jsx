import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../utils/supabase';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FileText, Upload, Loader, Download, Eye, Trash2, FolderOpen, X, Plus, ExternalLink, BookOpen } from 'lucide-react';

const ParentMaterialsManager = ({ isModal = false, onClose = null }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFileName, setUploadFileName] = useState('');
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
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Check if user is teacher or admin
      if (profileData.role !== 'teacher' && profileData.role !== 'admin') {
        toast.error('You do not have permission to access this page');
        return;
      }

      // Load all materials
      await loadMaterials();

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      // List all files in the parent-materials bucket
      const { data: files, error } = await supabase.storage
        .from('parent-materials')
        .list('', {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        console.error('Error loading materials list:', error);
        return;
      }

      // Get all PDF files
      const materialFiles = files
        .filter(file => file.name.endsWith('.pdf'))
        .map(file => {
          const { data } = supabase.storage
            .from('parent-materials')
            .getPublicUrl(file.name);

          // Extract display name
          let displayName = file.name.replace('.pdf', '');
          displayName = displayName
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          return {
            name: file.name,
            displayName: displayName,
            url: data.publicUrl,
            size: file.metadata?.size,
            updatedAt: file.updated_at
          };
        });

      setMaterials(materialFiles);
    } catch (error) {
      console.error('Error loading materials list:', error);
    }
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
    if (!uploadFile || !uploadFileName.trim()) {
      toast.error('Please provide a file and a name');
      return;
    }

    setUploading(true);
    try {
      // Sanitize the custom filename
      const sanitizedFileName = uploadFileName.trim().replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-');
      const fileName = `${sanitizedFileName}.pdf`;

      // Check if file already exists
      if (materials.some(f => f.name === fileName)) {
        const confirmed = window.confirm('A file with this name already exists. Do you want to replace it?');
        if (!confirmed) {
          setUploading(false);
          return;
        }
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('parent-materials')
        .upload(fileName, uploadFile, {
          cacheControl: '3600',
          upsert: true // Replace if exists
        });

      if (uploadError) throw uploadError;

      toast.success('Material uploaded successfully!');
      setUploadFile(null);
      setUploadFileName('');
      setShowUploadModal(false);

      // Reload the materials
      await loadMaterials();

    } catch (error) {
      console.error('Error uploading material:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${file.displayName}"? This action cannot be undone and will affect all parents.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.storage
        .from('parent-materials')
        .remove([file.name]);

      if (error) throw error;

      toast.success('Material deleted successfully!');

      // Reload materials
      await loadMaterials();

    } catch (error) {
      console.error('Error deleting material:', error);
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
    if (mb < 1) {
      const kb = bytes / 1024;
      return `${kb.toFixed(2)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
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

  // If user doesn't have permission
  if (profile && profile.role !== 'teacher' && profile.role !== 'admin') {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#ef4444', fontSize: '16px', fontWeight: '600' }}>
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  const content = (
    <div style={{
      maxWidth: isModal ? '100%' : '1200px',
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
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: 'white' }} />
            </div>
            <h2 style={{
              fontSize: isMobile ? '22px' : '28px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              Parent Materials Manager
            </h2>
          </div>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#666',
            margin: 0
          }}>
            Upload and manage teaching materials that parents can access
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: isMobile ? '12px 20px' : '12px 24px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
          }}
        >
          <Plus style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px' }} />
          Upload New Material
        </button>
      </div>

      {/* Materials List */}
      {materials.length === 0 ? (
        <div style={{
          padding: isMobile ? '40px 20px' : '60px 40px',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #cbd5e1'
        }}>
          <FolderOpen style={{
            width: isMobile ? '48px' : '64px',
            height: isMobile ? '48px' : '64px',
            color: '#d1d5db',
            margin: '0 auto 16px'
          }} />
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '600',
            color: '#475569',
            margin: '0 0 8px 0'
          }}>
            No materials uploaded yet
          </h3>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            margin: 0
          }}>
            Upload teaching materials for parents to access
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: isMobile ? '12px' : '16px'
        }}>
          {materials.map((file, index) => (
            <motion.div
              key={file.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '20px',
                background: 'white',
                borderRadius: isMobile ? '10px' : '12px',
                border: '1px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#8b5cf6';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* File Icon */}
              <div style={{
                width: isMobile ? '48px' : '56px',
                height: isMobile ? '48px' : '56px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText style={{
                  width: isMobile ? '24px' : '28px',
                  height: isMobile ? '24px' : '28px',
                  color: '#dc2626'
                }} />
              </div>

              {/* File Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontSize: isMobile ? '15px' : '16px',
                  fontWeight: '600',
                  color: '#1e293b',
                  margin: '0 0 6px 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: isMobile ? 'normal' : 'nowrap'
                }}>
                  {file.displayName}
                </h3>
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '2px' : '16px',
                  fontSize: isMobile ? '12px' : '13px',
                  color: '#64748b'
                }}>
                  {file.size && <span>{formatFileSize(file.size)}</span>}
                  {file.updatedAt && <span>Uploaded {formatDate(file.updatedAt)}</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: isMobile ? '6px' : '8px',
                flexShrink: 0,
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                {/* View Button */}
                <button
                  onClick={() => handleOpenFile(file)}
                  title="View file"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: isMobile ? '8px 12px' : '8px 16px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <ExternalLink style={{
                    width: isMobile ? '14px' : '16px',
                    height: isMobile ? '14px' : '16px'
                  }} />
                  {!isMobile && 'View'}
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

                {/* Delete Button - Only for admins */}
                {profile?.role === 'admin' && (
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
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
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
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          position: 'relative'
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
          Upload Parent Material
        </h3>

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
              placeholder="e.g., Week 1 Resources"
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
            disabled={uploading || !uploadFile || !uploadFileName.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: isMobile ? '12px 20px' : '10px 20px',
              background: uploading || !uploadFile || !uploadFileName.trim()
                ? '#9ca3af'
                : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '14px',
              fontWeight: '600',
              cursor: uploading || !uploadFile || !uploadFileName.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
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

export default ParentMaterialsManager;
