// utils/remapAbsenceRequests.js
import supabase from './supabase';

/**
 * Remap absence requests to new student IDs after bulk import
 * 
 * This function finds all absence requests where student_id is NULL
 * (orphaned during student deletion) and remaps them to the new
 * student records based on student_name and class_id matching.
 * 
 * @returns {Promise<Object>} Result object with remapped_count and failed_count
 */
export const remapAbsenceRequests = async () => {
  try {
    console.log('Starting absence request remapping...');

    // Step 1: Find all orphaned absence requests (student_id is NULL but has student_name and class_id)
    const { data: orphanedRequests, error: fetchError } = await supabase
      .from('absence_requests')
      .select('*')
      .is('student_id', null)
      .not('student_name', 'is', null)
      .not('class_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching orphaned absence requests:', fetchError);
      throw fetchError;
    }

    if (!orphanedRequests || orphanedRequests.length === 0) {
      console.log('No orphaned absence requests found');
      return { remapped_count: 0, failed_count: 0, details: [] };
    }

    console.log(`Found ${orphanedRequests.length} orphaned absence requests to remap`);

    // Step 2: Fetch all current students to match against
    const { data: allStudents, error: studentsError } = await supabase
      .from('students')
      .select('id, student_name, class_id');

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      throw studentsError;
    }

    // Create a map for fast lookups: "student_name|class_id" => student_id
    const studentMap = new Map();
    allStudents.forEach(student => {
      const key = `${student.student_name}|${student.class_id}`;
      studentMap.set(key, student.id);
    });

    // Step 3: Remap each orphaned request
    let remappedCount = 0;
    let failedCount = 0;
    const remapResults = [];

    for (const request of orphanedRequests) {
      const key = `${request.student_name}|${request.class_id}`;
      const newStudentId = studentMap.get(key);

      if (newStudentId) {
        // Found a matching student - update the absence request
        const { error: updateError } = await supabase
          .from('absence_requests')
          .update({ student_id: newStudentId })
          .eq('id', request.id);

        if (updateError) {
          console.error(`Failed to remap absence request ${request.id}:`, updateError);
          failedCount++;
          remapResults.push({
            request_id: request.id,
            student_name: request.student_name,
            absence_date: request.absence_date,
            status: 'failed',
            error: updateError.message
          });
        } else {
          console.log(`✓ Remapped absence request for ${request.student_name} (${request.absence_date})`);
          remappedCount++;
          remapResults.push({
            request_id: request.id,
            student_name: request.student_name,
            absence_date: request.absence_date,
            status: 'remapped',
            new_student_id: newStudentId
          });
        }
      } else {
        // No matching student found
        console.warn(`✗ Could not find student for absence request: ${request.student_name} in class ${request.class_id}`);
        failedCount++;
        remapResults.push({
          request_id: request.id,
          student_name: request.student_name,
          absence_date: request.absence_date,
          class_id: request.class_id,
          status: 'no_match',
          error: 'Student not found in new dataset'
        });
      }
    }

    console.log(`Remapping complete: ${remappedCount} remapped, ${failedCount} failed`);

    return {
      remapped_count: remappedCount,
      failed_count: failedCount,
      details: remapResults
    };

  } catch (error) {
    console.error('Error during absence request remapping:', error);
    throw error;
  }
};

/**
 * Get statistics on absence requests state
 * Useful for debugging and monitoring
 */
export const getAbsenceRequestsStats = async () => {
  try {
    // Count total absence requests
    const { count: totalCount } = await supabase
      .from('absence_requests')
      .select('*', { count: 'exact', head: true });

    // Count requests with valid student_id
    const { count: linkedCount } = await supabase
      .from('absence_requests')
      .select('*', { count: 'exact', head: true })
      .not('student_id', 'is', null);

    // Count orphaned requests (student_id is null but has student_name)
    const { count: orphanedCount } = await supabase
      .from('absence_requests')
      .select('*', { count: 'exact', head: true })
      .is('student_id', null)
      .not('student_name', 'is', null);

    // Count completely broken requests (no student info at all)
    const { count: brokenCount } = await supabase
      .from('absence_requests')
      .select('*', { count: 'exact', head: true })
      .is('student_id', null)
      .is('student_name', null);

    return {
      total: totalCount || 0,
      linked: linkedCount || 0,
      orphaned: orphanedCount || 0,
      broken: brokenCount || 0
    };
  } catch (error) {
    console.error('Error getting absence requests stats:', error);
    return null;
  }
};