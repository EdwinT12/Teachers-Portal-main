import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import { readSheetData, getSpreadsheetMetadata } from '../utils/googleSheetsAPI';
import toast from 'react-hot-toast';

const UnifiedEvaluationSetup = () => {
  const { user } = useContext(AuthContext);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sheets, setSheets] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [setupResults, setSetupResults] = useState(null);

  // Load sheet tabs and data
  const loadSpreadsheetData = async () => {
    if (!spreadsheetId) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }

    setLoading(true);
    try {
      toast.loading('Loading spreadsheet data...');
      
      // Load sheet tabs
      const metadata = await getSpreadsheetMetadata(spreadsheetId);
      setSheets(metadata);
      
      // Load classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('year_level');
      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Load teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select(`
          id, 
          full_name, 
          email, 
          default_class_id, 
          evaluation_sheets_id,
          classes:default_class_id(
            id,
            name,
            sheet_name
          )
        `)
        .eq('role', 'teacher')
        .order('full_name');
      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      toast.dismiss();
      toast.success(`Found ${metadata.length} sheets and ${teachersData.length} teachers`);
      
    } catch (error) {
      toast.dismiss();
      console.error('Error loading spreadsheet:', error);
      toast.error('Failed to load spreadsheet data');
    } finally {
      setLoading(false);
    }
  };

  // Import students from a sheet
  const importStudentsFromSheet = async (sheetName, classId) => {
    try {
      console.log(`Importing eval students from: ${sheetName}`);
      
      // Read column C starting from row 5 (first student)
      const data = await readSheetData(spreadsheetId, sheetName, 'C5:C100');
      
      if (!data || data.length === 0) {
        throw new Error('No student data found');
      }

      const students = [];
      for (let i = 0; i < data.length; i++) {
        const studentName = data[i][0] ? data[i][0].trim() : '';
        
        if (!studentName) break;
        
        // Skip headers
        if (studentName.toLowerCase() === 'student' || 
            studentName.toLowerCase().includes('student name') ||
            studentName.toLowerCase() === 'date') {
          continue;
        }

        // Skip house names
        const houseNames = ['st.mark', 'st.luke', 'st.john', 'st.mathew', 'st.matthew'];
        if (houseNames.some(h => studentName.toLowerCase().includes(h))) {
          continue;
        }
        
        students.push({
          class_id: classId,
          student_name: studentName,
          house: null,
          student_identifier: studentName,
          row_number: i + 5 // Row 5 is first student
        });
      }

      if (students.length === 0) {
        throw new Error('No valid students found');
      }

      // Insert into eval_students
      const { data: insertedData, error } = await supabase
        .from('eval_students')
        .insert(students)
        .select();

      if (error) throw error;

      console.log(`Imported ${insertedData.length} students from ${sheetName}`);
      return { success: true, count: insertedData.length };

    } catch (error) {
      console.error(`Error importing from ${sheetName}:`, error);
      return { success: false, error: error.message };
    }
  };

  // Complete setup: Import students AND assign spreadsheet to teachers
  const completeSetup = async () => {
    if (!spreadsheetId) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }

    if (sheets.length === 0) {
      toast.error('Please load spreadsheet data first');
      return;
    }

    setLoading(true);
    const results = [];

    try {
      // Step 1: Import students from all matching sheets
      for (const sheet of sheets) {
        const matchingClass = classes.find(c => 
          c.sheet_name === sheet.title || c.name === sheet.title
        );

        if (!matchingClass) {
          results.push({
            sheetName: sheet.title,
            step: 'Import Students',
            success: false,
            error: 'No matching class found'
          });
          continue;
        }

        const importResult = await importStudentsFromSheet(sheet.title, matchingClass.id);
        
        results.push({
          sheetName: sheet.title,
          className: matchingClass.name,
          step: 'Import Students',
          success: importResult.success,
          count: importResult.count,
          error: importResult.error
        });
      }

      // Step 2: Assign evaluation spreadsheet to teachers with matching sheets
      const teachersWithMatchingSheets = teachers.filter(t => {
        if (!t.classes) return false;
        return sheets.some(s => 
          s.title === t.classes.sheet_name || 
          s.title.toLowerCase() === t.classes.sheet_name?.toLowerCase()
        );
      });

      for (const teacher of teachersWithMatchingSheets) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ evaluation_sheets_id: spreadsheetId })
            .eq('id', teacher.id);

          if (error) throw error;

          results.push({
            teacherName: teacher.full_name,
            className: teacher.classes.name,
            step: 'Assign Spreadsheet',
            success: true
          });
        } catch (error) {
          results.push({
            teacherName: teacher.full_name,
            className: teacher.classes?.name,
            step: 'Assign Spreadsheet',
            success: false,
            error: error.message
          });
        }
      }

      setSetupResults(results);

      // Show summary
      const studentImports = results.filter(r => r.step === 'Import Students');
      const teacherAssignments = results.filter(r => r.step === 'Assign Spreadsheet');
      
      const successfulImports = studentImports.filter(r => r.success).length;
      const successfulAssignments = teacherAssignments.filter(r => r.success).length;

      if (successfulImports > 0 || successfulAssignments > 0) {
        toast.success(
          `✅ Setup Complete!\n` +
          `Imported: ${successfulImports}/${studentImports.length} classes\n` +
          `Assigned: ${successfulAssignments}/${teacherAssignments.length} teachers`,
          { duration: 5000 }
        );
      }

    } catch (error) {
      console.error('Error during setup:', error);
      toast.error('Setup process failed');
    } finally {
      setLoading(false);
    }
  };

  // Preview what will happen
  const getSetupPreview = () => {
    if (sheets.length === 0) return null;

    const matchingSheets = sheets.filter(sheet => 
      classes.some(c => c.sheet_name === sheet.title || c.name === sheet.title)
    );

    const matchingTeachers = teachers.filter(t => {
      if (!t.classes) return false;
      return sheets.some(s => 
        s.title === t.classes.sheet_name || 
        s.title.toLowerCase() === t.classes.sheet_name?.toLowerCase()
      );
    });

    return {
      totalSheets: sheets.length,
      matchingSheets: matchingSheets.length,
      totalTeachers: teachers.filter(t => t.default_class_id).length,
      matchingTeachers: matchingTeachers.length,
      sheetsToImport: matchingSheets,
      teachersToAssign: matchingTeachers
    };
  };

  const preview = getSetupPreview();

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      maxWidth: '1100px',
      margin: '0 auto'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: '8px'
      }}>
        🎯 Complete Evaluation Setup
      </h2>
      <p style={{
        color: '#666',
        marginBottom: '24px',
        fontSize: '14px'
      }}>
        One-step setup: Import evaluation students AND assign spreadsheet to teachers
      </p>

      {/* Step 1: Enter Spreadsheet ID */}
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
          marginBottom: '12px'
        }}>
          Step 1: Enter Evaluation Spreadsheet ID
        </h3>
        <p style={{
          fontSize: '13px',
          color: '#666',
          marginBottom: '12px'
        }}>
          Find the ID in your Google Sheets URL:<br/>
          <code style={{
            backgroundColor: '#e9ecef',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            https://docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
          </code>
        </p>
        <input
          type="text"
          value={spreadsheetId}
          onChange={(e) => setSpreadsheetId(e.target.value)}
          placeholder="1bTqqYlwdmCsv-hjm_SL8mawRNZk..."
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            marginBottom: '12px'
          }}
        />
        <button
          onClick={loadSpreadsheetData}
          disabled={loading || !spreadsheetId}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          {loading ? 'Loading...' : 'Load & Preview Setup'}
        </button>
      </div>

      {/* Step 2: Preview */}
      {preview && (
        <div style={{
          backgroundColor: '#f0f9ff',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #0ea5e9'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '16px'
          }}>
            Step 2: Setup Preview
          </h3>

          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #0ea5e9'
            }}>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                Students to Import
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0369a1' }}>
                {preview.matchingSheets} classes
              </div>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #0ea5e9'
            }}>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                Teachers to Assign
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0369a1' }}>
                {preview.matchingTeachers} teachers
              </div>
            </div>
          </div>

          {/* Details */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#0c4a6e' }}>
              📚 Classes to Import:
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {preview.sheetsToImport.map(sheet => (
                <span
                  key={sheet.sheetId}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: 'white',
                    border: '1px solid #0ea5e9',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#0369a1'
                  }}
                >
                  {sheet.title}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#0c4a6e' }}>
              👥 Teachers to Assign:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {preview.teachersToAssign.map(teacher => (
                <div
                  key={teacher.id}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    border: '1px solid #0ea5e9',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#0369a1'
                  }}
                >
                  <strong>{teacher.full_name}</strong> → {teacher.classes.name}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={completeSetup}
            disabled={loading}
            style={{
              padding: '14px 28px',
              backgroundColor: loading ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              width: '100%'
            }}
          >
            {loading ? '⏳ Setting Up...' : '🚀 Complete Setup (Import Students + Assign Teachers)'}
          </button>
        </div>
      )}

      {/* Step 3: Results */}
      {setupResults && (
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
            ✅ Setup Complete!
          </h3>

          {/* Student Imports */}
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginTop: '16px', marginBottom: '8px' }}>
            📚 Student Imports:
          </h4>
          {setupResults.filter(r => r.step === 'Import Students').map((result, index) => (
            <div
              key={index}
              style={{
                padding: '10px 12px',
                marginBottom: '6px',
                borderRadius: '6px',
                backgroundColor: result.success ? '#d4edda' : '#f8d7da',
                border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
                fontSize: '13px'
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

          {/* Teacher Assignments */}
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginTop: '16px', marginBottom: '8px' }}>
            👥 Teacher Assignments:
          </h4>
          {setupResults.filter(r => r.step === 'Assign Spreadsheet').map((result, index) => (
            <div
              key={index}
              style={{
                padding: '10px 12px',
                marginBottom: '6px',
                borderRadius: '6px',
                backgroundColor: result.success ? '#d4edda' : '#f8d7da',
                border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
                fontSize: '13px'
              }}
            >
              <strong>{result.teacherName}</strong> ({result.className}):{' '}
              {result.success ? (
                <span style={{ color: '#155724' }}>
                  ✓ Spreadsheet assigned
                </span>
              ) : (
                <span style={{ color: '#721c24' }}>
                  ✗ {result.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#e0f2fe',
        border: '1px solid #0ea5e9',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#0c4a6e',
        lineHeight: '1.6'
      }}>
        <strong>ℹ️ What This Does:</strong>
        <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li>Imports students from Column C (starting row 5) into <code>eval_students</code> table</li>
          <li>Assigns the evaluation spreadsheet ID to all teachers with matching class sheets</li>
          <li>Teachers can immediately start marking and syncing evaluations</li>
        </ol>
        <div style={{ marginTop: '12px' }}>
          <strong>Requirements:</strong>
          <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
            <li>Sheet tab names must match class <code>sheet_name</code> exactly</li>
            <li>You must have Editor access to the Google Sheet</li>
            <li>Teachers must already be assigned to classes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UnifiedEvaluationSetup;