import { useState } from 'react';
import supabase from '../utils/supabase';
import { remapLessonEvaluations, getLessonEvaluationsStats } from '../utils/remapLessonEvaluations';
import toast from 'react-hot-toast';

/**
 * TEMPORARY DEBUG COMPONENT
 * Add this to your admin dashboard to test the remapping functionality
 * 
 * Usage: Import and add <DebugRemapTester /> to AdminDashboard.jsx
 */
const DebugRemapTester = () => {
  const [stats, setStats] = useState(null);
  const [checking, setChecking] = useState(false);
  const [remapping, setRemapping] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
    console.log(`[${timestamp}] ${message}`);
  };

  const checkDatabase = async () => {
    setChecking(true);
    setLogs([]);
    addLog('Starting database check...', 'info');

    try {
      // Check 1: Can we query lesson_evaluations with new columns?
      addLog('Test 1: Checking if columns exist...', 'info');
      
      const { data: sample, error: sampleError } = await supabase
        .from('lesson_evaluations')
        .select('id, eval_student_id, student_name, stored_class_id, stored_category, teacher_notes')
        .limit(1);

      if (sampleError) {
        addLog(`❌ ERROR: ${sampleError.message}`, 'error');
        addLog('Columns probably don\'t exist. Run the migration!', 'error');
        toast.error('Database columns missing! Check console.');
        setChecking(false);
        return;
      }

      addLog('✅ Columns exist!', 'success');
      if (sample && sample.length > 0) {
        addLog(`Sample record: ${JSON.stringify(sample[0], null, 2)}`, 'info');
      }

      // Check 2: Get statistics
      addLog('Test 2: Getting evaluation statistics...', 'info');
      const statistics = await getLessonEvaluationsStats();
      setStats(statistics);
      
      if (statistics) {
        addLog(`Total evaluations: ${statistics.total}`, 'info');
        addLog(`Properly linked: ${statistics.linked}`, 'success');
        addLog(`Orphaned: ${statistics.orphaned}`, statistics.orphaned > 0 ? 'warning' : 'success');
        addLog(`With teacher notes: ${statistics.with_notes}`, 'info');
        addLog(`Orphaned with notes: ${statistics.orphaned_with_notes}`, 
          statistics.orphaned_with_notes > 0 ? 'error' : 'success');
      }

      // Check 3: Sample orphaned records
      if (statistics && statistics.orphaned > 0) {
        addLog('Test 3: Fetching sample orphaned records...', 'info');
        
        const { data: orphaned, error: orphanedError } = await supabase
          .from('lesson_evaluations')
          .select('student_name, stored_class_id, chapter_number, category, teacher_notes')
          .is('eval_student_id', null)
          .not('student_name', 'is', null)
          .limit(3);

        if (!orphanedError && orphaned) {
          addLog(`Found ${orphaned.length} sample orphaned records:`, 'warning');
          orphaned.forEach((rec, i) => {
            addLog(`  ${i+1}. ${rec.student_name} - Ch${rec.chapter_number} ${rec.category}${rec.teacher_notes ? ' (has notes)' : ''}`, 'warning');
          });
        }
      }

      // Check 4: Check if eval_students exist for matching
      addLog('Test 4: Checking eval_students...', 'info');
      
      const { count: evalStudentCount } = await supabase
        .from('eval_students')
        .select('*', { count: 'exact', head: true });

      addLog(`Total eval_students: ${evalStudentCount}`, 'info');

      if (evalStudentCount === 0) {
        addLog('⚠️  No eval_students found! Run bulk import first.', 'warning');
      }

      addLog('Database check complete!', 'success');
      toast.success('Database check complete! See results below.');

    } catch (error) {
      addLog(`❌ Check failed: ${error.message}`, 'error');
      console.error('Check error:', error);
      toast.error('Check failed! See console.');
    } finally {
      setChecking(false);
    }
  };

  const testRemap = async () => {
    setRemapping(true);
    addLog('Starting test remap...', 'info');

    try {
      const result = await remapLessonEvaluations();
      
      addLog(`Remap complete!`, 'success');
      addLog(`  Remapped: ${result.remapped_count}`, 'success');
      addLog(`  Failed: ${result.failed_count}`, result.failed_count > 0 ? 'error' : 'success');
      addLog(`  Notes preserved: ${result.notes_preserved}`, 'success');

      if (result.failed_students && result.failed_students.length > 0) {
        addLog(`Failed students:`, 'error');
        result.failed_students.forEach(name => {
          addLog(`  - ${name}`, 'error');
        });
      }

      if (result.remapped_count > 0) {
        toast.success(`✅ Remapped ${result.remapped_count} evaluations!`);
      }

      // Refresh stats
      const newStats = await getLessonEvaluationsStats();
      setStats(newStats);

    } catch (error) {
      addLog(`❌ Remap failed: ${error.message}`, 'error');
      console.error('Remap error:', error);
      toast.error('Remap failed! See console.');
    } finally {
      setRemapping(false);
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'success': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      padding: '24px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      marginBottom: '24px'
    }}>
      <h2 style={{
        fontSize: '20px',
        fontWeight: '700',
        marginBottom: '16px',
        color: '#1a1a1a'
      }}>
        🔧 Debug: Teacher Notes Remapping
      </h2>

      <p style={{
        fontSize: '14px',
        color: '#666',
        marginBottom: '20px'
      }}>
        This is a temporary debug tool. Use it to test if the remapping is working correctly.
      </p>

      {/* Statistics Display */}
      {stats && (
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
            Current Statistics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
                {stats.total}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#666' }}>Linked</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                {stats.linked}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#666' }}>Orphaned</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: stats.orphaned > 0 ? '#ef4444' : '#10b981' }}>
                {stats.orphaned}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#666' }}>With Notes</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#8b5cf6' }}>
                {stats.with_notes}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#666' }}>Orphaned + Notes</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: stats.orphaned_with_notes > 0 ? '#ef4444' : '#10b981' }}>
                {stats.orphaned_with_notes}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#666' }}>Broken</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: stats.broken > 0 ? '#ef4444' : '#10b981' }}>
                {stats.broken}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={checkDatabase}
          disabled={checking}
          style={{
            padding: '10px 20px',
            backgroundColor: checking ? '#ccc' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: checking ? 'not-allowed' : 'pointer'
          }}
        >
          {checking ? 'Checking...' : '1. Check Database'}
        </button>

        <button
          onClick={testRemap}
          disabled={remapping || !stats || stats.orphaned === 0}
          style={{
            padding: '10px 20px',
            backgroundColor: remapping || !stats || stats.orphaned === 0 ? '#ccc' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: remapping || !stats || stats.orphaned === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {remapping ? 'Remapping...' : '2. Test Remap'}
        </button>

        <button
          onClick={() => setLogs([])}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Clear Logs
        </button>
      </div>

      {/* Log Display */}
      {logs.length > 0 && (
        <div style={{
          backgroundColor: '#1f2937',
          padding: '16px',
          borderRadius: '8px',
          maxHeight: '400px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '13px'
        }}>
          {logs.map((log, index) => (
            <div
              key={index}
              style={{
                color: getLogColor(log.type),
                marginBottom: '4px',
                whiteSpace: 'pre-wrap'
              }}
            >
              [{log.timestamp}] {log.message}
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        backgroundColor: '#fef3c7',
        borderRadius: '6px',
        fontSize: '13px'
      }}>
        <strong>How to use:</strong>
        <ol style={{ marginLeft: '20px', marginTop: '8px' }}>
          <li>Click "Check Database" to verify columns exist and see current state</li>
          <li>If you see orphaned evaluations, click "Test Remap" to fix them</li>
          <li>Check the logs for detailed information</li>
          <li>Remove this component after debugging</li>
        </ol>
      </div>
    </div>
  );
};

export default DebugRemapTester;
