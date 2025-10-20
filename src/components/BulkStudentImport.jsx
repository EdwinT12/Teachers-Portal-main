import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import { readSheetData, getSpreadsheetMetadata } from '../utils/googleSheetsAPI';
import toast from 'react-hot-toast';
import { Trash2, RefreshCw, AlertCircle } from 'lucide-react';

const BulkStudentImport = () => {
  const { user } = useContext(AuthContext);
  const [attendanceSheetId, setAttendanceSheetId] = useState('1kTbE3-JeukrhPMg46eEPqOagEK82olcLIUExqmKWhAs');
  const [evaluationSheetId, setEvaluationSheetId] = useState('1tVWRqyYrTHbYFPh4Yo8NVjjrxE3ZRYcsce0nwT0mcDc');
  const [importing, setImporting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [attendanceSheets, setAttendanceSheets] = useState([]);
  const [evaluationSheets, setEvaluationSheets] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [studentCounts, setStudentCounts] = useState({ students: 0, evalStudents: 0 });

  // Load student counts
  const loadStudentCounts = async () => {
    try {
      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      const { count: evalStudentsCount, error: evalError } = await supabase
        .from('eval_students')
        .select('*', { count: 'exact', head: true });

      if (studentsError) throw studentsError;
      if (evalError) throw evalError;

      setStudentCounts({
        students: studentsCount || 0,
        evalStudents: evalStudentsCount || 0
      });
    } catch (error) {
      console.error('Error loading student counts:', error);
    }
  };

  useState(() => {
    loadStudentCounts();
  }, []);

  // Load available classes from Supabase
  const loadClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('year_level');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      toast.error('Failed to load classes');
    }
  };

  // Load sheet tabs from Google Sheets
  const loadSheetTabs = async () => {
    try {
      toast.loading('Loading sheet tabs...');
      
      const [attendanceMetadata, evaluationMetadata] = await Promise.all([
        getSpreadsheetMetadata(attendanceSheetId),
        getSpreadsheetMetadata(evaluationSheetId)
      ]);

      setAttendanceSheets(attendanceMetadata);
      setEvaluationSheets(evaluationMetadata);
      
      toast.dismiss();
      toast.success(`Found ${attendanceMetadata.length} attendance sheets and ${evaluationMetadata.length} evaluation sheets`);
      
      await loadClasses();
    } catch (error) {
      toast.dismiss();
      console.error('Error loading sheets:', error);
      toast.error('Failed to load sheets. Check the spreadsheet IDs and your permissions.');
    }
  };

  // Clear all students from both tables
  const clearAllStudents = async () => {
    try {
      console.log('Deleting all students from students table...');
      const { error: studentsError } = await supabase
        .from('students')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (studentsError) throw studentsError;

      console.log('Deleting all students from eval_students table...');
      const { error: evalError } = await supabase
        .from('eval_students')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (evalError) throw evalError;

      console.log('Successfully cleared both student tables');
      return true;
    } catch (error) {
      console.error('Error clearing students:', error);
      throw error;
    }
  };

  // Import attendance students from a specific sheet
  const importAttendanceStudents = async (sheetName, classId) => {
    try {
      console.log(`Importing attendance students from sheet: ${sheetName}`);
      
      // Read columns B and C (House and Student Name) starting from row 4
      const data = await readSheetData(attendanceSheetId, sheetName, 'B4:C100');
      
      if (!data || data.length === 0) {
        throw new Error('No student data found in sheet');
      }

      const students = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const house = row[0] ? row[0].trim() : '';
        const studentName = row[1] ? row[1].trim() : '';
        
        if (!studentName || studentName === '') {
          console.log(`Stopping at row ${i + 4}: No student name found. Total students: ${students.length}`);
          break;
        }

        if (studentName.toLowerCase() === 'student' || 
            house.toLowerCase() === 'houses' ||
            studentName.toLowerCase().includes('student name')) {
          continue;
        }

        const houseNames = ['st.mark', 'st.luke', 'st.john', 'st.mathew', 'st.matthew'];
        if (houseNames.some(h => studentName.toLowerCase().includes(h))) {
          continue;
        }
        
        students.push({
          class_id: classId,
          student_name: studentName,
          house: house,
          student_identifier: studentName,
          row_number: i + 4
        });
      }

      if (students.length === 0) {
        throw new Error('No valid students found after filtering');
      }

      const { data: insertedData, error } = await supabase
        .from('students')
        .insert(students)
        .select();

      if (error) throw error;

      console.log(`Successfully imported ${insertedData.length} attendance students from ${sheetName}`);
      return {
        sheetName,
        success: true,
        count: insertedData.length,
        type: 'attendance'
      };

    } catch (error) {
      console.error(`Error importing attendance students from ${sheetName}:`, error);
      return {
        sheetName,
        success: false,
        error: error.message,
        type: 'attendance'
      };
    }
  };

  // Import evaluation students from a specific sheet
  const importEvaluationStudents = async (sheetName, classId) => {
    try {
      console.log(`Importing evaluation students from sheet: ${sheetName}`);
      
      // Read column C starting from row 5 (first student in evaluation sheet)
      const data = await readSheetData(evaluationSheetId, sheetName, 'C5:C100');
      
      if (!data || data.length === 0) {
        throw new Error('No student data found in sheet');
      }

      const students = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const studentName = row[0] ? row[0].trim() : '';
        
        if (!studentName || studentName === '') {
          console.log(`Stopping at row ${i + 5}: No student name found. Total students: ${students.length}`);
          break;
        }

        if (studentName.toLowerCase() === 'student' || 
            studentName.toLowerCase().includes('student name') ||
            studentName.toLowerCase() === 'date') {
          continue;
        }

        const houseNames = ['st.mark', 'st.luke', 'st.john', 'st.mathew', 'st.matthew'];
        if (houseNames.some(h => studentName.toLowerCase().includes(h))) {
          continue;
        }
        
        students.push({
          class_id: classId,
          student_name: studentName,
          house: null,
          student_identifier: studentName,
          row_number: i + 5
        });
      }

      if (students.length === 0) {
        throw new Error('No valid students found after filtering');
      }

      const { data: insertedData, error } = await supabase
        .from('eval_students')
        .insert(students)
        .select();

      if (error) throw error;

      console.log(`Successfully imported ${insertedData.length} evaluation students from ${sheetName}`);
      return {
        sheetName,
        success: true,
        count: insertedData.length,
        type: 'evaluation'
      };

    } catch (error) {
      console.error(`Error importing evaluation students from ${sheetName}:`, error);
      return {
        sheetName,
        success: false,
        error: error.message,
        type: 'evaluation'
      };
    }
  };

  // Main update function - clears and re-imports all students
  const handleUpdateSheet = async () => {
    if (attendanceSheets.length === 0 || evaluationSheets.length === 0) {
      toast.error('Please load sheet tabs first');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ WARNING: This will DELETE ALL existing students from both tables and re-import from sheets.\n\n` +
      `Current data:\n` +
      `- Attendance students: ${studentCounts.students}\n` +
      `- Evaluation students: ${studentCounts.evalStudents}\n\n` +
      `Are you sure you want to continue?`
    );

    if (!confirmed) return;

    setImporting(true);
    const results = [];

    try {
      // Step 1: Clear all existing students
      toast.loading('Clearing existing student data...');
      await clearAllStudents();
      toast.dismiss();
      toast.success('Existing data cleared');

      // Step 2: Import attendance students
      toast.loading('Importing attendance students...');
      for (const sheet of attendanceSheets) {
        const matchingClass = classes.find(c => 
          c.sheet_name === sheet.title || c.name === sheet.title
        );

        if (!matchingClass) {
          console.warn(`No matching class found for attendance sheet: ${sheet.title}`);
          results.push({
            sheetName: sheet.title,
            success: false,
            error: 'No matching class found',
            type: 'attendance'
          });
          continue;
        }

        const result = await importAttendanceStudents(sheet.title, matchingClass.id);
        results.push(result);
      }

      // Step 3: Import evaluation students
      toast.dismiss();
      toast.loading('Importing evaluation students...');
      for (const sheet of evaluationSheets) {
        const matchingClass = classes.find(c => 
          c.sheet_name === sheet.title || c.name === sheet.title
        );

        if (!matchingClass) {
          console.warn(`No matching class found for evaluation sheet: ${sheet.title}`);
          results.push({
            sheetName: sheet.title,
            success: false,
            error: 'No matching class found',
            type: 'evaluation'
          });
          continue;
        }

        const result = await importEvaluationStudents(sheet.title, matchingClass.id);
        results.push(result);
      }

      setImportResults(results);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      toast.dismiss();
      if (successCount > 0) {
        toast.success(`✅ Successfully imported ${successCount} sheets!`);
      }
      if (failCount > 0) {
        toast.error(`❌ Failed to import ${failCount} sheets`);
      }

      // Reload student counts
      await loadStudentCounts();

    } catch (error) {
      console.error('Error during update:', error);
      toast.dismiss();
      toast.error('Update failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <RefreshCw style={{ width: '28px', height: '28px', color: '#3b82f6' }} />
        Update Student Sheets
      </h2>
      <p style={{
        color: '#666',
        marginBottom: '24px',
        fontSize: '14px'
      }}>
        Clear all existing students and re-import from both attendance and evaluation sheets.
      </p>

      {/* Current Data Status */}
      <div style={{
        backgroundColor: '#f0f9ff',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #0ea5e9'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '700',
          color: '#0c4a6e',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle style={{ width: '16px', height: '16px' }} />
          Current Database Status
        </h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          <div>
            <strong>Attendance Students:</strong> {studentCounts.students}
          </div>
          <div>
            <strong>Evaluation Students:</strong> {studentCounts.evalStudents}
          </div>
        </div>
      </div>

      {/* Step 1: Enter Spreadsheet IDs */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #e5e7eb'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#1a1a1a',
          marginBottom: '16px'
        }}>
          Step 1: Spreadsheet IDs (Pre-configured)
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '600',
            color: '#475569',
            marginBottom: '8px'
          }}>
            📊 Attendance Spreadsheet ID
          </label>
          <input
            type="text"
            value={attendanceSheetId}
            readOnly
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'monospace',
              backgroundColor: '#f8f9fa',
              color: '#495057',
              cursor: 'not-allowed'
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '600',
            color: '#475569',
            marginBottom: '8px'
          }}>
            ⭐ Evaluation Spreadsheet ID
          </label>
          <input
            type="text"
            value={evaluationSheetId}
            readOnly
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'monospace',
              backgroundColor: '#f8f9fa',
              color: '#495057',
              cursor: 'not-allowed'
            }}
          />
        </div>

        <button
          onClick={loadSheetTabs}
          disabled={importing}
          style={{
            padding: '10px 20px',
            backgroundColor: importing ? '#ccc' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: importing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          Load Sheet Tabs
        </button>
      </div>

      {/* Step 2: Show Sheets Summary */}
      {(attendanceSheets.length > 0 || evaluationSheets.length > 0) && (
        <div style={{
          backgroundColor: '#fff3cd',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #ffc107'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '12px'
          }}>
            Step 2: Review Sheets to Import
          </h3>
          
          <div style={{ marginBottom: '16px' }}>
            <strong style={{ color: '#856404' }}>Attendance Sheets:</strong> {attendanceSheets.length} found
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {attendanceSheets.map(s => s.title).join(', ')}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <strong style={{ color: '#856404' }}>Evaluation Sheets:</strong> {evaluationSheets.length} found
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {evaluationSheets.map(s => s.title).join(', ')}
            </div>
          </div>

          <button
            onClick={handleUpdateSheet}
            disabled={importing}
            style={{
              padding: '14px 24px',
              backgroundColor: importing ? '#ccc' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: importing ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: importing ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
          >
            {importing ? (
              <>
                <RefreshCw style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                Updating...
              </>
            ) : (
              <>
                <Trash2 style={{ width: '20px', height: '20px' }} />
                Clear All & Re-import Students
              </>
            )}
          </button>

          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Step 3: Show Results */}
      {importResults && (
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '12px'
          }}>
            Import Results
          </h3>
          
          {/* Attendance Results */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
              📊 Attendance Students
            </h4>
            {importResults.filter(r => r.type === 'attendance').map((result, index) => (
              <div
                key={`attendance-${index}`}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: '6px',
                  backgroundColor: result.success ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`
                }}
              >
                <strong>{result.sheetName}</strong>:{' '}
                {result.success ? (
                  <span style={{ color: '#155724' }}>
                    ✓ Imported {result.count} students
                  </span>
                ) : (
                  <span style={{ color: '#721c24' }}>
                    ✗ {result.error}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Evaluation Results */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
              ⭐ Evaluation Students
            </h4>
            {importResults.filter(r => r.type === 'evaluation').map((result, index) => (
              <div
                key={`evaluation-${index}`}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: '6px',
                  backgroundColor: result.success ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`
                }}
              >
                <strong>{result.sheetName}</strong>:{' '}
                {result.success ? (
                  <span style={{ color: '#155724' }}>
                    ✓ Imported {result.count} students
                  </span>
                ) : (
                  <span style={{ color: '#721c24' }}>
                    ✗ {result.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#fee2e2',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#7f1d1d',
        lineHeight: '1.6'
      }}>
        <strong>⚠️ IMPORTANT WARNING:</strong>
        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li><strong>This will DELETE ALL existing students</strong> from both the <code>students</code> and <code>eval_students</code> tables</li>
          <li>All attendance and evaluation history will remain intact (only student records are deleted)</li>
          <li>Sheet names must match class <code>sheet_name</code> exactly</li>
          <li>You must have Editor access to both Google Sheets</li>
          <li>This operation cannot be undone - make sure your sheets are up to date!</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkStudentImport;