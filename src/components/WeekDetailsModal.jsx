import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Calendar, Clock, CheckCircle } from 'lucide-react';

const WeekDetailsModal = ({ details, onClose }) => {
  if (!details) return null;

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <AnimatePresence>
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
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: '500px',
            width: '100%',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '24px',
            position: 'relative'
          }}>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)'
              }}
            >
              <X style={{ width: '20px', height: '20px', color: 'white' }} />
            </motion.button>

            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: '800'
            }}>
              Upload Details
            </h2>
            <p style={{
              margin: 0,
              fontSize: '14px',
              opacity: 0.9
            }}>
              {details.className} - {details.weekLabel || details.chapterLabel}
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: '24px' }}>
            {details.uploadedBy ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                {/* Uploaded By */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <User style={{ width: '20px', height: '20px', color: 'white' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      marginBottom: '4px',
                      fontWeight: '600'
                    }}>
                      Uploaded By
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1e293b'
                    }}>
                      {details.uploadedBy}
                    </div>
                  </div>
                </div>

                {/* Date/Time */}
                {details.date && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    padding: '16px',
                    background: '#f0f9ff',
                    borderRadius: '12px',
                    border: '1px solid #bae6fd'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Calendar style={{ width: '20px', height: '20px', color: 'white' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        color: '#64748b',
                        marginBottom: '4px',
                        fontWeight: '600'
                      }}>
                        For Date
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1e293b'
                      }}>
                        {formatDate(details.date)}
                      </div>
                    </div>
                  </div>
                )}

                {details.uploadedAt && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    padding: '16px',
                    background: '#fef3c7',
                    borderRadius: '12px',
                    border: '1px solid #fde68a'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Clock style={{ width: '20px', height: '20px', color: 'white' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        color: '#64748b',
                        marginBottom: '4px',
                        fontWeight: '600'
                      }}>
                        Uploaded At
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1e293b'
                      }}>
                        {formatDateTime(details.uploadedAt)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  background: '#d1fae5',
                  borderRadius: '8px',
                  border: '2px solid #10b981'
                }}>
                  <CheckCircle style={{ width: '20px', height: '20px', color: '#047857' }} />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#047857'
                  }}>
                    Data Successfully Synced
                  </span>
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#94a3b8'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <Calendar style={{ width: '30px', height: '30px', color: '#cbd5e1' }} />
                </div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#475569',
                  margin: '0 0 8px 0'
                }}>
                  No Data Uploaded Yet
                </h3>
                <p style={{
                  fontSize: '14px',
                  margin: 0
                }}>
                  This {details.weekLabel ? 'week' : 'chapter'} hasn't been completed yet.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              Close
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WeekDetailsModal;