import supabase from './supabase';
import toast from 'react-hot-toast';

/**
 * Remap Parent-Student Links After Bulk Import
 * 
 * This function should be called after bulk student imports to fix
 * any broken parent-child relationships caused by student IDs changing.
 * 
 * It matches students by name + class instead of relying solely on UUID.
 */
export const remapParentStudentLinks = async () => {
  try {
    console.log('🔄 Starting parent-student link remapping...');
    
    // Call the database function that handles remapping
    const { data, error } = await supabase.rpc('remap_parent_student_links');

    if (error) {
      console.error('Error remapping links:', error);
      throw error;
    }

    const result = data[0];
    
    console.log('✅ Remapping complete!');
    console.log(`   - Successfully remapped: ${result.remapped_count}`);
    console.log(`   - Failed to remap: ${result.failed_count}`);
    
    if (result.details) {
      console.log('\nDetails:');
      console.log(result.details);
    }

    // Show toast notification
    if (result.remapped_count > 0) {
      toast.success(
        `✓ Re-linked ${result.remapped_count} parent-child relationship${result.remapped_count > 1 ? 's' : ''}`,
        { duration: 5000 }
      );
    }

    if (result.failed_count > 0) {
      toast.error(
        `⚠ ${result.failed_count} relationship${result.failed_count > 1 ? 's' : ''} need manual attention`,
        { duration: 7000 }
      );
    }

    return result;

  } catch (error) {
    console.error('Failed to remap parent-student links:', error);
    toast.error('Failed to remap parent-student links. Check console for details.');
    throw error;
  }
};

/**
 * Check Parent-Child Link Status
 * 
 * Returns a summary of all parent-child relationships and their status
 */
export const checkParentChildLinkStatus = async () => {
  try {
    const { data, error } = await supabase
      .from('v_parent_child_status')
      .select('*');

    if (error) throw error;

    // Group by status
    const statusSummary = data.reduce((acc, link) => {
      const status = link.link_status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(link);
      return acc;
    }, {});

    console.log('📊 Parent-Child Link Status Summary:');
    Object.entries(statusSummary).forEach(([status, links]) => {
      console.log(`   ${status}: ${links.length}`);
    });

    return statusSummary;

  } catch (error) {
    console.error('Error checking link status:', error);
    throw error;
  }
};

/**
 * Get Broken Links
 * 
 * Returns all parent-child relationships that are currently broken
 */
export const getBrokenLinks = async () => {
  try {
    const { data, error } = await supabase
      .from('v_parent_child_status')
      .select('*')
      .eq('link_status', 'BROKEN_LINK');

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('Error getting broken links:', error);
    throw error;
  }
};

/**
 * Manually Fix a Broken Link
 * 
 * Allows manual fixing of a specific parent-child relationship
 * by providing the parent_children ID and new student ID
 */
export const manuallyFixLink = async (parentChildId, newStudentId) => {
  try {
    const { error } = await supabase
      .from('parent_children')
      .update({
        student_id: newStudentId,
        updated_at: new Date().toISOString()
      })
      .eq('id', parentChildId);

    if (error) throw error;

    toast.success('✓ Link updated successfully');
    return true;

  } catch (error) {
    console.error('Error fixing link manually:', error);
    toast.error('Failed to update link');
    throw error;
  }
};