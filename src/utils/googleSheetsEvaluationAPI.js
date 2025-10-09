// utils/googleSheetsEvaluationAPI.js
import supabase from './supabase';
import { getGoogleAccessToken, getColumnLetter } from './googleSheetsAPI';

/**
 * Get the column for a specific category and chapter in the evaluation sheet
 * The evaluation sheet has columns for each category (D, B, HW, AP) for each chapter
 */
export const getEvaluationColumn = (chapterNumber, category) => {
  // Evaluation sheet structure:
  // Column A: Empty
  // Column B: CLASS
  // Column C: Student names
  // Column D: Mid Term Total
  // Column E: Final Term Total 
  // Column F onwards: Chapter columns (1, 2, 3, 4, ...)
  // Each chapter has 4 sub-columns for D, B, HW, AP
  
  // First chapter starts at column F (6)
  const baseColumn = 6;
  
  // Map category to column offset within each chapter
  const categoryOffset = {
    'D': 0,   // Discipline
    'B': 1,   // Behaviour
    'HW': 2,  // Homework
    'AP': 3   // Active Participation
  };
  
  // Each chapter takes 4 columns (D, B, HW, AP)
  // Column calculation: base + ((chapter - 1) * 4) + categoryOffset
  const finalColumn = baseColumn + ((chapterNumber - 1) * 4) + (categoryOffset[category] || 0);
  
  console.log(`Chapter: ${chapterNumber}, Category: ${category}, Column: ${finalColumn} (${getColumnLetter(finalColumn)})`);
  
  return finalColumn;
};

/**
 * Update a single evaluation cell in Google Sheets
 */
export const updateEvaluationCell = async (spreadsheetId, sheetName, row, column, value) => {
  try {
    const { accessToken } = await getGoogleAccessToken();
    
    const columnLetter = getColumnLetter(column);
    const range = `${sheetName}!${columnLetter}${row}`;

    console.log(`Updating cell: ${range} with value: ${value}`);

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
      throw new Error(`Failed to update evaluation: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    console.log(`Successfully updated ${range}:`, result);
    return result;
  } catch (error) {
    console.error('Error updating evaluation cell:', error);
    throw error;
  }
};

/**
 * Batch update evaluation cells in Google Sheets
 */
export const batchUpdateEvaluationCells = async (spreadsheetId, sheetName, updates) => {
  try {
    const { accessToken } = await getGoogleAccessToken();
    
    // Format updates for batch request
    const data = updates.map(update => ({
      range: `${sheetName}!${getColumnLetter(update.column)}${update.row}`,
      values: [[update.value]]
    }));

    console.log(`Batch updating ${data.length} cells in sheet ${sheetName}`);
    console.log('Update ranges:', data.map(d => d.range).join(', '));

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
      throw new Error(`Failed to batch update evaluations: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    console.log('Batch update successful:', result);
    return result;
  } catch (error) {
    console.error('Error batch updating evaluations:', error);
    throw error;
  }
};

/**
 * Sync a single evaluation record to Google Sheets
 */
export const syncEvaluationToSheet = async (evaluationRecord) => {
  try {
    console.log('Starting sync for evaluation:', evaluationRecord);

    // Get the teacher's evaluation spreadsheet ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('evaluation_sheets_id')
      .eq('id', evaluationRecord.teacher_id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    console.log('Teacher profile:', profile);

    if (!profile?.evaluation_sheets_id) {
      throw new Error('No Evaluation Sheets ID configured for this teacher');
    }

    // Get eval_student information
    const { data: evalStudent, error: studentError } = await supabase
      .from('eval_students')
      .select(`
        row_number,
        student_name,
        classes (
          sheet_name
        )
      `)
      .eq('id', evaluationRecord.eval_student_id)
      .single();

    if (studentError) {
      console.error('Eval student error:', studentError);
      throw studentError;
    }

    console.log('Eval student data:', evalStudent);

    if (!evalStudent) {
      throw new Error('Eval student not found');
    }

    // Calculate the column based on chapter and category
    const column = getEvaluationColumn(evaluationRecord.chapter_number, evaluationRecord.category);

    console.log(`Syncing evaluation: Student ${evalStudent.student_name} (row ${evalStudent.row_number}), Column ${column}, Value ${evaluationRecord.rating}`);

    // Update the cell in Google Sheets
    await updateEvaluationCell(
      profile.evaluation_sheets_id,
      evalStudent.classes.sheet_name,
      evalStudent.row_number,
      column,
      evaluationRecord.rating
    );

    // Mark as synced in the database
    await supabase
      .from('lesson_evaluations')
      .update({ 
        synced_to_sheets: true,
        sync_error: null 
      })
      .eq('id', evaluationRecord.id);

    console.log('Evaluation synced successfully');
    return { success: true };
  } catch (error) {
    console.error('Error syncing evaluation to sheets:', error);
    
    // Log the error in the database
    await supabase
      .from('lesson_evaluations')
      .update({ 
        synced_to_sheets: false,
        sync_error: error.message 
      })
      .eq('id', evaluationRecord.id);

    throw error;
  }
};

/**
 * Batch sync multiple evaluation records to Google Sheets
 */
export const batchSyncEvaluations = async (evaluationRecords) => {
  try {
    if (!evaluationRecords || evaluationRecords.length === 0) {
      throw new Error('No records to sync');
    }

    console.log(`Starting batch sync for ${evaluationRecords.length} evaluations`);
    console.log('First record:', evaluationRecords[0]);

    // Get the teacher's evaluation spreadsheet ID from the first record
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('evaluation_sheets_id')
      .eq('id', evaluationRecords[0].teacher_id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    console.log('Teacher profile:', profile);

    if (!profile?.evaluation_sheets_id) {
      throw new Error('No Evaluation Sheets ID configured');
    }

    // Prepare all updates
    const updates = [];
    
    for (const record of evaluationRecords) {
      console.log('Processing record:', record);
      
      if (!record.eval_student_id) {
        console.error('Record missing eval_student_id:', record);
        continue;
      }

      // Get eval_student information
      const { data: evalStudent, error: studentError } = await supabase
        .from('eval_students')
        .select(`
          row_number,
          student_name,
          classes (
            sheet_name
          )
        `)
        .eq('id', record.eval_student_id)
        .single();

      if (studentError) {
        console.error(`Error fetching eval_student ${record.eval_student_id}:`, studentError);
        continue;
      }

      if (evalStudent) {
        const column = getEvaluationColumn(record.chapter_number, record.category);
        updates.push({
          row: evalStudent.row_number,
          column: column,
          value: record.rating,
          sheetName: evalStudent.classes.sheet_name,
          recordId: record.id,
          studentName: evalStudent.student_name
        });
        console.log(`Prepared update for ${evalStudent.student_name}: ${getColumnLetter(column)}${evalStudent.row_number} = ${record.rating}`);
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid records to sync - check that eval_students exist for this class');
    }

    console.log(`Batch syncing ${updates.length} evaluations`);

    // Group updates by sheet name
    const updatesBySheet = updates.reduce((acc, update) => {
      if (!acc[update.sheetName]) {
        acc[update.sheetName] = [];
      }
      acc[update.sheetName].push(update);
      return acc;
    }, {});

    console.log('Updates grouped by sheet:', Object.keys(updatesBySheet));

    // Batch update each sheet
    for (const [sheetName, sheetUpdates] of Object.entries(updatesBySheet)) {
      console.log(`Updating sheet "${sheetName}" with ${sheetUpdates.length} updates`);
      await batchUpdateEvaluationCells(
        profile.evaluation_sheets_id, 
        sheetName, 
        sheetUpdates
      );
    }

    // Mark all as synced in the database
    const recordIds = updates.map(u => u.recordId);
    const { error: updateError } = await supabase
      .from('lesson_evaluations')
      .update({ 
        synced_to_sheets: true,
        sync_error: null 
      })
      .in('id', recordIds);

    if (updateError) {
      console.error('Error updating sync status:', updateError);
    }

    console.log(`Successfully synced ${updates.length} evaluations`);

    return { 
      success: true, 
      syncedCount: updates.length,
      totalRecords: evaluationRecords.length 
    };
  } catch (error) {
    console.error('Error batch syncing evaluations:', error);
    
    // Mark all as failed with error message
    const recordIds = evaluationRecords.map(r => r.id);
    await supabase
      .from('lesson_evaluations')
      .update({ 
        synced_to_sheets: false,
        sync_error: error.message 
      })
      .in('id', recordIds);

    throw error;
  }
};

/**
 * Retry failed evaluation syncs
 */
export const retryFailedEvaluationSyncs = async (teacherId) => {
  try {
    // Get all unsynced records for this teacher
    const { data: unsyncedRecords, error } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('synced_to_sheets', false)
      .order('created_at', { ascending: true })
      .limit(50); // Process in batches

    if (error) throw error;

    if (!unsyncedRecords || unsyncedRecords.length === 0) {
      return { success: true, syncedCount: 0, message: 'No failed syncs to retry' };
    }

    console.log(`Retrying ${unsyncedRecords.length} failed syncs`);

    const result = await batchSyncEvaluations(unsyncedRecords);
    
    return result;
  } catch (error) {
    console.error('Error retrying failed evaluation syncs:', error);
    throw error;
  }
};