// utils/googleSheetsAPI.js
import supabase from './supabase';

/**
 * Get the Google OAuth access token for the current user
 */
export const getGoogleAccessToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      throw new Error('No active session');
    }

    // Get the provider token (Google OAuth token)
    const providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;

    if (!providerToken) {
      throw new Error('No Google access token available');
    }

    return {
      accessToken: providerToken,
      refreshToken: providerRefreshToken
    };
  } catch (error) {
    console.error('Error getting Google access token:', error);
    throw error;
  }
};

/**
 * Convert column number to letter (1 = A, 2 = B, 27 = AA, etc.)
 */
export const getColumnLetter = (column) => {
  let letter = '';
  let temp = column;
  
  while (temp > 0) {
    let rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  
  return letter;
};

/**
 * Convert column letter to number (A = 1, B = 2, AA = 27, etc.)
 */
export const getColumnNumber = (letter) => {
  let column = 0;
  for (let i = 0; i < letter.length; i++) {
    column = column * 26 + (letter.charCodeAt(i) - 64);
  }
  return column;
};

/**
 * Update a single cell in Google Sheets
 */
export const updateSheetCell = async (spreadsheetId, sheetName, row, column, value) => {
  try {
    const { accessToken } = await getGoogleAccessToken();
    
    // Convert column number to letter (e.g., 1 = A, 2 = B, etc.)
    const columnLetter = getColumnLetter(column);
    const range = `${sheetName}!${columnLetter}${row}`;

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[value]]
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to update sheet: ${errorData.error?.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating sheet cell:', error);
    throw error;
  }
};

/**
 * Update multiple cells in Google Sheets at once (batch update)
 */
export const batchUpdateSheetCells = async (spreadsheetId, sheetName, updates) => {
  try {
    const { accessToken } = await getGoogleAccessToken();
    
    // Format updates for batch request
    const data = updates.map(update => ({
      range: `${sheetName}!${getColumnLetter(update.column)}${update.row}`,
      values: [[update.value]]
    }));

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: data
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to batch update: ${errorData.error?.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error batch updating sheet:', error);
    throw error;
  }
};

/**
 * Read data from Google Sheets
 */
export const readSheetData = async (spreadsheetId, sheetName, range) => {
  try {
    const { accessToken } = await getGoogleAccessToken();
    
    const fullRange = `${sheetName}!${range}`;
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${fullRange}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to read sheet: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error('Error reading sheet data:', error);
    throw error;
  }
};

/**
 * Get spreadsheet metadata (sheet names, etc.)
 */
export const getSpreadsheetMetadata = async (spreadsheetId) => {
  try {
    const { accessToken } = await getGoogleAccessToken();
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to get metadata: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.sheets.map(sheet => ({
      sheetId: sheet.properties.sheetId,
      title: sheet.properties.title,
      index: sheet.properties.index
    }));
  } catch (error) {
    console.error('Error getting spreadsheet metadata:', error);
    throw error;
  }
};

/**
 * Helper function to get column number from date
 * This needs to be customized based on your sheet structure
 */
export const getDateColumn = (date) => {
  // Your sheet has Sep/07/2025 in column D (4)
  const startDate = new Date('2025-09-07'); // Changed from 2024
  const targetDate = new Date(date);
  
  // Calculate weeks difference
  const daysDiff = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24));
  const weeksDiff = Math.floor(daysDiff / 7);
  
  // Column D is 4, add weeks
  return 4 + weeksDiff;
};

/**
 * Format date for sheet header (e.g., "Sep/14")
 */
export const formatDateForSheet = (dateString) => {
  const date = new Date(dateString);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}/${day}`;
};

/**
 * Sync a single attendance record to Google Sheets
 */
export const syncAttendanceToSheet = async (attendanceRecord) => {
  try {
    // Get the teacher's spreadsheet ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_sheets_id')
      .eq('id', attendanceRecord.teacher_id)
      .single();

    if (profileError) throw profileError;

    if (!profile?.google_sheets_id) {
      throw new Error('No Google Sheets ID configured for this teacher');
    }

    // Get student information
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        row_number,
        classes (
          sheet_name
        )
      `)
      .eq('id', attendanceRecord.student_id)
      .single();

    if (studentError) throw studentError;

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate the column based on the date
    const dateColumn = getDateColumn(attendanceRecord.attendance_date);

    // Update the cell in Google Sheets
    await updateSheetCell(
      profile.google_sheets_id,
      student.classes.sheet_name,
      student.row_number,
      dateColumn,
      attendanceRecord.status
    );

    // Mark as synced in the database
    await supabase
      .from('attendance_records')
      .update({ 
        synced_to_sheets: true,
        sync_error: null 
      })
      .eq('id', attendanceRecord.id);

    return { success: true };
  } catch (error) {
    console.error('Error syncing to sheets:', error);
    
    // Log the error in the database
    await supabase
      .from('attendance_records')
      .update({ 
        synced_to_sheets: false,
        sync_error: error.message 
      })
      .eq('id', attendanceRecord.id);

    throw error;
  }
};

/**
 * Batch sync multiple attendance records to Google Sheets
 */
export const batchSyncAttendance = async (attendanceRecords) => {
  try {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      throw new Error('No records to sync');
    }

    // Get the teacher's spreadsheet ID from the first record
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_sheets_id')
      .eq('id', attendanceRecords[0].teacher_id)
      .single();

    if (profileError) throw profileError;

    if (!profile?.google_sheets_id) {
      throw new Error('No Google Sheets ID configured');
    }

    // Prepare all updates
    const updates = [];
    
    for (const record of attendanceRecords) {
      // Get student information
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select(`
          row_number,
          classes (
            sheet_name
          )
        `)
        .eq('id', record.student_id)
        .single();

      if (studentError) {
        console.error(`Error fetching student ${record.student_id}:`, studentError);
        continue;
      }

      if (student) {
        const dateColumn = getDateColumn(record.attendance_date);
        updates.push({
          row: student.row_number,
          column: dateColumn,
          value: record.status,
          sheetName: student.classes.sheet_name,
          recordId: record.id
        });
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid records to sync');
    }

    // Group updates by sheet name
    const updatesBySheet = updates.reduce((acc, update) => {
      if (!acc[update.sheetName]) {
        acc[update.sheetName] = [];
      }
      acc[update.sheetName].push(update);
      return acc;
    }, {});

    // Batch update each sheet
    for (const [sheetName, sheetUpdates] of Object.entries(updatesBySheet)) {
      await batchUpdateSheetCells(
        profile.google_sheets_id, 
        sheetName, 
        sheetUpdates
      );
    }

    // Mark all as synced in the database
    const recordIds = updates.map(u => u.recordId);
    const { error: updateError } = await supabase
      .from('attendance_records')
      .update({ 
        synced_to_sheets: true,
        sync_error: null 
      })
      .in('id', recordIds);

    if (updateError) {
      console.error('Error updating sync status:', updateError);
    }

    return { 
      success: true, 
      syncedCount: updates.length,
      totalRecords: attendanceRecords.length 
    };
  } catch (error) {
    console.error('Error batch syncing:', error);
    
    // Mark all as failed with error message
    const recordIds = attendanceRecords.map(r => r.id);
    await supabase
      .from('attendance_records')
      .update({ 
        synced_to_sheets: false,
        sync_error: error.message 
      })
      .in('id', recordIds);

    throw error;
  }
};

/**
 * Import students from Google Sheets to database
 * Useful for initial setup
 */
export const importStudentsFromSheet = async (spreadsheetId, sheetName, classId, startRow = 4, endRow = 20) => {
  try {
    // Read student data from sheet (columns A, B, C)
    const range = `${sheetName}!A${startRow}:C${endRow}`;
    const studentData = await readSheetData(spreadsheetId, sheetName, range);

    const students = [];
    
    for (let i = 0; i < studentData.length; i++) {
      const row = studentData[i];
      const rowNumber = startRow + i;
      
      if (row[1]) { // Check if student name exists (column B)
        students.push({
          class_id: classId,
          house: row[0] || '',
          student_name: row[1],
          student_identifier: row[2] || '',
          row_number: rowNumber
        });
      }
    }

    // Insert into database
    const { data, error } = await supabase
      .from('students')
      .insert(students)
      .select();

    if (error) throw error;

    return { 
      success: true, 
      importedCount: students.length,
      students: data 
    };
  } catch (error) {
    console.error('Error importing students:', error);
    throw error;
  }
};

/**
 * Retry failed syncs
 * Call this periodically or on-demand
 */
export const retryFailedSyncs = async (teacherId) => {
  try {
    // Get all unsynced records for this teacher
    const { data: unsyncedRecords, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('synced_to_sheets', false)
      .order('created_at', { ascending: true })
      .limit(50); // Process in batches

    if (error) throw error;

    if (!unsyncedRecords || unsyncedRecords.length === 0) {
      return { success: true, syncedCount: 0, message: 'No failed syncs to retry' };
    }

    // Attempt to sync
    const result = await batchSyncAttendance(unsyncedRecords);
    
    return result;
  } catch (error) {
    console.error('Error retrying failed syncs:', error);
    throw error;
  }
};