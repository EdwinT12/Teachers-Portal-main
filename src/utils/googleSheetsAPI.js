// utils/googleSheetsAPI.js
import supabase from './supabase';

/**
 * Refresh Google OAuth token using the refresh token
 */
const refreshGoogleToken = async (refreshToken) => {
  try {
    // Use Google's token endpoint to refresh the access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Google token');
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    throw error;
  }
};

/**
 * Get and refresh Google OAuth access token if needed
 */
export const getGoogleAccessToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      throw new Error('No active session');
    }

    let providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // Refresh 5 minutes before expiry

    if (!providerToken) {
      throw new Error('No Google access token available');
    }

    // Check if token is expired or about to expire
    if (expiresAt && (expiresAt - now) < bufferTime) {
      console.log('🔄 Token expired or expiring soon, refreshing...');
      
      // First try Supabase's refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshData?.session?.provider_token) {
        console.log('✅ Token refreshed via Supabase');
        providerToken = refreshData.session.provider_token;
      } else if (providerRefreshToken) {
        // If Supabase refresh didn't provide new provider token, use Google's refresh
        console.log('🔄 Refreshing token directly with Google...');
        providerToken = await refreshGoogleToken(providerRefreshToken);
        console.log('✅ Token refreshed via Google API');
      } else {
        throw new Error('SESSION_EXPIRED');
      }
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
 * Retry a Google Sheets API call with token refresh
 */
export const retryWithTokenRefresh = async (apiCall, retryCount = 0) => {
  try {
    return await apiCall();
  } catch (error) {
    // Check if it's an auth error (401 or 403)
    const isAuthError = 
      error.message?.includes('401') || 
      error.message?.includes('403') ||
      error.message?.includes('unauthorized') ||
      error.message?.includes('Invalid Credentials');
    
    if (isAuthError && retryCount < 3) {
      console.log('🔄 Auth error detected, attempting refresh...', retryCount + 1);
      
      try {
        // Force refresh both Supabase and Google tokens
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData?.session) {
          // Try direct Google token refresh
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.provider_refresh_token) {
            await refreshGoogleToken(session.provider_refresh_token);
          } else {
            throw new Error('SESSION_EXPIRED');
          }
        }

        console.log('✅ Token refreshed, retrying API call...');
        
        // Wait a moment for token to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry the API call with refreshed token
        return await retryWithTokenRefresh(apiCall, retryCount + 1);
      } catch (refreshError) {
        console.error('Failed to refresh and retry:', refreshError);
        throw new Error('SESSION_EXPIRED');
      }
    }
    
    throw error;
  }
};

/**
 * Manually force refresh the session and tokens
 * Can be called by a "Refresh Connection" button
 */
export const forceRefreshSession = async () => {
  try {
    console.log('🔄 Manually refreshing session...');
    
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    // Refresh Supabase session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      throw refreshError;
    }

    // If we have a refresh token but no new provider token, refresh with Google
    if (!refreshData?.session?.provider_token && session.provider_refresh_token) {
      await refreshGoogleToken(session.provider_refresh_token);
    }

    console.log('✅ Session refreshed successfully');
    return { success: true };
  } catch (error) {
    console.error('Error refreshing session:', error);
    throw error;
  }
};

// ... rest of your existing functions (getColumnLetter, updateSheetCell, etc.)
// Keep all your other functions as they are

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
  return retryWithTokenRefresh(async () => {
    const { accessToken } = await getGoogleAccessToken();
    
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
  });
};

/**
 * Update multiple cells in Google Sheets at once (batch update)
 */
export const batchUpdateSheetCells = async (spreadsheetId, sheetName, updates) => {
  return retryWithTokenRefresh(async () => {
    const { accessToken } = await getGoogleAccessToken();
    
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
  });
};

/**
 * Read data from Google Sheets
 */
export const readSheetData = async (spreadsheetId, sheetName, range) => {
  return retryWithTokenRefresh(async () => {
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
  });
};

/**
 * Get spreadsheet metadata (sheet names, etc.)
 */
export const getSpreadsheetMetadata = async (spreadsheetId) => {
  return retryWithTokenRefresh(async () => {
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
  });
};

/**
 * Helper function to get column number from date
 */
export const getDateColumn = (date) => {
  const startDate = new Date('2025-09-07');
  const targetDate = new Date(date);
  
  const daysDiff = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24));
  const weeksDiff = Math.floor(daysDiff / 7);
  
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_sheets_id')
      .eq('id', attendanceRecord.teacher_id)
      .single();

    if (profileError) throw profileError;

    if (!profile?.google_sheets_id) {
      throw new Error('No Google Sheets ID configured for this teacher');
    }

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

    const dateColumn = getDateColumn(attendanceRecord.attendance_date);

    await updateSheetCell(
      profile.google_sheets_id,
      student.classes.sheet_name,
      student.row_number,
      dateColumn,
      attendanceRecord.status
    );

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_sheets_id')
      .eq('id', attendanceRecords[0].teacher_id)
      .single();

    if (profileError) throw profileError;

    if (!profile?.google_sheets_id) {
      throw new Error('No Google Sheets ID configured');
    }

    const updates = [];
    
    for (const record of attendanceRecords) {
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

    const updatesBySheet = updates.reduce((acc, update) => {
      if (!acc[update.sheetName]) {
        acc[update.sheetName] = [];
      }
      acc[update.sheetName].push(update);
      return acc;
    }, {});

    for (const [sheetName, sheetUpdates] of Object.entries(updatesBySheet)) {
      await batchUpdateSheetCells(
        profile.google_sheets_id, 
        sheetName, 
        sheetUpdates
      );
    }

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
    
    const recordIds = attendanceRecords.map(r => r.id);
    await supabase
      .from('attendance_records')
      .update({ 
        synced_to_sheets: false,
        sync_error: error.message === 'SESSION_EXPIRED' ? 'Session expired - please sign in again' : error.message
      })
      .in('id', recordIds);

    throw error;
  }
};

/**
 * Import students from Google Sheets to database
 */
export const importStudentsFromSheet = async (spreadsheetId, sheetName, classId, startRow = 4, endRow = 20) => {
  try {
    const range = `${sheetName}!A${startRow}:C${endRow}`;
    const studentData = await readSheetData(spreadsheetId, sheetName, range);

    const students = [];
    
    for (let i = 0; i < studentData.length; i++) {
      const row = studentData[i];
      const rowNumber = startRow + i;
      
      if (row[1]) {
        students.push({
          class_id: classId,
          house: row[0] || '',
          student_name: row[1],
          student_identifier: row[2] || '',
          row_number: rowNumber
        });
      }
    }

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
 */
export const retryFailedSyncs = async (teacherId) => {
  try {
    const { data: unsyncedRecords, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('synced_to_sheets', false)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    if (!unsyncedRecords || unsyncedRecords.length === 0) {
      return { success: true, syncedCount: 0, message: 'No failed syncs to retry' };
    }

    const result = await batchSyncAttendance(unsyncedRecords);
    
    return result;
  } catch (error) {
    console.error('Error retrying failed syncs:', error);
    throw error;
  }
};