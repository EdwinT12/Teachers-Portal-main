import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import { readSheetData, getSpreadsheetMetadata } from '../utils/googleSheetsAPI';
import { remapParentStudentLinks } from '../utils/remapParentLinks';
import { remapAbsenceRequests, getAbsenceRequestsStats } from '../utils/remapAbsenceRequests';
import { remapLessonEvaluations, getLessonEvaluationsStats } from '../utils/remapLessonEvaluations';
import toast from 'react-hot-toast';
import { Trash2, RefreshCw, AlertCircle, FileText, BookOpen } from 'lucide-react';

const BulkStudentImport = () => {
  const { user } = useContext(AuthContext);
  const [attendanceSheetId, setAttendanceSheetId] = useState('1kTbE3-JeukrhPMg46eEPqOagEK82olcLIUExqmKWhAs');
  const [evaluationSheetId, setEvaluationSheetId] = useState('1tVWRqyYrTHbYFPh4Yo8NVjjrxE3ZRYcsce0nwT0mcDc');
  const [importing, setImporting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [attendanceSheets, setAttendanceSheets] = useState([]);
  const [evaluationSheets, setEvaluationSheets] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [studentCounts, setStudentCounts] = useState({ 
    students: 0, 
    evalStudents: 0, 
    absenceRequests: 0,
    lessonEvaluations: 0
  });
  const [absenceStats, setAbsenceStats] = useState(null);
  const [evaluationStats, setEvaluationStats] = useState(null);
  
  // Progress tracking states
  const [progress, setProgress] = useState({
    currentStep: '',
    percentage: 0,
    totalSteps: 0,
    completedSteps: 0,
    estimatedTimeRemaining: '',
    details: []
  });

  // Load student counts, absence request stats, and evaluation stats
  const loadStudentCounts = async () => {
    try {
      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      const { count: evalStudentsCount, error: evalError } = await supabase
        .from('eval_students')
        .select('*', { count: 'exact', head: true });

      const { count: absenceRequestsCount, error: absenceError } = await supabase
        .from('absence_requests')
        .select('*', { count: 'exact', head: true });

      const { count: evaluationsCount, error: evaluationsError } = await supabase
        .from('lesson_evaluations')
        .select('*', { count: 'exact', head: true });

      if (studentsError) throw studentsError;
      if (evalError) throw evalError;

      setStudentCounts({
        students: studentsCount || 0,
        evalStudents: evalStudentsCount || 0,
        absenceRequests: absenceRequestsCount || 0,
        lessonEvaluations: evaluationsCount || 0
      });

      // Load detailed stats
      const absStats = await getAbsenceRequestsStats();
      setAbsenceStats(absStats);

      const evalStats = await getLessonEvaluationsStats();
      setEvaluationStats(evalStats);
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
      
      // IMPORTANT: When creating evaluation records, we MUST include student_name, 
      // stored_class_id, and stored_category fields. These fields allow the system 
      // to remap evaluations back to students after bulk imports (when students get 
      // new UUIDs). Without these fields, teacher notes and evaluations will be lost!
      
      // Read the evaluation sheet structure:
      // Row 2: Class name (C), Mid Term Total (D), Final Term Total (E), Chapter numbers (F+)
      // Row 3: Student header (C), Totals (D,E), Category headers D/B/HW/AP repeating (F+)
      // Row 4: "Date" (C), Dates for each chapter column (F+)
      // Row 5+: Student names (C), Evaluation data (F+)
      
      const allData = await readSheetData(evaluationSheetId, sheetName, 'C2:AZ100');
      if (!allData || allData.length < 4) {
        console.log('Not enough data rows in evaluation sheet');
        return [];
      }
      
      const chapterRow = allData[0];      // Row 2 - chapter numbers
      const categoryRow = allData[1];     // Row 3 - category headers (D, B, HW, AP)
      const dateRow = allData[2];         // Row 4 - dates
      const dataRows = allData.slice(3);  // Row 5+ - student data
      
      console.log('Evaluation chapter row:', chapterRow);
      console.log('Evaluation category row:', categoryRow);
      console.log('Evaluation date row:', dateRow);
      
      // Build a map of chapter columns
      // Start from index 3 (column F) since C=0, D=1, E=2, F=3
      const chapterColumns = [];
      let currentChapter = null;
      let chapterStartIndex = null;
      
      for (let i = 3; i < chapterRow.length; i++) {
        const chapterCell = chapterRow[i];
        const categoryCell = categoryRow[i];
        
        // Check if this is a new chapter number
        const chapterNum = parseInt(chapterCell);
        if (!isNaN(chapterNum) && chapterNum >= 1 && chapterNum <= 15) {
          // Found a new chapter
          currentChapter = chapterNum;
          chapterStartIndex = i;
          
          console.log(`Found Chapter ${chapterNum} starting at column index ${i} (date: ${dateRow[i] || 'N/A'})`);
          
          // Each chapter has 4 columns: D, B, HW, AP
          // Map them based on the category row
          chapterColumns.push({
            chapterNumber: currentChapter,
            startIndex: i,
            date: dateRow[i] || '',
            columns: {
              D: i,
              B: i + 1,
              HW: i + 2,
              AP: i + 3
            }
          });
        }
      }

      if (chapterColumns.length === 0) {
        console.log('No chapter columns found in evaluation sheet');
        return [];
      }

      console.log(`Found ${chapterColumns.length} chapters to import:`, 
        chapterColumns.map(c => `Chapter ${c.chapterNumber}`));

      // Get eval students for this class
      const { data: students, error: studentsError } = await supabase
        .from('eval_students')
        .select('*')
        .eq('class_id', classId)
        .order('row_number');

      if (studentsError) throw studentsError;

      console.log(`Found ${students.length} eval students in database for class ${classId}`);

      const evaluationRecords = [];
      const categories = ['D', 'B', 'HW', 'AP'];
      
      // Process each chapter
      for (const chapterCol of chapterColumns) {
        console.log(`Processing Chapter ${chapterCol.chapterNumber}...`);
        
        // Process each category (D, B, HW, AP)
        for (const category of categories) {
          const columnIndex = chapterCol.columns[category];
          
          // Match each data row with a student by NAME
          for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
            const row = dataRows[rowIndex];
            const studentNameInSheet = row[0] ? row[0].trim() : ''; // Column C (index 0)
            const evalValue = row[columnIndex];
            
            if (!studentNameInSheet || !evalValue) continue;

            // Find matching student by name (case-insensitive)
            const matchingStudent = students.find(s => 
              s.student_name.trim().toLowerCase() === studentNameInSheet.toLowerCase()
            );
            
            if (!matchingStudent) {
              // Only log first time for each student
              if (category === 'D') {
                console.log(`No matching student found for: "${studentNameInSheet}" in row ${rowIndex + 5}`);
              }
              continue;
            }

            // Valid ratings: E, G, I (Excellent, Good, Improving)
            const cleanedValue = evalValue.toString().trim().toUpperCase();
            const validRatings = ['E', 'G', 'I'];
            
            if (validRatings.includes(cleanedValue)) {
              evaluationRecords.push({
                eval_student_id: matchingStudent.id,
                teacher_id: user.id,
                class_id: classId,
                student_name: matchingStudent.student_name,        // ADD: For remapping after bulk import
                stored_class_id: classId,                          // ADD: For remapping after bulk import
                chapter_number: chapterCol.chapterNumber,
                category: category,
                stored_category: category,                         // ADD: For remapping after bulk import
                rating: cleanedValue,
                teacher_notes: null,
                synced_to_sheets: true
              });
            }
          }
        }
      }

      console.log(`Created ${evaluationRecords.length} evaluation records for ${sheetName}`);
      return evaluationRecords;
    } catch (error) {
      console.error(`Error importing historical evaluations from ${sheetName}:`, error);
      return [];
    }
  };

  // Clear historical data (attendance and evaluations only, keep students)
  const clearHistoricalData = async () => {
    try {
      console.log('Clearing historical attendance records...');
      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (attendanceError) throw attendanceError;

      console.log('Clearing historical evaluation records (preserving teacher notes)...');
      
      // IMPORTANT: Only delete evaluations WITHOUT teacher notes
      // This preserves any manually added teacher comments
      const { error: evaluationError } = await supabase
        .from('lesson_evaluations')
        .delete()
        .or('teacher_notes.is.null,teacher_notes.eq.');

      if (evaluationError) throw evaluationError;

      console.log('Successfully cleared historical data (students & teacher notes preserved)');
      return true;
    } catch (error) {
      console.error('Error clearing historical data:', error);
      throw error;
    }
  };

  // Helper function to update progress
  const updateProgress = (currentStep, percentage, details = null, estimatedTime = '') => {
    setProgress(prev => ({
      ...prev,
      currentStep,
      percentage,
      estimatedTimeRemaining: estimatedTime,
      completedSteps: prev.completedSteps + (percentage > prev.percentage ? 1 : 0),
      ...(details && { details: [...prev.details, details] })
    }));
  };

  // Import historical data for all classes
  const importAllHistoricalData = async () => {
    // Get count of evaluations with teacher notes
    const { count: notesCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .not('teacher_notes', 'is', null)
      .neq('teacher_notes', '');

    // Warning confirmation
    const warningMessage = notesCount > 0
      ? `⚠️ WARNING: This will clear historical data from Google Sheets.\n\n` +
        `✅ GOOD NEWS: ${notesCount} evaluation(s) with teacher notes will be PRESERVED.\n` +
        `❌ All other evaluations will be deleted and re-imported from sheets.\n\n` +
        `This is meant for initial setup or refreshing data from Google Sheets.\n` +
        `Are you sure you want to continue?`
      : `⚠️ WARNING: This will DELETE all historical attendance and evaluation data, then re-import from Google Sheets.\n\n` +
        `This is meant for initial setup or refreshing data.\n` +
        `Are you sure you want to continue?`;

    if (!window.confirm(warningMessage)) {
      return;
    }

    try {
      setImporting(true);
      const startTime = Date.now();
      
      // Reset progress
      setProgress({
        currentStep: 'Initializing...',
        percentage: 0,
        totalSteps: attendanceSheets.length + evaluationSheets.length + 3,
        completedSteps: 0,
        estimatedTimeRemaining: 'Calculating...',
        details: []
      });

      toast.loading('Clearing existing historical data...');
      updateProgress('Clearing historical data...', 2);

      // STEP 1: Clear existing historical data (keep students)
      await clearHistoricalData();
      toast.dismiss();
      toast.success('Historical data cleared');

      toast.loading('Importing historical data...');
      updateProgress('Loading catechism lesson dates...', 5);

      // Get all catechism lesson dates
      const { data: lessons, error: lessonsError } = await supabase
        .from('catechism_lesson_logs')
        .select('lesson_date, group_type')
        .order('lesson_date', { ascending: false });

      if (lessonsError) throw lessonsError;

      if (!lessons || lessons.length === 0) {
        toast.dismiss();
        toast.error('No catechism lessons found. Please log lessons first.');
        setImporting(false);
        return;
      }

      const lessonDates = lessons.map(l => l.lesson_date);
      console.log('Found lesson dates:', lessonDates);

      updateProgress(`Found ${lessons.length} lesson dates`, 10);

      let totalAttendance = 0;
      let totalEvaluations = 0;
      let errors = [];

      const totalSheets = attendanceSheets.length + evaluationSheets.length;
      let processedSheets = 0;

      // Import for each class with delay to avoid rate limits
      for (const sheet of attendanceSheets) {
        const matchingClass = classes.find(c => 
          c.sheet_name === sheet.title || c.name === sheet.title
        );

        if (!matchingClass) {
          processedSheets++;
          continue;
        }

        const progressPercent = 10 + Math.round((processedSheets / totalSheets) * 70);
        const elapsed = (Date.now() - startTime) / 1000;
        const estimatedTotal = (elapsed / processedSheets) * totalSheets;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        const remainingMin = Math.floor(remaining / 60);
        const remainingSec = Math.floor(remaining % 60);
        
        updateProgress(
          `Importing attendance: ${sheet.title}`,
          progressPercent,
          { type: 'attendance', sheet: sheet.title, status: 'processing' },
          `~${remainingMin}m ${remainingSec}s remaining`
        );

        // Import historical attendance
        const attendanceRecords = await importHistoricalAttendance(
          sheet.title, 
          matchingClass.id, 
          lessonDates
        );

        if (attendanceRecords.length > 0) {
          // Check if unique constraint exists, if not, manually handle duplicates
          try {
            const { error } = await supabase
              .from('attendance_records')
              .upsert(attendanceRecords, {
                onConflict: 'student_id,attendance_date',
                ignoreDuplicates: false
              });

            if (error) {
              console.error('Error inserting attendance records:', error);
              errors.push(`Attendance (${sheet.title}): ${error.message}`);
            } else {
              totalAttendance += attendanceRecords.length;
              console.log(`Imported ${attendanceRecords.length} attendance records for ${sheet.title}`);
            }
          } catch (err) {
            console.error('Upsert failed, trying individual inserts:', err);
            // Fallback: insert individually with ignore duplicates
            for (const record of attendanceRecords) {
              const { error: insertError } = await supabase
                .from('attendance_records')
                .insert(record)
                .select()
                .single();
              
              if (!insertError) {
                totalAttendance++;
              }
            }
          }
        }

        processedSheets++;
        // Add delay between classes to avoid rate limiting
        await delay(500);
      }

      // Import for evaluation sheets with delay
      for (const sheet of evaluationSheets) {
        const matchingClass = classes.find(c => 
          c.sheet_name === sheet.title || c.name === sheet.title
        );

        if (!matchingClass) {
          processedSheets++;
          continue;
        }

        const progressPercent = 10 + Math.round((processedSheets / totalSheets) * 70);
        const elapsed = (Date.now() - startTime) / 1000;
        const estimatedTotal = (elapsed / processedSheets) * totalSheets;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        const remainingMin = Math.floor(remaining / 60);
        const remainingSec = Math.floor(remaining % 60);
        
        updateProgress(
          `Importing evaluations: ${sheet.title}`,
          progressPercent,
          { type: 'evaluation', sheet: sheet.title, status: 'processing' },
          `~${remainingMin}m ${remainingSec}s remaining`
        );

        // Import historical evaluations
        const evaluationRecords = await importHistoricalEvaluations(
          sheet.title, 
          matchingClass.id, 
          lessonDates
        );

        if (evaluationRecords.length > 0) {
          // Insert records one by one to handle duplicates gracefully
          for (const record of evaluationRecords) {
            try {
              // Check if record exists (unique constraint: eval_student_id, chapter_number, category)
              const { data: existing, error: checkError } = await supabase
                .from('lesson_evaluations')
                .select('id')
                .eq('eval_student_id', record.eval_student_id)
                .eq('chapter_number', record.chapter_number)
                .eq('category', record.category)
                .maybeSingle();

              if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
              }

              if (existing) {
                // Update existing record (including remapping fields for consistency)
                const { error: updateError } = await supabase
                  .from('lesson_evaluations')
                  .update({
                    rating: record.rating,
                    teacher_id: record.teacher_id,
                    synced_to_sheets: record.synced_to_sheets,
                    student_name: record.student_name,        // Ensure remapping fields are current
                    stored_class_id: record.stored_class_id,  // Ensure remapping fields are current
                    stored_category: record.stored_category   // Ensure remapping fields are current
                  })
                  .eq('id', existing.id);

                if (updateError) {
                  console.error('Error updating evaluation:', updateError);
                } else {
                  totalEvaluations++;
                }
              } else {
                // Insert new record
                const { error: insertError } = await supabase
                  .from('lesson_evaluations')
                  .insert(record);

                if (insertError) {
                  console.error('Error inserting evaluation:', insertError);
                } else {
                  totalEvaluations++;
                }
              }
            } catch (err) {
              console.error('Error processing evaluation record:', err);
            }
          }
        }

        processedSheets++;
        // Add delay between classes to avoid rate limiting
        await delay(500);
      }

      updateProgress('Finalizing import...', 95);
      await delay(500);
      updateProgress('Import complete!', 100, null, 'Done!');

      toast.dismiss();
      setImporting(false);
      
      if (errors.length > 0) {
        toast.error(`Completed with errors. Check console for details.`);
        console.error('Import errors:', errors);
      } else {
        toast.success(`✅ Historical data imported! ${totalAttendance} attendance records, ${totalEvaluations} evaluations`);
      }
    } catch (error) {
      console.error('Error importing historical data:', error);
      toast.dismiss();
      setImporting(false);
      toast.error('Failed to import historical data: ' + error.message);
    }
  };

  // MAIN IMPORT FUNCTION: Clear all students and re-import with absence requests AND evaluation remapping
  const handleUpdateSheet = async () => {
    if (attendanceSheets.length === 0 || evaluationSheets.length === 0) {
      toast.error('Please load sheet tabs first');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ WARNING: This will DELETE ALL existing students from both tables and re-import from sheets.\n\n` +
      `Current data:\n` +
      `- Attendance students: ${studentCounts.students}\n` +
      `- Evaluation students: ${studentCounts.evalStudents}\n` +
      `- Absence requests: ${studentCounts.absenceRequests}\n` +
      `- Lesson evaluations: ${studentCounts.lessonEvaluations}\n\n` +
      `✅ Absence requests will be PRESERVED and automatically remapped.\n` +
      `✅ Lesson evaluations and teacher notes will be PRESERVED and automatically remapped.\n\n` +
      `Are you sure you want to continue?`
    );

    if (!confirmed) return;

    setImporting(true);
    const results = [];
    const startTime = Date.now();

    // Reset progress
    setProgress({
      currentStep: 'Starting import...',
      percentage: 0,
      totalSteps: attendanceSheets.length + evaluationSheets.length + 4, // +4 for clear, parent remap, absence remap, eval remap
      completedSteps: 0,
      estimatedTimeRemaining: 'Calculating...',
      details: []
    });

    try {
      // Step 1: Show absence requests and evaluations before deletion
      updateProgress('Checking data to preserve...', 2);
      const statsBeforeDelete = await getAbsenceRequestsStats();
      const evalStatsBeforeDelete = await getLessonEvaluationsStats();
      
      if (statsBeforeDelete && statsBeforeDelete.total > 0) {
        console.log(`📋 Found ${statsBeforeDelete.total} absence requests that will be preserved`);
        toast.success(`📋 ${statsBeforeDelete.total} absence requests will be preserved`, { duration: 3000 });
      }
      
      if (evalStatsBeforeDelete && evalStatsBeforeDelete.total > 0) {
        console.log(`📝 Found ${evalStatsBeforeDelete.total} lesson evaluations (${evalStatsBeforeDelete.with_notes} with notes) that will be preserved`);
        toast.success(`📝 ${evalStatsBeforeDelete.total} evaluations (${evalStatsBeforeDelete.with_notes} with notes) will be preserved`, { duration: 3000 });
      }

      // Step 2: Clear all existing students
      // This will set student_id to NULL in absence_requests and eval_student_id to NULL in lesson_evaluations
      // but keep the student_name and class_id for remapping
      updateProgress('Clearing existing student data...', 5);
      toast.loading('Clearing existing student data...');
      await clearAllStudents();
      toast.dismiss();
      toast.success('Existing data cleared (absence requests & evaluations preserved)');
      
      updateProgress('Data cleared successfully', 8);

      // Step 3: Verify data is orphaned but not deleted
      const statsAfterDelete = await getAbsenceRequestsStats();
      const evalStatsAfterDelete = await getLessonEvaluationsStats();
      console.log('Absence requests after deletion:', statsAfterDelete);
      console.log('Lesson evaluations after deletion:', evalStatsAfterDelete);
      
      if (statsAfterDelete && statsAfterDelete.orphaned > 0) {
        console.log(`✓ ${statsAfterDelete.orphaned} absence requests are orphaned and ready for remapping`);
      }
      
      if (evalStatsAfterDelete && evalStatsAfterDelete.orphaned > 0) {
        console.log(`✓ ${evalStatsAfterDelete.orphaned} lesson evaluations are orphaned and ready for remapping`);
      }

      // Step 4: Import attendance students
      toast.loading('Importing attendance students...');
      const totalSheets = attendanceSheets.length + evaluationSheets.length;
      let processedSheets = 0;

      for (const sheet of attendanceSheets) {
        const progressPercent = 10 + Math.round((processedSheets / totalSheets) * 55);
        const elapsed = (Date.now() - startTime) / 1000;
        const estimatedTotal = processedSheets > 0 ? (elapsed / processedSheets) * totalSheets : totalSheets * 3;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        const remainingMin = Math.floor(remaining / 60);
        const remainingSec = Math.floor(remaining % 60);
        
        updateProgress(
          `Importing attendance students: ${sheet.title}`,
          progressPercent,
          { type: 'attendance', sheet: sheet.title, status: 'importing' },
          `~${remainingMin}m ${remainingSec}s remaining`
        );

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
          processedSheets++;
          continue;
        }

        const result = await importAttendanceStudents(sheet.title, matchingClass.id);
        results.push(result);
        processedSheets++;
      }

      // Step 5: Import evaluation students
      toast.dismiss();
      toast.loading('Importing evaluation students...');
      
      for (const sheet of evaluationSheets) {
        const progressPercent = 10 + Math.round((processedSheets / totalSheets) * 55);
        const elapsed = (Date.now() - startTime) / 1000;
        const estimatedTotal = (elapsed / processedSheets) * totalSheets;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        const remainingMin = Math.floor(remaining / 60);
        const remainingSec = Math.floor(remaining % 60);
        
        updateProgress(
          `Importing evaluation students: ${sheet.title}`,
          progressPercent,
          { type: 'evaluation', sheet: sheet.title, status: 'importing' },
          `~${remainingMin}m ${remainingSec}s remaining`
        );

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
          processedSheets++;
          continue;
        }

        const result = await importEvaluationStudents(sheet.title, matchingClass.id);
        results.push(result);
        processedSheets++;
      }

      updateProgress('Students imported successfully', 70);
      setImportResults(results);

      // Step 6: Remap parent-student relationships
      updateProgress('Re-linking parent-child relationships...', 75);
      toast.dismiss();
      toast.loading('Re-linking parent-child relationships...');
      
      try {
        const remapResult = await remapParentStudentLinks();
        console.log('Parent-child remapping result:', remapResult);
        
        if (remapResult && remapResult.remapped_count > 0) {
          toast.success(`✅ Re-linked ${remapResult.remapped_count} parent-child relationship${remapResult.remapped_count > 1 ? 's' : ''}!`);
        }
        
        if (remapResult && remapResult.failed_count > 0) {
          toast.error(`⚠️ ${remapResult.failed_count} parent-child relationship${remapResult.failed_count > 1 ? 's' : ''} could not be automatically linked`);
        }
      } catch (error) {
        console.error('Error remapping parent-student links:', error);
        toast.error('Warning: Could not re-link some parent-child relationships.');
      }

      // Step 7: Remap absence requests to new student IDs
      updateProgress('Re-linking absence requests...', 85);
      toast.dismiss();
      toast.loading('Re-linking absence requests to new student records...');
      
      try {
        const absenceRemapResult = await remapAbsenceRequests();
        console.log('Absence request remapping result:', absenceRemapResult);
        
        if (absenceRemapResult.remapped_count > 0) {
          toast.success(
            `✅ Successfully remapped ${absenceRemapResult.remapped_count} absence request${absenceRemapResult.remapped_count > 1 ? 's' : ''}!`,
            { duration: 5000 }
          );
        }
        
        if (absenceRemapResult.failed_count > 0) {
          toast.error(
            `⚠️ ${absenceRemapResult.failed_count} absence request${absenceRemapResult.failed_count > 1 ? 's' : ''} could not be remapped. ` +
            `This may be because the student was removed from the Google Sheet.`,
            { duration: 7000 }
          );
        }

        if (absenceRemapResult.remapped_count === 0 && absenceRemapResult.failed_count === 0) {
          console.log('No absence requests needed remapping');
        }
      } catch (error) {
        console.error('Error remapping absence requests:', error);
        toast.error('Warning: Some absence requests could not be remapped. Please check the absence requests panel.');
      }

      // Step 8: NEW - Remap lesson evaluations (including teacher notes)
      updateProgress('Re-linking lesson evaluations and teacher notes...', 92);
      toast.dismiss();
      toast.loading('Re-linking lesson evaluations and preserving teacher notes...');
      
      try {
        const evalRemapResult = await remapLessonEvaluations();
        console.log('Lesson evaluation remapping result:', evalRemapResult);
        
        if (evalRemapResult.remapped_count > 0) {
          const notesMsg = evalRemapResult.notes_preserved > 0 
            ? ` (${evalRemapResult.notes_preserved} with teacher notes preserved!)` 
            : '';
          
          toast.success(
            `✅ Successfully remapped ${evalRemapResult.remapped_count} lesson evaluation${evalRemapResult.remapped_count > 1 ? 's' : ''}${notesMsg}`,
            { duration: 5000 }
          );
        }
        
        if (evalRemapResult.failed_count > 0) {
          toast.error(
            `⚠️ ${evalRemapResult.failed_count} lesson evaluation${evalRemapResult.failed_count > 1 ? 's' : ''} could not be remapped. ` +
            `This may be because the student was removed from the Google Sheet.`,
            { duration: 7000 }
          );
        }

        if (evalRemapResult.remapped_count === 0 && evalRemapResult.failed_count === 0) {
          console.log('No lesson evaluations needed remapping');
        }
      } catch (error) {
        console.error('Error remapping lesson evaluations:', error);
        toast.error('Warning: Some lesson evaluations could not be remapped.');
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      updateProgress('Import complete!', 100, null, 'Done!');

      toast.dismiss();
      if (successCount > 0) {
        toast.success(`✅ Successfully imported ${successCount} sheets!`);
      }
      if (failCount > 0) {
        toast.error(`❌ ${failCount} sheets failed to import. Check the results below.`);
      }

      await loadStudentCounts();
    } catch (error) {
      console.error('Error during import:', error);
      toast.dismiss();
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '900px', 
      margin: '0 auto', 
      padding: '20px',
      position: 'relative'
    }}>
      {/* Loading Modal */}
      {importing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              width: '100%',
              backgroundColor: '#e0e7ff',
              borderRadius: '8px',
              height: '12px',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              <div style={{
                width: `${progress.percentage}%`,
                backgroundColor: '#667eea',
                height: '100%',
                transition: 'width 0.3s ease',
                borderRadius: '8px'
              }}></div>
            </div>
            
            <h3 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1a1a1a',
              marginBottom: '8px'
            }}>
              {progress.currentStep}
            </h3>
            
            <p style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '4px'
            }}>
              Progress: {progress.percentage}%
            </p>
            
            {progress.estimatedTimeRemaining && (
              <p style={{
                fontSize: '13px',
                color: '#888',
                marginTop: '8px'
              }}>
                {progress.estimatedTimeRemaining}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Title */}
      <h1 style={{
        fontSize: '32px',
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: '8px'
      }}>
        Bulk Student Import
      </h1>

      <p style={{
        fontSize: '14px',
        color: '#666',
        marginBottom: '24px'
      }}>
        Import students from Google Sheets into both attendance and evaluation systems
      </p>

      {/* Current Database Stats */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#1a1a1a',
          marginBottom: '16px'
        }}>
          Current Database
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: '12px',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '16px 8px',
            backgroundColor: 'white',
            borderRadius: '8px',
            minHeight: '100px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ 
              fontSize: '11px', 
              color: '#666', 
              marginBottom: '10px', 
              minHeight: '28px', 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1.3',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              Attendance<br/>Students
            </p>
            <p style={{ 
              fontSize: '32px', 
              fontWeight: '800', 
              color: '#667eea', 
              margin: 0,
              lineHeight: '1'
            }}>
              {studentCounts.students}
            </p>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '16px 8px',
            backgroundColor: 'white',
            borderRadius: '8px',
            minHeight: '100px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ 
              fontSize: '11px', 
              color: '#666', 
              marginBottom: '10px', 
              minHeight: '28px', 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1.3',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              Evaluation<br/>Students
            </p>
            <p style={{ 
              fontSize: '32px', 
              fontWeight: '800', 
              color: '#764ba2', 
              margin: 0,
              lineHeight: '1'
            }}>
              {studentCounts.evalStudents}
            </p>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '16px 8px',
            backgroundColor: 'white',
            borderRadius: '8px',
            minHeight: '100px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ 
              fontSize: '11px', 
              color: '#666', 
              marginBottom: '10px', 
              minHeight: '28px', 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1.3',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              Absence<br/>Requests
            </p>
            <p style={{ 
              fontSize: '32px', 
              fontWeight: '800', 
              color: '#10b981', 
              margin: 0,
              lineHeight: '1'
            }}>
              {studentCounts.absenceRequests}
            </p>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '16px 8px',
            backgroundColor: 'white',
            borderRadius: '8px',
            minHeight: '100px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ 
              fontSize: '11px', 
              color: '#666', 
              marginBottom: '10px', 
              minHeight: '28px', 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1.3',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              Evaluations
            </p>
            <p style={{ 
              fontSize: '32px', 
              fontWeight: '800', 
              color: '#f59e0b', 
              margin: 0,
              lineHeight: '1'
            }}>
              {studentCounts.lessonEvaluations}
            </p>
          </div>
        </div>
      </div>

      {/* Absence Requests Status Box */}
      {absenceStats && absenceStats.total > 0 && (
        <div style={{
          backgroundColor: '#eff6ff',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #3b82f6',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#1e40af',
          lineHeight: '1.6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <FileText style={{ width: '20px', height: '20px' }} />
            <strong>Absence Requests Status:</strong>
          </div>
          <ul style={{ margin: '4px 0 0 28px', padding: 0 }}>
            <li>Total absence requests: <strong>{absenceStats.total}</strong></li>
            <li>Properly linked: <strong style={{ color: '#10b981' }}>{absenceStats.linked}</strong></li>
            {absenceStats.orphaned > 0 && (
              <li>
                Orphaned (need remapping): <strong style={{ color: '#f59e0b' }}>{absenceStats.orphaned}</strong>
                <div style={{ fontSize: '12px', marginTop: '4px', color: '#92400e' }}>
                  ⚠️ Run bulk import to remap these requests
                </div>
              </li>
            )}
            {absenceStats.broken > 0 && (
              <li>
                Invalid (no student info): <strong style={{ color: '#ef4444' }}>{absenceStats.broken}</strong>
              </li>
            )}
          </ul>
          <div style={{ 
            marginTop: '12px', 
            paddingTop: '12px', 
            borderTop: '1px solid #bfdbfe',
            fontSize: '12px'
          }}>
            ✅ <strong>Good news:</strong> All absence requests will be preserved during bulk import and automatically 
            remapped to the correct students based on student name and class.
          </div>
        </div>
      )}

      {/* Evaluation Stats Status Box */}
      {evaluationStats && evaluationStats.total > 0 && (
        <div style={{
          backgroundColor: '#fef3c7',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #f59e0b',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#92400e',
          lineHeight: '1.6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <BookOpen style={{ width: '20px', height: '20px' }} />
            <strong>Lesson Evaluations Status:</strong>
          </div>
          <ul style={{ margin: '4px 0 0 28px', padding: 0 }}>
            <li>Total evaluations: <strong>{evaluationStats.total}</strong></li>
            <li>Properly linked: <strong style={{ color: '#10b981' }}>{evaluationStats.linked}</strong></li>
            <li>With teacher notes: <strong style={{ color: '#3b82f6' }}>{evaluationStats.with_notes}</strong></li>
            {evaluationStats.orphaned > 0 && (
              <li>
                Orphaned (need remapping): <strong style={{ color: '#f59e0b' }}>{evaluationStats.orphaned}</strong>
                {evaluationStats.orphaned_with_notes > 0 && (
                  <div style={{ fontSize: '12px', marginTop: '4px', color: '#92400e' }}>
                    ⚠️ {evaluationStats.orphaned_with_notes} have teacher notes!
                  </div>
                )}
              </li>
            )}
            {evaluationStats.broken > 0 && (
              <li>
                Invalid (no student info): <strong style={{ color: '#ef4444' }}>{evaluationStats.broken}</strong>
              </li>
            )}
          </ul>
          <div style={{ 
            marginTop: '12px', 
            paddingTop: '12px', 
            borderTop: '1px solid #fde68a',
            fontSize: '12px'
          }}>
            ✅ <strong>Good news:</strong> All lesson evaluations and teacher notes will be preserved during bulk import 
            and automatically remapped to the correct students.
          </div>
        </div>
      )}

      {/* Step 1: Enter Spreadsheet IDs */}
      <div style={{
        backgroundColor: '#fff',
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
          Step 1: Enter Spreadsheet IDs
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '6px'
          }}>
            Attendance Sheet ID
          </label>
          <input
            type="text"
            value={attendanceSheetId}
            onChange={(e) => setAttendanceSheetId(e.target.value)}
            placeholder="Paste attendance spreadsheet ID"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: '14px',
              border: '2px solid #e2e8f0',
              borderRadius: '6px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '6px'
          }}>
            Evaluation Sheet ID
          </label>
          <input
            type="text"
            value={evaluationSheetId}
            onChange={(e) => setEvaluationSheetId(e.target.value)}
            placeholder="Paste evaluation spreadsheet ID"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: '14px',
              border: '2px solid #e2e8f0',
              borderRadius: '6px',
              outline: 'none'
            }}
          />
        </div>

        <button
          onClick={loadSheetTabs}
          disabled={importing}
          style={{
            padding: '12px 24px',
            backgroundColor: importing ? '#ccc' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: importing ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            fontWeight: '600'
          }}
        >
          {importing ? 'Loading...' : 'Load Sheet Tabs'}
        </button>
      </div>

      {/* Step 2: Review and Import */}
      {attendanceSheets.length > 0 && evaluationSheets.length > 0 && (
        <div style={{
          backgroundColor: '#fef3c7',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #fbbf24'
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
                  Import Historical Data (Teacher Notes Preserved)
                </>
              )}
            </button>
          </div>

          {/* Warning Box */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#92400e'
          }}>
            <strong>ℹ️ About Historical Import:</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li>Deletes and re-imports attendance and evaluation data from Google Sheets</li>
              <li><strong>✅ Teacher notes are automatically preserved</strong></li>
              <li>Only use this for initial setup or to refresh data from sheets</li>
              <li>For weekly updates, use "Clear All & Re-import Students" instead</li>
            </ul>
          </div>
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

export default BulkStudentImport;