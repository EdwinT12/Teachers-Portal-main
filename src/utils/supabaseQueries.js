/**
 * Supabase Query Helpers for Weekly Report
 * 
 * This file contains reusable database query functions for fetching
 * attendance and evaluation data from Supabase.
 */

import supabase from './supabase';

/**
 * Fetches all catechism lesson dates from the database
 * These represent the actual dates when lessons took place
 * 
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Filter lessons from this date onwards
 * @param {Date} options.endDate - Filter lessons up to this date
 * @param {string} options.groupType - Filter by group type: 'Junior', 'Senior', 'Both', or null for all
 * @returns {Promise<Array>} Array of lesson date objects
 */
export const fetchLessonDates = async ({ startDate = null, endDate = null, groupType = null } = {}) => {
  try {
    let query = supabase
      .from('catechism_lesson_logs')
      .select('lesson_date, group_type, notes, created_by, created_by_email')
      .order('lesson_date', { ascending: false });

    if (startDate) {
      query = query.gte('lesson_date', startDate);
    }

    if (endDate) {
      query = query.lte('lesson_date', endDate);
    }

    if (groupType) {
      query = query.eq('group_type', groupType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching lesson dates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in fetchLessonDates:', error);
    return [];
  }
};

/**
 * Fetches attendance records for a specific class and date
 * 
 * @param {string} classId - The UUID of the class
 * @param {string} attendanceDate - The date to check (YYYY-MM-DD format)
 * @returns {Promise<Array>} Array of attendance record objects
 */
export const fetchAttendanceRecords = async (classId, attendanceDate) => {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, student_id, status, created_at, teacher_id, synced_to_sheets, column_identifier')
      .eq('class_id', classId)
      .eq('attendance_date', attendanceDate);

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching attendance for class ${classId} on ${attendanceDate}:`, error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in fetchAttendanceRecords:', error);
    return [];
  }
};

/**
 * Fetches evaluation records for a specific class and chapter
 * 
 * @param {string} classId - The UUID of the class
 * @param {number} chapterNumber - The chapter number to check
 * @returns {Promise<Array>} Array of evaluation record objects
 */
export const fetchEvaluationRecords = async (classId, chapterNumber) => {
  try {
    const { data, error } = await supabase
      .from('lesson_evaluations')
      .select('id, eval_student_id, category, rating, created_at, teacher_id, synced_to_sheets')
      .eq('class_id', classId)
      .eq('chapter_number', chapterNumber);

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching evaluations for class ${classId} chapter ${chapterNumber}:`, error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in fetchEvaluationRecords:', error);
    return [];
  }
};

/**
 * Fetches all students for a given class
 * 
 * @param {string} classId - The UUID of the class
 * @returns {Promise<Array>} Array of student objects
 */
export const fetchStudentsByClass = async (classId) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_name, house, row_number, student_identifier')
      .eq('class_id', classId)
      .order('row_number');

    if (error) {
      console.error(`Error fetching students for class ${classId}:`, error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in fetchStudentsByClass:', error);
    return [];
  }
};

/**
 * Fetches all evaluation students for a given class
 * 
 * @param {string} classId - The UUID of the class
 * @returns {Promise<Array>} Array of evaluation student objects
 */
export const fetchEvalStudentsByClass = async (classId) => {
  try {
    const { data, error } = await supabase
      .from('eval_students')
      .select('id, student_name, row_number')
      .eq('class_id', classId)
      .order('row_number');

    if (error) {
      console.error(`Error fetching eval_students for class ${classId}:`, error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in fetchEvalStudentsByClass:', error);
    return [];
  }
};

/**
 * Fetches all classes with optional filtering
 * 
 * @param {Object} options - Query options
 * @param {string} options.groupType - Filter by 'Junior' (0-5) or 'Senior' (6-12)
 * @returns {Promise<Array>} Array of class objects
 */
export const fetchClasses = async ({ groupType = null } = {}) => {
  try {
    let query = supabase
      .from('classes')
      .select('id, name, year_level, section, sheet_name')
      .order('year_level');

    if (groupType === 'Junior') {
      query = query.gte('year_level', 0).lte('year_level', 5);
    } else if (groupType === 'Senior') {
      query = query.gte('year_level', 6).lte('year_level', 12);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching classes:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in fetchClasses:', error);
    return [];
  }
};

/**
 * Fetches all active teachers with their assigned classes
 * 
 * @returns {Promise<Array>} Array of teacher profile objects with class information
 */
export const fetchTeachers = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        classes:default_class_id (
          id,
          name,
          year_level,
          sheet_name
        )
      `)
      .eq('role', 'teacher')
      .eq('status', 'active')
      .not('default_class_id', 'is', null)
      .order('full_name');

    if (error) {
      console.error('Error fetching teachers:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in fetchTeachers:', error);
    return [];
  }
};

/**
 * Fetches all unique chapters that have been evaluated
 * 
 * @returns {Promise<Array>} Array of chapter numbers (sorted)
 */
export const fetchAllChapters = async () => {
  try {
    const { data, error } = await supabase
      .from('lesson_evaluations')
      .select('chapter_number')
      .order('chapter_number');

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching chapters:', error);
      // Return default chapters 1-20 if there's an error
      return Array.from({ length: 20 }, (_, i) => i + 1);
    }

    const uniqueChapters = [...new Set((data || []).map(d => d.chapter_number))];
    const sortedChapters = uniqueChapters.filter(c => c !== null).sort((a, b) => a - b);
    
    // If no chapters exist yet, return default set (1-20)
    if (sortedChapters.length === 0) {
      return Array.from({ length: 20 }, (_, i) => i + 1);
    }
    
    return sortedChapters;
  } catch (error) {
    console.error('Exception in fetchAllChapters:', error);
    return Array.from({ length: 20 }, (_, i) => i + 1);
  }
};

/**
 * Utility function to determine if a class belongs to Junior or Senior group
 * 
 * @param {number} yearLevel - The year level (0-12)
 * @returns {string} 'Junior', 'Senior', or null
 */
export const getClassGroup = (yearLevel) => {
  if (yearLevel >= 0 && yearLevel <= 5) {
    return 'Junior';
  } else if (yearLevel >= 6 && yearLevel <= 12) {
    return 'Senior';
  }
  return null;
};

/**
 * Filters lesson dates based on class group
 * Returns only lessons that are relevant to the given class
 * 
 * @param {Array} lessonDates - Array of lesson date objects
 * @param {number} classYearLevel - The year level of the class
 * @returns {Array} Filtered array of lesson dates
 */
export const filterLessonsByClassGroup = (lessonDates, classYearLevel) => {
  const classGroup = getClassGroup(classYearLevel);
  
  return lessonDates.filter(lesson => {
    // Include lessons marked for "Both" groups
    if (lesson.group_type === 'Both') return true;
    
    // Include lessons that match this class's specific group
    if (lesson.group_type === classGroup) return true;
    
    return false;
  });
};

/**
 * Calculate completion statistics for a set of records
 * 
 * @param {Array} items - Array of items with status property
 * @returns {Object} Statistics object with counts and percentages
 */
export const calculateCompletionStats = (items) => {
  const complete = items.filter(item => item.status === 'complete').length;
  const partial = items.filter(item => item.status === 'partial').length;
  const incomplete = items.filter(item => item.status === 'incomplete').length;
  const total = items.length;

  return {
    complete,
    partial,
    incomplete,
    total,
    completePercentage: total > 0 ? Math.round((complete / total) * 100) : 0,
    partialPercentage: total > 0 ? Math.round((partial / total) * 100) : 0,
    incompletePercentage: total > 0 ? Math.round((incomplete / total) * 100) : 0
  };
};

export default {
  fetchLessonDates,
  fetchAttendanceRecords,
  fetchEvaluationRecords,
  fetchStudentsByClass,
  fetchEvalStudentsByClass,
  fetchClasses,
  fetchTeachers,
  fetchAllChapters,
  getClassGroup,
  filterLessonsByClassGroup,
  calculateCompletionStats
};