import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import { readSheetData, getSpreadsheetMetadata } from '../utils/googleSheetsAPI';
import toast from 'react-hot-toast';

const BulkEvalStudentImport = () => {
  const { user } = useContext(AuthContext);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [importing, setImporting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [importResults, setImportResults] = useState(null);

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
    if (!spreadsheetId) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }

    try {
      toast.loading('Loading sheet tabs...');
      const metadata = await getSpreadsheetMetadata(spreadsheetId);
      setSheets(metadata);
      toast.dismiss();
      toast.success(`Found ${metadata.length} sheets`);
      
      // Also load classes
      await loadClasses();
    } catch (error) {
      toast.dismiss();
      console.error('Error loading sheets:', error);
      toast.error('Failed to load sheets. Check the spreadsheet ID and your permissions.');
    }
  };

  // Import students from a specific sheet (EVALUATION SHEET STRUCTURE)
  const importFromSheet = async (sheetName, classId) => {
    setImporting(true);
    try {
      console.log(`Importing from evaluation sheet: ${sheetName}`);
      
      // EVALUATION SHEET STRUCTURE:
      // Row 1: Header text (blue)
      // Row 2: CLASS, Year X, dates...
      // Row 3: Teachers
      // Row 4: "Date" label
      // Row 5+: Students (Column C has student names)
      
      // Read column C starting from row 5 (first student)
      const data = await readSheetData(spreadsheetId, sheetName, 'C5:C100');
      
      if (!data || data.length === 0) {
        throw new Error('No student data found in sheet');
      }

      console.log(`Raw data from ${sheetName} (first 5 rows):`, data.slice(0, 5));

      const students = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Column C = Student Name
        const studentName = row[0] ? row[0].trim() : '';
        
        // CRITICAL: Stop if we encounter an empty student name
        if (!studentName || studentName === '') {
          console.log(`Stopping at row ${i + 5}: No student name found. Total students: ${students.length}`);
          break;
        }

        // Skip header rows or invalid entries
        if (studentName.toLowerCase() === 'student' || 
            studentName.toLowerCase().includes('student name') ||
            studentName.toLowerCase() === 'date') {
          console.log(`Skipping row ${i + 5}: Header row detected`);
          continue;
        }

        // Skip house names if they appear in student column
        const houseNames = ['st.mark', 'st.luke', 'st.john', 'st.mathew', 'st.matthew'];
        if (houseNames.some(h => studentName.toLowerCase().includes(h))) {
          console.log(`Skipping row ${i + 5}: House name in student column - ${studentName}`);
          continue;
        }
        
        students.push({
          class_id: classId,
          student_name: studentName,
          house: null, // Evaluation sheet doesn't have house column
          student_identifier: studentName,
          row_number: i + 5 // Row 5 is first student (i=0 -> row 5)
        });

        console.log(`✓ Row ${i + 5}: ${studentName}`);
      }

      if (students.length === 0) {
        throw new Error('No valid students found after filtering');
      }

      console.log(`Prepared ${students.length} students for import from ${sheetName}`);

      // Insert into eval_students table
      const { data: insertedData, error } = await supabase
        .from('eval_students')
        .insert(students)
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log(`Successfully imported ${insertedData.length} eval students from ${sheetName}`);
      toast.success(`${sheetName}: Imported ${insertedData.length} evaluation students`);
      
      return {
        sheetName,
        success: true,
        count: insertedData.length
      };

    } catch (error) {
      console.error(`Error importing from ${sheetName}:`, error);
      toast.error(`${sheetName}: ${error.message}`);
      return {
        sheetName,
        success: false,
        error: error.message
      };
    }
  };

  // Import all sheets
  const importAllSheets = async () => {
    if (!spreadsheetId) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }

    if (sheets.length === 0) {
      toast.error('Please load sheet tabs first');
      return;
    }

    setImporting(true);
    const results = [];

    try {
      for (const sheet of sheets) {
        // Try to match sheet name with class name
        const matchingClass = classes.find(c => 
          c.sheet_name === sheet.title || c.name === sheet.title
        );

        if (!matchingClass) {
          console.warn(`No matching class found for sheet: ${sheet.title}`);
          results.push({
            sheetName: sheet.title,
            success: false,
            error: 'No matching class found'
          });
          continue;
        }

        const result = await importFromSheet(sheet.title, matchingClass.id);
        results.push(result);
      }

      setImportResults(results);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} sheets!`);
      }
      if (failCount > 0) {
        toast.error(`Failed to import ${failCount} sheets`);
      }

    } catch (error) {
      console.error('Error during bulk import:', error);
      toast.error('Import process failed');
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
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: '8px'
      }}>
        📋 Import Evaluation Students
      </h2>
      <p style={{
        color: '#666',
        marginBottom: '24px',
        fontSize: '14px'
      }}>
        Import students from your Evaluation Google Sheet into the eval_students table.
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
          onClick={loadSheetTabs}
          disabled={importing || !spreadsheetId}
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

      {/* Step 2: Show Sheets */}
      {sheets.length > 0 && (
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
            marginBottom: '12px'
          }}>
            Step 2: Found {sheets.length} Sheet Tabs
          </h3>
          <div style={{
            display: 'grid',
            gap: '8px',
            marginBottom: '16px'
          }}>
            {sheets.map(sheet => {
              const matchingClass = classes.find(c => 
                c.sheet_name === sheet.title || c.name === sheet.title
              );
              
              return (
                <div
                  key={sheet.sheetId}
                  style={{
                    backgroundColor: 'white',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong style={{ color: '#1a1a1a' }}>{sheet.title}</strong>
                    {matchingClass && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        backgroundColor: '#d4edda',
                        color: '#155724',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        ✓ Matched to {matchingClass.name}
                      </span>
                    )}
                    {!matchingClass && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        backgroundColor: '#fff3cd',
                        color: '#856404',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        ⚠ No matching class
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={importAllSheets}
            disabled={importing}
            style={{
              padding: '12px 24px',
              backgroundColor: importing ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: importing ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              width: '100%'
            }}
          >
            {importing ? 'Importing...' : 'Import All Evaluation Students'}
          </button>
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
          {importResults.map((result, index) => (
            <div
              key={index}
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
                  ✓ Imported {result.count} evaluation students
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
        <strong>ℹ️ Important Notes:</strong>
        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li>This imports students into the <code>eval_students</code> table (separate from attendance)</li>
          <li>Expected format: Student names in Column C, starting at Row 5</li>
          <li>Sheet names must match class <code>sheet_name</code> exactly</li>
          <li>You must have Editor access to the Google Sheet</li>
          <li>Duplicate students will be skipped</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkEvalStudentImport;