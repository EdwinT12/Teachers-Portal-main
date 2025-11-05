/**
 * Parent Evaluation Visibility Utilities
 * Handles fetching and updating parent evaluation criteria visibility settings
 */

import supabase from './supabase';
import toast from 'react-hot-toast';

/**
 * Get all parents' evaluation visibility settings (admin only)
 */
export const getAllParentsVisibility = async () => {
  try {
    // First, get all parents from profiles
    const { data: allParents, error: parentsError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .contains('roles', ['parent']);

    if (parentsError) throw parentsError;

    if (!allParents || allParents.length === 0) {
      return [];
    }

    // Then get their visibility settings
    const { data: settings, error: settingsError } = await supabase
      .from('parent_evaluation_visibility')
      .select('*')
      .in('parent_id', allParents.map(p => p.id));

    if (settingsError) throw settingsError;

    // Merge parents with their settings, using defaults if no settings exist
    const parentsWithSettings = allParents.map(parent => {
      const parentSettings = settings?.find(s => s.parent_id === parent.id);
      
      return {
        parent_id: parent.id,
        show_homework: parentSettings?.show_homework ?? true,
        show_discipline: parentSettings?.show_discipline ?? true,
        show_participation: parentSettings?.show_participation ?? true,
        show_behaviour: parentSettings?.show_behaviour ?? true,
        admin_override: parentSettings?.admin_override ?? false,
        created_at: parentSettings?.created_at || new Date().toISOString(),
        updated_at: parentSettings?.updated_at || new Date().toISOString(),
        profiles: {
          id: parent.id,
          full_name: parent.full_name,
          email: parent.email
        }
      };
    });

    return parentsWithSettings;
  } catch (error) {
    console.error('Error fetching parent visibility settings:', error);
    toast.error('Failed to load parent settings');
    return [];
  }
};

/**
 * Get visibility settings for a specific parent
 */
export const getParentVisibilitySettings = async (parentId) => {
  try {
    const { data, error } = await supabase
      .from('parent_evaluation_visibility')
      .select('*')
      .eq('parent_id', parentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || {
      show_homework: true,
      show_discipline: true,
      show_participation: true,
      show_behaviour: true,
      admin_override: false
    };
  } catch (error) {
    console.error('Error fetching parent visibility settings:', error);
    return {
      show_homework: true,
      show_discipline: true,
      show_participation: true,
      show_behaviour: true,
      admin_override: false
    };
  }
};

/**
 * Update visibility for a specific parent (admin only)
 */
export const adminUpdateParentVisibility = async (parentId, settings, override = false) => {
  try {
    const { show_homework, show_discipline, show_participation, show_behaviour } = settings;

    const { error } = await supabase
      .from('parent_evaluation_visibility')
      .upsert({
        parent_id: parentId,
        show_homework,
        show_discipline,
        show_participation,
        show_behaviour,
        admin_override: override
      }, {
        onConflict: 'parent_id'
      });

    if (error) throw error;

    toast.success('Parent settings updated');
    return true;
  } catch (error) {
    console.error('Error updating parent visibility:', error);
    toast.error('Failed to update parent settings');
    return false;
  }
};

/**
 * Bulk update visibility for all parents (admin only)
 */
export const adminBulkUpdateParentVisibility = async (settings, override = false) => {
  try {
    const { show_homework, show_discipline, show_participation, show_behaviour } = settings;

    // Get all parent profiles - roles is an array column
    const { data: parents, error: parentsError } = await supabase
      .from('profiles')
      .select('id')
      .contains('roles', ['parent']);

    if (parentsError) throw parentsError;

    if (!parents || parents.length === 0) {
      toast.info('No parents found');
      return true;
    }

    // Prepare bulk upsert data
    const updates = parents.map(parent => ({
      parent_id: parent.id,
      show_homework,
      show_discipline,
      show_participation,
      show_behaviour,
      admin_override: override
    }));

    const { error } = await supabase
      .from('parent_evaluation_visibility')
      .upsert(updates, {
        onConflict: 'parent_id'
      });

    if (error) throw error;

    toast.success(`Updated settings for ${parents.length} parent${parents.length !== 1 ? 's' : ''}`);
    return true;
  } catch (error) {
    console.error('Error bulk updating parent visibility:', error);
    toast.error('Failed to update parent settings');
    return false;
  }
};

/**
 * Reset parent visibility to defaults (admin only)
 */
export const adminResetParentVisibility = async (parentId) => {
  try {
    const { error } = await supabase
      .from('parent_evaluation_visibility')
      .upsert({
        parent_id: parentId,
        show_homework: true,
        show_discipline: true,
        show_participation: true,
        show_behaviour: true,
        admin_override: false
      }, {
        onConflict: 'parent_id'
      });

    if (error) throw error;

    toast.success('Settings reset to defaults');
    return true;
  } catch (error) {
    console.error('Error resetting parent visibility:', error);
    toast.error('Failed to reset settings');
    return false;
  }
};

/**
 * Toggle a specific category for a parent (admin only)
 */
export const adminToggleParentCategory = async (parentId, settingKey, currentValue) => {
  try {
    // First get current settings
    const currentSettings = await getParentVisibilitySettings(parentId);
    
    const newSettings = {
      ...currentSettings,
      [settingKey]: !currentValue
    };

    return await adminUpdateParentVisibility(parentId, newSettings, currentSettings.admin_override);
  } catch (error) {
    console.error('Error toggling parent category:', error);
    return false;
  }
};
