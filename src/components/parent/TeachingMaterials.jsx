import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';
import { FileText, Download, Eye, BookOpen, FolderOpen, ExternalLink, Loader } from 'lucide-react';

const TeachingMaterials = () => {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState([]);
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
    loadTeachingMaterials();
  }, []);

  const loadTeachingMaterials = async () => {
    setLoading(true);
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
        console.error('Error loading teaching materials:', error);
        toast.error('Failed to load teaching materials');
        return;
      }

      // Get all PDF files from the parent-materials bucket
      const materialFiles = files
        .filter(file => file.name.endsWith('.pdf'))
        .map(file => {
          // Get public URL
          const { data } = supabase.storage
            .from('parent-materials')
            .getPublicUrl(file.name);

          // Extract display name (remove .pdf extension)
          let displayName = file.name.replace('.pdf', '');
          // Replace hyphens and underscores with spaces and capitalize
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
      console.error('Error loading teaching materials:', error);
      toast.error('Failed to load teaching materials');
    } finally {
      setLoading(false);
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
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          margin: '0 auto 16px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading teaching materials...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px'
      }}>
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
        <div>
          <h2 style={{
            fontSize: isMobile ? '20px' : '24px',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0
          }}>
            Teaching Materials
          </h2>
          <p style={{
            fontSize: isMobile ? '12px' : '14px',
            color: '#64748b',
            margin: '4px 0 0 0'
          }}>
            General resources and materials for all classes
          </p>
        </div>
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
            No materials available yet
          </h3>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            margin: 0
          }}>
            Teaching materials will appear here when teachers upload them
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
                  {file.size && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: '#cbd5e1',
                        display: isMobile ? 'none' : 'inline-block'
                      }}></span>
                      {formatFileSize(file.size)}
                    </span>
                  )}
                  {file.updatedAt && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: '#cbd5e1',
                        display: isMobile ? 'none' : 'inline-block'
                      }}></span>
                      Updated {formatDate(file.updatedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: isMobile ? '8px' : '10px',
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
                    padding: isMobile ? '10px 16px' : '10px 18px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                  }}
                >
                  <ExternalLink style={{
                    width: isMobile ? '14px' : '16px',
                    height: isMobile ? '14px' : '16px'
                  }} />
                  View
                </button>

                {/* Download Button */}
                <button
                  onClick={() => handleDownloadFile(file)}
                  title="Download file"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: isMobile ? '10px 16px' : '10px 18px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  <Download style={{
                    width: isMobile ? '14px' : '16px',
                    height: isMobile ? '14px' : '16px'
                  }} />
                  Download
                </button>
              </div>
            </motion.div>
          ))}
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

export default TeachingMaterials;
