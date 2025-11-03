// Diagnostic script to check if the remapping fields exist in the database
// Run this in the browser console to diagnose the issue

import supabase from './supabase';

export const runDiagnostics = async () => {
  console.log('🔍 Running Teacher Notes Preservation Diagnostics...\n');
  
  try {
    // Test 1: Check if columns exist by trying to select them
    console.log('Test 1: Checking if remapping columns exist...');
    const { data: testData, error: testError } = await supabase
      .from('lesson_evaluations')
      .select('id, student_name, stored_class_id, stored_category, teacher_notes')
      .limit(1);
    
    if (testError) {
      console.error('❌ ERROR: Columns might not exist!', testError);
      console.log('\n⚠️  ACTION NEEDED: Run the SQL migration in Supabase Dashboard');
      console.log('   File: supabase/migrations/20250125_add_remapping_fields.sql');
      return;
    }
    
    if (testData) {
      console.log('✅ Columns exist in database!');
      console.log('   Sample record:', testData[0]);
    }
    
    // Test 2: Check how many evaluations have these fields populated
    console.log('\nTest 2: Checking field population...');
    
    const { count: totalCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true });
    
    const { count: withStudentName } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .not('student_name', 'is', null);
    
    const { count: withClassId } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .not('stored_class_id', 'is', null);
    
    const { count: withCategory } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .not('stored_category', 'is', null);
    
    const { count: withNotes } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .not('teacher_notes', 'is', null)
      .neq('teacher_notes', '');
    
    console.log(`   Total evaluations: ${totalCount}`);
    console.log(`   With student_name: ${withStudentName} (${Math.round(withStudentName/totalCount*100)}%)`);
    console.log(`   With stored_class_id: ${withClassId} (${Math.round(withClassId/totalCount*100)}%)`);
    console.log(`   With stored_category: ${withCategory} (${Math.round(withCategory/totalCount*100)}%)`);
    console.log(`   With teacher_notes: ${withNotes}`);
    
    if (withStudentName < totalCount) {
      console.warn(`\n⚠️  WARNING: ${totalCount - withStudentName} evaluations missing student_name!`);
      console.log('   These evaluations cannot be remapped after bulk import.');
    }
    
    // Test 3: Check orphaned evaluations
    console.log('\nTest 3: Checking for orphaned evaluations...');
    
    const { count: orphanedCount } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .is('eval_student_id', null)
      .not('student_name', 'is', null);
    
    const { count: orphanedWithNotes } = await supabase
      .from('lesson_evaluations')
      .select('*', { count: 'exact', head: true })
      .is('eval_student_id', null)
      .not('student_name', 'is', null)
      .not('teacher_notes', 'is', null)
      .neq('teacher_notes', '');
    
    if (orphanedCount > 0) {
      console.warn(`   ⚠️  Found ${orphanedCount} orphaned evaluations!`);
      if (orphanedWithNotes > 0) {
        console.warn(`   ⚠️  ${orphanedWithNotes} of them have teacher notes!`);
      }
      console.log('   Run bulk import to remap these evaluations.');
      
      // Show sample orphaned records
      const { data: orphanedSamples } = await supabase
        .from('lesson_evaluations')
        .select('student_name, stored_class_id, chapter_number, category, teacher_notes')
        .is('eval_student_id', null)
        .not('student_name', 'is', null)
        .limit(3);
      
      console.log('   Sample orphaned records:', orphanedSamples);
    } else {
      console.log('   ✅ No orphaned evaluations found!');
    }
    
    // Test 4: Check if eval_students exist for remapping
    console.log('\nTest 4: Checking eval_students availability...');
    
    const { count: evalStudentsCount } = await supabase
      .from('eval_students')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total eval_students: ${evalStudentsCount}`);
    
    if (evalStudentsCount === 0) {
      console.error('   ❌ No eval_students found! Run bulk import to create them.');
    } else {
      console.log('   ✅ Eval students exist for remapping!');
    }
    
    // Test 5: Try a test remap (dry run)
    if (orphanedCount > 0 && evalStudentsCount > 0) {
      console.log('\nTest 5: Testing remap logic (dry run)...');
      
      const { data: orphaned } = await supabase
        .from('lesson_evaluations')
        .select('id, student_name, stored_class_id')
        .is('eval_student_id', null)
        .not('student_name', 'is', null)
        .limit(1)
        .single();
      
      if (orphaned) {
        const { data: matchingStudent } = await supabase
          .from('eval_students')
          .select('id, student_name, class_id')
          .ilike('student_name', orphaned.student_name.trim())
          .eq('class_id', orphaned.stored_class_id)
          .limit(1)
          .single();
        
        if (matchingStudent) {
          console.log(`   ✅ Successfully matched orphaned evaluation!`);
          console.log(`      Orphaned: "${orphaned.student_name}" in class ${orphaned.stored_class_id}`);
          console.log(`      Match: "${matchingStudent.student_name}" (id: ${matchingStudent.id})`);
          console.log('   The remap function should work correctly.');
        } else {
          console.warn(`   ⚠️  Could not find matching student for "${orphaned.student_name}"`);
          console.log('      This student might have been removed from Google Sheets.');
          
          // Show available students in that class
          const { data: availableStudents } = await supabase
            .from('eval_students')
            .select('student_name')
            .eq('class_id', orphaned.stored_class_id)
            .limit(5);
          
          console.log('      Available students in this class:', 
            availableStudents.map(s => s.student_name).join(', '));
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    
    if (withStudentName === totalCount && orphanedCount === 0) {
      console.log('✅ SYSTEM STATUS: HEALTHY');
      console.log('   All evaluations have remapping fields');
      console.log('   No orphaned evaluations detected');
      console.log('   Teacher notes preservation is working correctly!');
    } else if (withStudentName < totalCount) {
      console.warn('⚠️  SYSTEM STATUS: NEEDS MIGRATION');
      console.warn('   Some evaluations missing remapping fields');
      console.warn('   Run the SQL migration in Supabase Dashboard');
    } else if (orphanedCount > 0) {
      console.warn('⚠️  SYSTEM STATUS: NEEDS REMAPPING');
      console.warn('   Orphaned evaluations detected');
      console.warn('   Run bulk import to remap them');
    }
    
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    console.log('\nPossible causes:');
    console.log('1. Database columns not created (run migration)');
    console.log('2. RLS policies blocking access');
    console.log('3. Network/connection issue');
  }
};

// Auto-run diagnostics when imported
console.log('💡 To run diagnostics, call: runDiagnostics()');
