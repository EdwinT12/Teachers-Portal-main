import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import { getEvaluationColumn } from '../utils/googleSheetsEvaluationAPI';
import { getColumnLetter } from '../utils/googleSheetsAPI';
import toast from 'react-hot-toast';

const EvaluationDiagnostic = () => {
  const { user } = useContext(AuthContext);
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const results = {
      profile: null,
      students: null,
      evaluations: null,
      columnCalculations: null,
      issues: []
    };

    try {
      // 1. Check teacher profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          evaluation_sheets_id,
          default_class_id,
          classes:default_class_id (
            id,
            name,
            sheet_name
          )
        `)
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      results.profile = profile;

      // Check for issues
      if (!profile.evaluation_sheets_id) {
        results.issues.push('❌ No evaluation_sheets_id configured for this teacher');
      }
      if (!profile.default_class_id) {
        results.issues.push('❌ Teacher has no default class assigned');
      }

      // 2. Check students in the teacher's class
      if (profile.default_class_id) {
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('class_id', profile.default_class_id)
          .order('row_number');

        if (studentsError) throw studentsError;
        results.students = students;

        // Check for row number issues
        if (students && students.length > 0) {
          const firstRow = students[0].row_number;
          if (firstRow !== 5) {
            results.issues.push(`⚠️ First student row is ${firstRow}, but should typically be 5 in the Google Sheet`);
          }
        }
      }

      // 3. Check recent evaluations
      const { data: evaluations, error: evalError } = await supabase
        .from('lesson_evaluations')
        .select(`
          *,
          students (
            student_name,
            row_number,
            classes (
              sheet_name
            )
          )
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (evalError) throw evalError;
      results.evaluations = evaluations;

      // Check sync status
      const unsyncedCount = evaluations?.filter(e => !e.synced_to_sheets).length || 0;
      if (unsyncedCount > 0) {
        results.issues.push(`⚠️ ${unsyncedCount} evaluations failed to sync to Google Sheets`);
      }

      // 4. Calculate column positions for recent evaluations
      if (evaluations && evaluations.length > 0) {
        results.columnCalculations = evaluations.slice(0, 5).map(evaluation => {
          const column = getEvaluationColumn(evaluation.evaluation_date, evaluation.category);
          return {
            student: evaluation.students.student_name,
            date: evaluation.evaluation_date,
            category: evaluation.category,
            rating: evaluation.rating,
            calculatedRow: evaluation.students.row_number,
            calculatedColumn: column,
            calculatedCell: `${getColumnLetter(column)}${evaluation.students.row_number}`,
            sheetName: evaluation.students.classes.sheet_name,
            synced: evaluation.synced_to_sheets,
            syncError: evaluation.sync_error
          };
        });
      }

      // Additional checks
      if (results.profile?.classes?.sheet_name) {
        const sheetName = results.profile.classes.sheet_name;
        if (sheetName.includes(' ')) {
          results.issues.push(`⚠️ Class sheet_name contains space: "${sheetName}". Make sure Google Sheet tab name matches exactly.`);
        }
      }

      setDiagnosticResults(results);
      toast.success('Diagnostic complete!');

    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error('Diagnostic failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      maxWidth: '1200px',
      margin: '20px auto'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: '8px'
      }}>
        🔍 Evaluation System Diagnostics
      </h2>
      <p style={{
        color: '#666',
        marginBottom: '24px',
        fontSize: '14px'
      }}>
        Run diagnostics to troubleshoot evaluation syncing issues
      </p>

      <button
        onClick={runDiagnostics}
        disabled={loading}
        style={{
          padding: '12px 24px',
          backgroundColor: loading ? '#ccc' : '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: '600',
          marginBottom: '24px'
        }}
      >
        {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
      </button>

      {diagnosticResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Issues Summary */}
          {diagnosticResults.issues.length > 0 && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#856404' }}>
                Issues Found:
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {diagnosticResults.issues.map((issue, i) => (
                  <li key={i} style={{ marginBottom: '8px', color: '#856404' }}>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Profile Info */}
          <div style={{
            padding: '16px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
              👤 Teacher Profile
            </h3>
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div><strong>Name:</strong> {diagnosticResults.profile?.full_name}</div>
              <div><strong>Email:</strong> {diagnosticResults.profile?.email}</div>
              <div><strong>Class:</strong> {diagnosticResults.profile?.classes?.name || 'Not assigned'}</div>
              <div><strong>Sheet Name:</strong> {diagnosticResults.profile?.classes?.sheet_name || 'N/A'}</div>
              <div>
                <strong>Evaluation Spreadsheet ID:</strong>{' '}
                {diagnosticResults.profile?.evaluation_sheets_id ? (
                  <span style={{ color: '#4CAF50' }}>✓ Configured</span>
                ) : (
                  <span style={{ color: '#dc2626' }}>✗ Not configured</span>
                )}
              </div>
            </div>
          </div>

          {/* Students Info */}
          {diagnosticResults.students && (
            <div style={{
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                👥 Students ({diagnosticResults.students.length})
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e5e7eb' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Row #</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Student Name</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>House</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosticResults.students.slice(0, 10).map((student, i) => (
                      <tr key={student.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '8px' }}>{student.row_number}</td>
                        <td style={{ padding: '8px' }}>{student.student_name}</td>
                        <td style={{ padding: '8px' }}>{student.house}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {diagnosticResults.students.length > 10 && (
                  <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0 0' }}>
                    Showing first 10 of {diagnosticResults.students.length} students
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Column Calculations */}
          {diagnosticResults.columnCalculations && (
            <div style={{
              padding: '16px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #0ea5e9'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                📊 Recent Evaluation Calculations
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e0f2fe' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Student</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Category</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Rating</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Target Cell</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Sheet</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosticResults.columnCalculations.map((calc, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e0f2fe' }}>
                        <td style={{ padding: '8px' }}>{calc.student}</td>
                        <td style={{ padding: '8px' }}>{calc.date}</td>
                        <td style={{ padding: '8px' }}>{calc.category}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{calc.rating}</td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {calc.calculatedCell}
                        </td>
                        <td style={{ padding: '8px' }}>{calc.sheetName}</td>
                        <td style={{ padding: '8px' }}>
                          {calc.synced ? (
                            <span style={{ color: '#4CAF50' }}>✓ Synced</span>
                          ) : (
                            <span style={{ color: '#dc2626' }}>
                              ✗ Failed
                              {calc.syncError && <div style={{ fontSize: '11px' }}>{calc.syncError}</div>}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Evaluations Summary */}
          {diagnosticResults.evaluations && (
            <div style={{
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                📝 Recent Evaluations
              </h3>
              <p style={{ fontSize: '14px', margin: '0' }}>
                Total: {diagnosticResults.evaluations.length} |{' '}
                Synced: {diagnosticResults.evaluations.filter(e => e.synced_to_sheets).length} |{' '}
                Failed: {diagnosticResults.evaluations.filter(e => !e.synced_to_sheets).length}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvaluationDiagnostic;