// utils/remapLessonEvaluations.js
import supabase from './supabase';

/**
 * Normalize student name for matching - handles case sensitivity and whitespace
 */
const normalizeStudentName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Remap lesson evaluations (including teacher notes) to new eval_student IDs after bulk import
 * 
 * This function finds all lesson evaluations where eval_student_id is NULL
 * (orphaned during student deletion) and remaps them to the new
 * eval_student records based on student_name + class_id matching.
 * 
 * @returns {Promise<Object>} Result object with remapped_count and failed_count
 */
export const remapLessonEvaluations = async () => {
  try {
    console.log('Starting lesson evaluation remapping...');

    // Step 1: Find all orphaned lesson evaluations (eval_student_id is NULL but has student info)
    const { data: orphanedEvaluations, error: fetchError } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .is('eval_student_id', null)
      .not('student_name', 'is', null)
      .not('stored_class_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching orphaned lesson evaluations:', fetchError);
      throw fetchError;
    }

    if (!orphanedEvaluations || orphanedEvaluations.length === 0) {
      console.log('No orphaned lesson evaluations found');
      return { remapped_count: 0, failed_count: 0, details: [] };
    }

    console.log(`Found ${orphanedEvaluations.length} orphaned lesson evaluations to remap`);

    // Count how many have teacher notes (important to track)
    const withNotes = orphanedEvaluations.filter(e => e.teacher_notes && e.teacher_notes.trim() !== '').length;
    console.log(`  - ${withNotes} evaluations have teacher notes that will be preserved`);

    // Step 2: Fetch all current eval_students to match against
    const { data: allEvalStudents, error: studentsError } = await supabase
      .from('eval_students')
      .select('id, student_name, class_id');

    if (studentsError) {
      console.error('Error fetching eval_students:', studentsError);
      throw studentsError;
    }

    console.log(`Found ${allEvalStudents.length} eval_students in database`);

    // Create a map for fast lookups with normalized names: "normalized_name|class_id" => eval_student_id
    // Also keep a reverse map for diagnostic purposes
    const studentMap = new Map();
    const originalNameMap = new Map(); // For logging
    
    allEvalStudents.forEach(student => {
      const normalizedName = normalizeStudentName(student.student_name);
      const key = `${normalizedName}|${student.class_id}`;
      studentMap.set(key, student.id);
      originalNameMap.set(key, student.student_name);
    });

    // Step 3: Group orphaned evaluations by student for batch processing
    const studentEvaluations = new Map();
    orphanedEvaluations.forEach(evaluation => {
      const normalizedName = normalizeStudentName(evaluation.student_name);
      const key = `${normalizedName}|${evaluation.stored_class_id}`;
      if (!studentEvaluations.has(key)) {
        studentEvaluations.set(key, []);
      }
      studentEvaluations.get(key).push(evaluation);
    });

    console.log(`Grouped into ${studentEvaluations.size} unique student/class combinations`);

    // Step 4: Remap each group of evaluations
    let remappedCount = 0;
    let failedCount = 0;
    let notesPreserved = 0;
    const remapResults = [];
    const failedStudents = new Set();

    for (const [studentKey, evaluations] of studentEvaluations.entries()) {
      const newEvalStudentId = studentMap.get(studentKey);
      const firstEval = evaluations[0];

      if (newEvalStudentId) {
        // Found a matching student - update all evaluations for this student
        const originalName = originalNameMap.get(studentKey);
        console.log(`✓ Remapping ${evaluations.length} evaluation(s) for "${firstEval.student_name}" → "${originalName}"`);

        for (const evaluation of evaluations) {
          // Check if an evaluation already exists for this student/chapter/category
          const { data: existingEval, error: checkError } = await supabase
            .from('lesson_evaluations')
            .select('*')
            .eq('eval_student_id', newEvalStudentId)
            .eq('chapter_number', evaluation.chapter_number)
            .eq('category', evaluation.stored_category || evaluation.category)
            .maybeSingle();

          if (checkError && checkError.code !== 'PGRST116') {
            console.error(`Error checking for existing evaluation:`, checkError);
            failedCount++;
            remapResults.push({
              evaluation_id: evaluation.id,
              student_name: evaluation.student_name,
              chapter: evaluation.chapter_number,
              category: evaluation.stored_category || evaluation.category,
              has_notes: !!(evaluation.teacher_notes && evaluation.teacher_notes.trim()),
              status: 'failed',
              error: checkError.message
            });
            continue;
          }

          if (existingEval) {
            // Duplicate exists - merge the data
            console.log(`  → Duplicate found for Chapter ${evaluation.chapter_number} ${evaluation.category} - merging...`);

            // Preserve teacher notes from the orphaned evaluation if they exist
            const mergedNotes = evaluation.teacher_notes && evaluation.teacher_notes.trim()
              ? evaluation.teacher_notes
              : existingEval.teacher_notes;

            // Update the existing evaluation with merged data
            const { error: updateError } = await supabase
              .from('lesson_evaluations')
              .update({
                teacher_notes: mergedNotes,
                rating: evaluation.rating || existingEval.rating,
                student_name: evaluation.student_name,
                stored_class_id: evaluation.stored_class_id,
                stored_category: evaluation.stored_category || evaluation.category
              })
              .eq('id', existingEval.id);

            if (updateError) {
              console.error(`Failed to merge evaluation ${evaluation.id}:`, updateError);
              failedCount++;
              remapResults.push({
                evaluation_id: evaluation.id,
                student_name: evaluation.student_name,
                chapter: evaluation.chapter_number,
                category: evaluation.stored_category || evaluation.category,
                has_notes: !!(evaluation.teacher_notes && evaluation.teacher_notes.trim()),
                status: 'failed',
                error: `Merge failed: ${updateError.message}`
              });
            } else {
              // Delete the orphaned duplicate
              await supabase
                .from('lesson_evaluations')
                .delete()
                .eq('id', evaluation.id);

              remappedCount++;
              if (evaluation.teacher_notes && evaluation.teacher_notes.trim()) {
                notesPreserved++;
              }

              remapResults.push({
                evaluation_id: evaluation.id,
                student_name: evaluation.student_name,
                chapter: evaluation.chapter_number,
                category: evaluation.stored_category || evaluation.category,
                has_notes: !!(evaluation.teacher_notes && evaluation.teacher_notes.trim()),
                status: 'merged',
                new_eval_student_id: newEvalStudentId
              });
            }
          } else {
            // No duplicate - simply update the eval_student_id
            const { error: updateError } = await supabase
              .from('lesson_evaluations')
              .update({ eval_student_id: newEvalStudentId })
              .eq('id', evaluation.id);

            if (updateError) {
              console.error(`Failed to remap lesson evaluation ${evaluation.id}:`, updateError);
              failedCount++;
              remapResults.push({
                evaluation_id: evaluation.id,
                student_name: evaluation.student_name,
                chapter: evaluation.chapter_number,
                category: evaluation.stored_category || evaluation.category,
                has_notes: !!(evaluation.teacher_notes && evaluation.teacher_notes.trim()),
                status: 'failed',
                error: updateError.message
              });
            } else {
              remappedCount++;

              if (evaluation.teacher_notes && evaluation.teacher_notes.trim()) {
                notesPreserved++;
              }

              remapResults.push({
                evaluation_id: evaluation.id,
                student_name: evaluation.student_name,
                chapter: evaluation.chapter_number,
                category: evaluation.stored_category || evaluation.category,
                has_notes: !!(evaluation.teacher_notes && evaluation.teacher_notes.trim()),
                status: 'remapped',
                new_eval_student_id: newEvalStudentId
              });
            }
          }
        }
      } else {
        // No matching student found
        const [normalizedName, classId] = studentKey.split('|');
        console.warn(`✗ Could not find eval_student for: "${firstEval.student_name}" (normalized: "${normalizedName}") in class ${classId}`);
        console.warn(`  Available students in this class:`, 
          allEvalStudents
            .filter(s => s.class_id === firstEval.stored_class_id)
            .map(s => `"${s.student_name}"`)
            .join(', ') || 'none'
        );
        
        failedStudents.add(firstEval.student_name);
        
        evaluations.forEach(evaluation => {
          failedCount++;
          remapResults.push({
            evaluation_id: evaluation.id,
            student_name: evaluation.student_name,
            chapter: evaluation.chapter_number,
            category: evaluation.stored_category || evaluation.category,
            has_notes: !!(evaluation.teacher_notes && evaluation.teacher_notes.trim()),
            status: 'no_match',
            error: 'Student not found in new dataset',
            normalized_name: normalizedName,
            class_id: evaluation.stored_class_id
          });
        });
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Remapping complete: ${remappedCount} remapped, ${failedCount} failed`);
    if (notesPreserved > 0) {
      console.log(`📝 Preserved teacher notes in ${notesPreserved} evaluations!`);
    }
    if (failedStudents.size > 0) {
      console.log(`\n⚠️ Students not found in new import (${failedStudents.size}):`);
      failedStudents.forEach(name => console.log(`  - ${name}`));
    }
    console.log(`${'='.repeat(60)}\n`);

    return {
      remapped_count: remappedCount,
      failed_count: failedCount,
      notes_preserved: notesPreserved,
      failed_students: Array.from(failedStudents),
      details: remapResults
    };

  } catch (error) {
    console.error('Error during lesson evaluation remapping:', error);
    throw error;
  }
};

/**
 * Get statistics on lesson evaluations state
 * Useful for debugging and monitoring
 */
export const getLessonEvaluationsStats = async () => {
  try {
    // Count total lesson evaluations
    const { count: totalCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true });

    // Count evaluations with valid eval_student_id
    const { count: linkedCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .not('eval_student_id', 'is', null);

    // Count orphaned evaluations (eval_student_id is null but has student_name)
    const { count: orphanedCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .is('eval_student_id', null)
      .not('student_name', 'is', null);

    // Count evaluations with teacher notes
    const { count: withNotesCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .not('teacher_notes', 'is', null)
      .neq('teacher_notes', '');

    // Count orphaned evaluations that have teacher notes (critical to preserve!)
    const { count: orphanedWithNotesCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .is('eval_student_id', null)
      .not('student_name', 'is', null)
      .not('teacher_notes', 'is', null)
      .neq('teacher_notes', '');

    // Count completely broken evaluations (no student info at all)
    const { count: brokenCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .is('eval_student_id', null)
      .is('student_name', null);

    return {
      total: totalCount || 0,
      linked: linkedCount || 0,
      orphaned: orphanedCount || 0,
      broken: brokenCount || 0,
      with_notes: withNotesCount || 0,
      orphaned_with_notes: orphanedWithNotesCount || 0
    };
  } catch (error) {
    console.error('Error getting lesson evaluations stats:', error);
    return null;
  }
};

/**
 * Get orphaned evaluations with teacher notes
 * These are critical because they contain teacher input that must be preserved
 */
export const getOrphanedEvaluationsWithNotes = async () => {
  try {
    const { data, error } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .is('eval_student_id', null)
      .not('student_name', 'is', null)
      .not('teacher_notes', 'is', null)
      .neq('teacher_notes', '')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting orphaned evaluations with notes:', error);
    return [];
  }
};

/**
 * Diagnostic function to check for potential name matching issues
 */
export const diagnoseNameMatchingIssues = async () => {
  try {
    console.log('\n🔍 Running diagnostic for name matching issues...\n');

    // Get orphaned evaluations
    const { data: orphaned } = await supabase
      .from('lesson_evaluations')
      .select('student_name, stored_class_id')
      .is('eval_student_id', null)
      .not('student_name', 'is', null);

    // Get current eval_students
    const { data: current } = await supabase
      .from('eval_students')
      .select('student_name, class_id');

    if (!orphaned || !current) {
      console.log('No data to diagnose');
      return;
    }

    // Create sets of unique student names
    const orphanedNames = new Set(orphaned.map(e => normalizeStudentName(e.student_name)));
    const currentNames = new Set(current.map(s => normalizeStudentName(s.student_name)));

    // Find names that are in orphaned but not in current
    const missingNames = [...orphanedNames].filter(name => !currentNames.has(name));
    
    console.log(`Orphaned evaluations reference ${orphanedNames.size} unique student names`);
    console.log(`Current eval_students has ${currentNames.size} unique student names`);
    console.log(`${missingNames.length} orphaned names NOT found in current students:\n`);

    if (missingNames.length > 0) {
      missingNames.forEach(normalizedName => {
        const originalNames = orphaned
          .filter(e => normalizeStudentName(e.student_name) === normalizedName)
          .map(e => e.student_name);
        console.log(`  - "${originalNames[0]}" (normalized: "${normalizedName}")`);
      });
    } else {
      console.log('✅ All orphaned evaluation names match current students!');
      console.log('   Issue might be with class_id matching or other factors.');
    }

    console.log('\n');
  } catch (error) {
    console.error('Error in diagnosis:', error);
  }
};