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

  // Helper function to add delay between API calls
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper function to parse date from column header (e.g., "Sep/21", "Oct/05")
  const parseColumnDate = (columnHeader) => {
    try {
      if (!columnHeader) return null;
      
      // Handle formats like "Sep/21", "Oct/05", "09/14/2025"
      const cleaned = columnHeader.toString().trim();
      
      // Check if it's a full date format (MM/DD/YYYY)
      if (cleaned.includes('/')) {
        const parts = cleaned.split('/');
        
        if (parts.length === 3) {
          // Full format: MM/DD/YYYY or M/D/YYYY
          const [month, day, fullYear] = parts;
          // Create date string in YYYY-MM-DD format to avoid timezone issues
          const dateStr = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          return dateStr;
        } else if (parts.length === 2) {
          // Short format: Sep/21 or 09/14
          const [first, second] = parts;
          const currentYear = new Date().getFullYear();
          
          // Check if first part is a month name
          const monthMap = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          
          const monthNum = monthMap[first];
          if (monthNum) {
            // Format: Sep/21 -> 2025-09-21
            const dateStr = `${currentYear}-${monthNum}-${second.padStart(2, '0')}`;
            return dateStr;
          } else {
            // Format: 09/14 (numeric month/day) -> 2025-09-14
            const dateStr = `${currentYear}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
            return dateStr;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing date from column:', columnHeader, error);
      return null;
    }
  };

  // Import historical attendance data from Google Sheets
  const importHistoricalAttendance = async (sheetName, classId, lessonDates) => {
    try {
      console.log(`Importing historical attendance from ${sheetName}...`);
      
      // Read header row AND all data in one call to reduce API requests
      const allData = await readSheetData(attendanceSheetId, sheetName, 'D2:Z100');
      if (!allData || allData.length === 0) return [];
      
      const headers = allData[0]; // Row 2 headers
      const dataRows = allData.slice(2); // Skip rows 2 and 3, data starts at row 4
      
      console.log('Attendance sheet headers:', headers);
      
      const dateColumns = [];
      
      // Find which columns have dates that match our lesson dates
      headers.forEach((header, index) => {
        if (!header) return;
        const dateStr = parseColumnDate(header);
        if (dateStr) {
          console.log(`Parsed date: ${header} -> ${dateStr}, Match: ${lessonDates.includes(dateStr)}`);
          if (lessonDates.includes(dateStr)) {
            dateColumns.push({
              columnIndex: index, // Index within the data we read
              date: dateStr,
              header: header
            });
          }
        } else {
          console.log(`Could not parse date from header: "${header}"`);
        }
      });

      if (dateColumns.length === 0) {
        console.log('No matching date columns found in attendance sheet');
        return [];
      }

      console.log(`Found ${dateColumns.length} date columns to import:`, dateColumns);

      // Get students for this class
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId);

      if (studentsError) throw studentsError;

      // Process attendance data for all date columns
      const attendanceRecords = [];
      
      for (const dateCol of dateColumns) {
        // Match each row with a student
        for (let i = 0; i < dataRows.length && i < students.length; i++) {
          const row = dataRows[i];
          const attendanceValue = row[dateCol.columnIndex];
          const student = students.find(s => s.row_number === i + 4);
          
          if (!student || !attendanceValue) continue;

          // Valid attendance codes: P, A, L, U, UM, E
          const validCodes = ['P', 'A', 'L', 'U', 'UM', 'E'];
          const cleanedValue = attendanceValue.toString().trim().toUpperCase();
          
          if (validCodes.includes(cleanedValue)) {
            attendanceRecords.push({
              student_id: student.id,
              teacher_id: user.id, // Use current admin user's ID for RLS
              class_id: classId,
              attendance_date: dateCol.date,
              status: cleanedValue,
              column_identifier: dateCol.header,
              synced_to_sheets: true
            });
          }
        }
      }

      return attendanceRecords;
    } catch (error) {
      console.error(`Error importing historical attendance from ${sheetName}:`, error);
      return [];
    }
  };

  // Import historical evaluation data from Google Sheets
  const importHistoricalEvaluations = async (sheetName, classId, lessonDates) => {
    try {
      console.log(`Importing historical evaluations from ${sheetName}...`);
      
      // Read header row AND all data in one call to reduce API requests
      const allData = await readSheetData(evaluationSheetId, sheetName, 'D4:AZ100');
      if (!allData || allData.length === 0) return [];
      
      const headers = allData[0]; // Row 4 headers
      const dataRows = allData.slice(1); // Data starts at row 5
      
      console.log('Evaluation sheet headers:', headers);
      
      const dateColumns = [];
      
      // Find which columns have dates that match our lesson dates
      // Each date has 4 columns: D, B, HW, AP
      headers.forEach((header, index) => {
        if (!header) return;
        const dateStr = parseColumnDate(header);
        if (dateStr) {
          console.log(`Parsed date: ${header} -> ${dateStr}, Match: ${lessonDates.includes(dateStr)}`);
          if (lessonDates.includes(dateStr)) {
            dateColumns.push({
              startColumnIndex: index, // Index within the data we read
              date: dateStr,
              header: header
            });
          }
        } else {
          console.log(`Could not parse date from header: "${header}"`);
        }
      });

      if (dateColumns.length === 0) {
        console.log('No matching date columns found in evaluation sheet');
        return [];
      }

      console.log(`Found ${dateColumns.length} date columns to import:`, dateColumns);

      // Get eval students for this class
      const { data: students, error: studentsError } = await supabase
        .from('eval_students')
        .select('*')
        .eq('class_id', classId);

      if (studentsError) throw studentsError;

      const evaluationRecords = [];
      const categories = ['D', 'B', 'HW', 'AP'];
      
      for (const dateCol of dateColumns) {
        // Process 4 columns for each date (D, B, HW, AP)
        for (let catIndex = 0; catIndex < 4; catIndex++) {
          const columnIndex = dateCol.startColumnIndex + catIndex;
          
          // Match each row with a student
          for (let i = 0; i < dataRows.length && i < students.length; i++) {
            const row = dataRows[i];
            const evalValue = row[columnIndex];
            const student = students.find(s => s.row_number === i + 5);
            
            if (!student || !evalValue) continue;

            // Valid ratings: E, G, I (Excellent, Good, Improving)
            const cleanedValue = evalValue.toString().trim().toUpperCase();
            const validRatings = ['E', 'G', 'I'];
            
            if (validRatings.includes(cleanedValue)) {
              evaluationRecords.push({
                eval_student_id: student.id,
                teacher_id: user.id, // Use current admin user's ID for RLS
                class_id: classId,
                evaluation_date: dateCol.date,
                category: categories[catIndex],
                rating: cleanedValue,
                synced_to_sheets: true
              });
            }
          }
        }
      }

      return evaluationRecords;
    } catch (error) {
      console.error(`Error importing historical evaluations from ${sheetName}:`, error);
      return [];
    }
  };

  // Import historical data for all classes
  const importAllHistoricalData = async () => {
    try {
      toast.loading('Importing historical data...');

      // Get all catechism lesson dates
      const { data: lessons, error: lessonsError } = await supabase
        .from('catechism_lesson_logs')
        .select('lesson_date, group_type')
        .order('lesson_date', { ascending: false });

      if (lessonsError) throw lessonsError;

      if (!lessons || lessons.length === 0) {
        toast.dismiss();
        toast.error('No catechism lessons found. Please log lessons first.');
        return;
      }

      const lessonDates = lessons.map(l => l.lesson_date);
      console.log('Found lesson dates:', lessonDates);

      let totalAttendance = 0;
      let totalEvaluations = 0;

      // Import for each class with delay to avoid rate limits
      for (const sheet of attendanceSheets) {
        const matchingClass = classes.find(c => 
          c.sheet_name === sheet.title || c.name === sheet.title
        );

        if (!matchingClass) continue;

        // Import historical attendance
        const attendanceRecords = await importHistoricalAttendance(
          sheet.title, 
          matchingClass.id, 
          lessonDates
        );

        if (attendanceRecords.length > 0) {
          const { error } = await supabase
            .from('attendance_records')
            .upsert(attendanceRecords, {
              onConflict: 'student_id,attendance_date',
              ignoreDuplicates: false
            });

          if (error) {
            console.error('Error inserting attendance records:', error);
          } else {
            totalAttendance += attendanceRecords.length;
            console.log(`Imported ${attendanceRecords.length} attendance records for ${sheet.title}`);
          }
        }

        // Add delay between classes to avoid rate limiting
        await delay(500);
      }

      // Import for evaluation sheets with delay
      for (const sheet of evaluationSheets) {
        const matchingClass = classes.find(c => 
          c.sheet_name === sheet.title || c.name === sheet.title
        );

        if (!matchingClass) continue;

        // Import historical evaluations
        const evaluationRecords = await importHistoricalEvaluations(
          sheet.title, 
          matchingClass.id, 
          lessonDates
        );

        if (evaluationRecords.length > 0) {
          const { error } = await supabase
            .from('lesson_evaluations')
            .upsert(evaluationRecords, {
              onConflict: 'eval_student_id,evaluation_date,category',
              ignoreDuplicates: false
            });

          if (error) {
            console.error('Error inserting evaluation records:', error);
          } else {
            totalEvaluations += evaluationRecords.length;
            console.log(`Imported ${evaluationRecords.length} evaluation records for ${sheet.title}`);
          }
        }

        // Add delay between classes to avoid rate limiting
        await delay(500);
      }

      toast.dismiss();
      toast.success(`Historical data imported! ${totalAttendance} attendance records, ${totalEvaluations} evaluations`);
    } catch (error) {
      console.error('Error importing historical data:', error);
      toast.dismiss();
      toast.error('Failed to import historical data: ' + error.message);
    }
  };
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

      // Ask if user wants to import historical data
      const importHistorical = window.confirm(
        '✅ Students imported successfully!\n\n' +
        'Would you like to import historical attendance and evaluation data from previous catechism lessons?\n\n' +
        'This will read past lesson dates and populate your database with existing data from Google Sheets.'
      );

      if (importHistorical) {
        await importAllHistoricalData();
      }

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

          <div style={{ display: 'grid', gap: '12px' }}>
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

            <button
              onClick={importAllHistoricalData}
              disabled={importing}
              style={{
                padding: '14px 24px',
                backgroundColor: importing ? '#ccc' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: importing ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: importing ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {importing ? (
                <>
                  <RefreshCw style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                  Importing...
                </>
              ) : (
                <>
                  <AlertCircle style={{ width: '20px', height: '20px' }} />
                  Import Historical Data Only
                </>
              )}
            </button>
          </div>

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
        lineHeight: '1.6',
        marginBottom: '16px'
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

      {/* Historical Import Info */}
      <div style={{
        padding: '16px',
        backgroundColor: '#dbeafe',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#1e40af',
        lineHeight: '1.6'
      }}>
        <strong>ℹ️ Historical Data Import:</strong>
        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li>After importing students, you can import historical attendance and evaluation data</li>
          <li>Reads all past catechism lesson dates and matches them with Google Sheets columns</li>
          <li><strong>Attendance codes:</strong> P (Present), A (Absent), L (Late), U (Unexcused), UM (Unexcused Mass), E (Excused)</li>
          <li><strong>Evaluation ratings:</strong> E (Excellent), G (Good), I (Improving)</li>
          <li><strong>Evaluation categories:</strong> D (Discipline), B (Behaviour), HW (Homework), AP (Active Participation)</li>
          <li>Optimized to read entire sheets at once to avoid rate limits</li>
          <li>Includes small delays between classes to respect API quotas</li>
          <li>You can run "Import Historical Data Only" anytime to backfill missed records</li>
          <li>Tip: Log your catechism lessons first, then import historical data</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkStudentImport;