import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, XCircle, Eye, Info } from 'lucide-react';

const CompletionStatusCell = ({ 
  label, 
  date, 
  status, 
  filledCount, 
  totalCount, 
  completionPercentage,
  onViewDetails 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'complete':
        return {
          icon: CheckCircle,
          color: '#10b981',
          bg: '#d1fae5',
          borderColor: '#10b981',
          emoji: '✅',
          text: 'Complete'
        };
      case 'partial':
        return {
          icon: AlertCircle,
          color: '#f59e0b',
          bg: '#fef3c7',
          borderColor: '#f59e0b',
          emoji: '🟡',
          text: 'Partial'
        };
      case 'incomplete':
      default:
        return {
          icon: XCircle,
          color: '#ef4444',
          bg: '#fee2e2',
          borderColor: '#ef4444',
          emoji: '❌',
          text: 'Incomplete'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const missingCount = totalCount - filledCount;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      style={{
        position: 'relative',
        padding: '12px',
        borderRadius: '8px',
        border: `2px solid ${config.borderColor}`,
        background: config.bg,
        cursor: 'pointer'
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (onViewDetails) onViewDetails();
      }}
    >
      {/* Status Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Icon style={{ width: '18px', height: '18px', color: config.color }} />
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#1e293b'
          }}>
            {label}
          </span>
        </div>
        <span style={{ fontSize: '16px' }}>{config.emoji}</span>
      </div>

      {/* Date (if provided) */}
      {date && (
        <div style={{
          fontSize: '11px',
          color: '#64748b',
          marginBottom: '8px'
        }}>
          {formatDate(date)}
        </div>
      )}

      {/* Completion Bar */}
      <div style={{
        width: '100%',
        height: '6px',
        background: 'white',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '8px'
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${completionPercentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            height: '100%',
            background: config.color,
            borderRadius: '3px'
          }}
        />
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: '#475569'
        }}>
          {filledCount}/{totalCount}
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: '800',
          color: config.color
        }}>
          {completionPercentage}%
        </span>
      </div>

      {/* View Details Button */}
      {onViewDetails && (
        <motion.div
          whileHover={{ scale: 1.1 }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer'
          }}
        >
          <Eye style={{ width: '14px', height: '14px', color: '#64748b' }} />
        </motion.div>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              padding: '12px',
              background: '#1e293b',
              color: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              zIndex: 1000,
              minWidth: '200px',
              whiteSpace: 'nowrap'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <Info style={{ width: '16px', height: '16px' }} />
              <span style={{
                fontSize: '13px',
                fontWeight: '700'
              }}>
                {config.text} - {label}
              </span>
            </div>

            <div style={{
              fontSize: '12px',
              lineHeight: '1.5'
            }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>Filled:</strong> {filledCount} entries
              </div>
              {missingCount > 0 && (
                <div style={{ marginBottom: '4px' }}>
                  <strong>Missing:</strong> {missingCount} entries
                </div>
              )}
              <div>
                <strong>Completion:</strong> {completionPercentage}%
              </div>
            </div>

            {/* Tooltip Arrow */}
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #1e293b'
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CompletionStatusCell;