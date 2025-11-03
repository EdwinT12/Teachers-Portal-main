// utils/diagnosticLessonEvaluations.js
import supabase from './supabase';

/**
 * Comprehensive diagnostic tool for lesson evaluation remapping issues
 * Run this before bulk import to understand potential problems
 */
export const runLessonEvaluationDiagnostics = async () => {
  const report = {
    timestamp: new Date().toISOString(),
    issues: [],
    warnings: [],
    summary: {}
  };

  console.log('\n' + '='.repeat(70));
  console.log('🔍 LESSON EVALUATION REMAPPING DIAGNOSTICS');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Check total counts
    console.log('📊 STEP 1: Checking evaluation counts...\n');
    
    const { data: allEvals } = await supabase
      .from('lesson_evaluations')
      .select('*');

    const { data: linkedEvals } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .not('eval_student_id', 'is', null);

    const { data: orphanedEvals } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .is('eval_student_id', null)
      .not('student_name', 'is', null);

    const { data: evalsWithNotes } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .not('teacher_notes', 'is', null)
      .neq('teacher_notes', '');

    const orphanedWithNotes = orphanedEvals?.filter(e => 
      e.teacher_notes && e.teacher_notes.trim() !== ''
    ) || [];

    report.summary = {
      total: allEvals?.length || 0,
      linked: linkedEvals?.length || 0,
      orphaned: orphanedEvals?.length || 0,
      with_notes: evalsWithNotes?.length || 0,
      orphaned_with_notes: orphanedWithNotes.length
    };

    console.log(`   Total evaluations: ${report.summary.total}`);
    console.log(`   ✓ Linked (have eval_student_id): ${report.summary.linked}`);
    console.log(`   ⚠ Orphaned (NULL eval_student_id): ${report.summary.orphaned}`);
    console.log(`   📝 With teacher notes: ${report.summary.with_notes}`);
    console.log(`   🚨 Orphaned WITH notes: ${report.summary.orphaned_with_notes}\n`);

    if (report.summary.orphaned_with_notes > 0) {
      report.warnings.push(
        `${report.summary.orphaned_with_notes} orphaned evaluations have teacher notes that MUST be preserved!`
      );
    }

    // 2. Check for missing stored fields
    console.log('📋 STEP 2: Checking stored field population...\n');
    
    const missingFields = {
      student_name: 0,
      stored_class_id: 0,
      chapter_number: 0,
      stored_category: 0
    };

    linkedEvals?.forEach(e => {
      if (!e.student_name) missingFields.student_name++;
      if (!e.stored_class_id) missingFields.stored_class_id++;
      if (!e.chapter_number && e.chapter_number !== 0) missingFields.chapter_number++;
      if (!e.stored_category) missingFields.stored_category++;
    });

    console.log('   Linked evaluations missing stored fields:');
    Object.entries(missingFields).forEach(([field, count]) => {
      const status = count === 0 ? '✓' : '✗';
      console.log(`   ${status} ${field}: ${count} missing`);
      if (count > 0) {
        report.issues.push(`${count} linked evaluations missing ${field}`);
      }
    });
    console.log('');

    // 3. Check orphaned evaluations for remappability
    console.log('🔄 STEP 3: Checking orphaned evaluations remappability...\n');
    
    let remappable = 0;
    let notRemappable = 0;

    orphanedEvals?.forEach(e => {
      if (e.student_name && e.stored_class_id) {
        remappable++;
      } else {
        notRemappable++;
        if (e.teacher_notes && e.teacher_notes.trim() !== '') {
          report.issues.push(
            `Evaluation ${e.id} has notes but missing student_name or stored_class_id!`
          );
        }
      }
    });

    console.log(`   ✓ Remappable (have name + class): ${remappable}`);
    console.log(`   ✗ Not remappable (missing data): ${notRemappable}\n`);

    if (notRemappable > 0) {
      report.issues.push(`${notRemappable} orphaned evaluations cannot be remapped due to missing data`);
    }

    // 4. Check for name matching issues
    console.log('🔤 STEP 4: Analyzing potential name matching issues...\n');
    
    const { data: evalStudents } = await supabase
      .from('eval_students')
      .select('student_name, class_id');

    if (orphanedEvals && evalStudents) {
      const normalizeStudentName = (name) => 
        name ? name.trim().toLowerCase().replace(/\s+/g, ' ') : '';

      const currentStudentKeys = new Set(
        evalStudents.map(s => `${normalizeStudentName(s.student_name)}|${s.class_id}`)
      );

      const orphanedStudentKeys = new Map();
      orphanedEvals.forEach(e => {
        const key = `${normalizeStudentName(e.student_name)}|${e.stored_class_id}`;
        if (!orphanedStudentKeys.has(key)) {
          orphanedStudentKeys.set(key, {
            name: e.student_name,
            class_id: e.stored_class_id,
            count: 0,
            has_notes: false
          });
        }
        const info = orphanedStudentKeys.get(key);
        info.count++;
        if (e.teacher_notes && e.teacher_notes.trim() !== '') {
          info.has_notes = true;
        }
      });

      const unmatchedStudents = [];
      orphanedStudentKeys.forEach((info, key) => {
        if (!currentStudentKeys.has(key)) {
          unmatchedStudents.push(info);
        }
      });

      console.log(`   Orphaned evaluations reference ${orphanedStudentKeys.size} unique students`);
      console.log(`   Current database has ${evalStudents.length} students`);
      console.log(`   ⚠ ${unmatchedStudents.length} orphaned students NOT in current database:\n`);

      if (unmatchedStudents.length > 0) {
        unmatchedStudents.slice(0, 10).forEach(info => {
          const notesIndicator = info.has_notes ? '📝' : '  ';
          console.log(`      ${notesIndicator} "${info.name}" (class: ${info.class_id}, ${info.count} eval(s))`);
        });
        
        if (unmatchedStudents.length > 10) {
          console.log(`      ... and ${unmatchedStudents.length - 10} more\n`);
        } else {
          console.log('');
        }

        report.warnings.push(
          `${unmatchedStudents.length} orphaned students will fail to remap (not in new import)`
        );

        const unmatchedWithNotes = unmatchedStudents.filter(s => s.has_notes).length;
        if (unmatchedWithNotes > 0) {
          report.issues.push(
            `⚠️ CRITICAL: ${unmatchedWithNotes} students with teacher notes are not in the new import!`
          );
        }
      } else {
        console.log('   ✓ All orphaned students found in current database\n');
      }
    }

    // 5. Check for duplicate issues
    console.log('🔍 STEP 5: Checking for potential duplicate conflicts...\n');
    
    const { data: duplicateCheck } = await supabase
      .from('lesson_evaluations')
      .select('eval_student_id, chapter_number, category')
      .not('eval_student_id', 'is', null);

    if (duplicateCheck) {
      const seenCombinations = new Set();
      const duplicates = [];

      duplicateCheck.forEach(e => {
        const key = `${e.eval_student_id}|${e.chapter_number}|${e.category}`;
        if (seenCombinations.has(key)) {
          duplicates.push(key);
        }
        seenCombinations.add(key);
      });

      if (duplicates.length > 0) {
        console.log(`   ✗ Found ${duplicates.length} duplicate combinations\n`);
        report.issues.push(`${duplicates.length} duplicate eval_student_id+chapter+category combinations`);
      } else {
        console.log(`   ✓ No duplicates found\n`);
      }
    }

    // 6. Generate recommendations
    console.log('💡 STEP 6: Recommendations...\n');
    
    const recommendations = [];

    if (missingFields.student_name > 0 || missingFields.stored_class_id > 0) {
      recommendations.push(
        'Run the SQL migration to populate missing stored fields before bulk import'
      );
    }

    if (orphanedWithNotes.length > 0) {
      recommendations.push(
        `⚠️ IMPORTANT: ${orphanedWithNotes.length} orphaned evaluations have teacher notes - ensure remapping succeeds!`
      );
    }

    if (unmatchedStudents && unmatchedStudents.length > 0) {
      const unmatchedWithNotes = unmatchedStudents.filter(s => s.has_notes);
      if (unmatchedWithNotes.length > 0) {
        recommendations.push(
          `🚨 CRITICAL: ${unmatchedWithNotes.length} students with notes are missing from import - add them to the Google Sheet!`
        );
      } else {
        recommendations.push(
          `Note: ${unmatchedStudents.length} students will be removed (no notes to preserve)`
        );
      }
    }

    if (report.summary.orphaned > 0 && remappable === report.summary.orphaned) {
      recommendations.push(
        '✓ All orphaned evaluations are remappable - remapping should succeed'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✓ System looks healthy - ready for bulk import');
    }

    recommendations.forEach(rec => console.log(`   • ${rec}`));
    console.log('');

    report.recommendations = recommendations;

    // Summary
    console.log('='.repeat(70));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(70) + '\n');

    console.log(`Issues found: ${report.issues.length}`);
    if (report.issues.length > 0) {
      report.issues.forEach(issue => console.log(`   ✗ ${issue}`));
      console.log('');
    }

    console.log(`Warnings: ${report.warnings.length}`);
    if (report.warnings.length > 0) {
      report.warnings.forEach(warn => console.log(`   ⚠ ${warn}`));
      console.log('');
    }

    const criticalIssues = report.issues.filter(i => i.includes('CRITICAL')).length;
    if (criticalIssues > 0) {
      console.log('🚨 CRITICAL ISSUES MUST BE RESOLVED BEFORE BULK IMPORT! 🚨\n');
    } else if (report.issues.length > 0) {
      console.log('⚠️ Issues detected - review before proceeding with bulk import\n');
    } else {
      console.log('✅ All checks passed - safe to proceed with bulk import\n');
    }

    console.log('='.repeat(70) + '\n');

    return report;

  } catch (error) {
    console.error('Error running diagnostics:', error);
    report.issues.push(`Diagnostic error: ${error.message}`);
    return report;
  }
};

/**
 * Quick health check that can be called periodically
 */
export const quickHealthCheck = async () => {
  try {
    const { count: orphanedWithNotes } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .is('eval_student_id', null)
      .not('student_name', 'is', null)
      .not('teacher_notes', 'is', null)
      .neq('teacher_notes', '');

    return {
      healthy: orphanedWithNotes === 0,
      orphanedWithNotes: orphanedWithNotes || 0,
      message: orphanedWithNotes > 0 
        ? `⚠️ ${orphanedWithNotes} orphaned evaluations with notes need attention`
        : '✓ All evaluations properly linked'
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
};

/**
 * Test the remapping logic without actually updating anything
 * Useful for verifying the fix works before running actual bulk import
 */
export const testRemapping = async () => {
  console.log('\n🧪 TESTING REMAPPING LOGIC (DRY RUN)\n');
  console.log('This will NOT update the database - just simulate the remapping\n');

  try {
    const { data: orphanedEvals } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .is('eval_student_id', null)
      .not('student_name', 'is', null)
      .not('stored_class_id', 'is', null);

    const { data: evalStudents } = await supabase
      .from('eval_students')
      .select('id, student_name, class_id');

    if (!orphanedEvals || orphanedEvals.length === 0) {
      console.log('✓ No orphaned evaluations to test\n');
      return { success: true, would_remap: 0, would_fail: 0 };
    }

    const normalizeStudentName = (name) => 
      name ? name.trim().toLowerCase().replace(/\s+/g, ' ') : '';

    const studentMap = new Map();
    evalStudents.forEach(s => {
      const key = `${normalizeStudentName(s.student_name)}|${s.class_id}`;
      studentMap.set(key, s.id);
    });

    let wouldRemap = 0;
    let wouldFail = 0;
    let wouldPreserveNotes = 0;

    orphanedEvals.forEach(e => {
      const key = `${normalizeStudentName(e.student_name)}|${e.stored_class_id}`;
      if (studentMap.has(key)) {
        wouldRemap++;
        if (e.teacher_notes && e.teacher_notes.trim() !== '') {
          wouldPreserveNotes++;
        }
      } else {
        wouldFail++;
        if (e.teacher_notes && e.teacher_notes.trim() !== '') {
          console.log(`   ⚠️ Would LOSE notes for: ${e.student_name} (Chapter ${e.chapter_number})`);
        }
      }
    });

    console.log(`Results of dry run:`);
    console.log(`   ✓ Would successfully remap: ${wouldRemap}`);
    console.log(`   📝 Would preserve notes: ${wouldPreserveNotes}`);
    console.log(`   ✗ Would fail to remap: ${wouldFail}\n`);

    return {
      success: true,
      would_remap: wouldRemap,
      would_fail: wouldFail,
      would_preserve_notes: wouldPreserveNotes
    };

  } catch (error) {
    console.error('Error in test remapping:', error);
    return { success: false, error: error.message };
  }
};