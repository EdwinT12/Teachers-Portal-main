/**
 * Evaluation Visibility Utilities
 * Handles fetching and updating evaluation criteria visibility settings
 */

import supabase from './supabase';
import toast from 'react-hot-toast';

/**
 * Get visibility settings for the current teacher
 * Creates default settings if none exist
 */
export const getTeacherVisibilitySettings = async (teacherId) => {
  try {
    const { data, error } = await supabase.rpc('get_teacher_visibility_settings', {
      p_teacher_id: teacherId
    });

    if (error) throw error;

    if (data && data.length > 0) {
      return data[0];
    }

    // Fallback: if function doesn't return data, try direct query
    const { data: directData, error: directError } = await supabase
      .from('evaluation_visibility')
      .select('*')
      .eq('teacher_id', teacherId)
      .single();

    if (directError && directError.code !== 'PGRST116') {
      throw directError;
    }

    return directData || {
      show_homework: true,
      show_discipline: false,
      show_participation: false,
      show_behaviour: false,
      admin_override: false,
      updated_by_admin: false
    };
  } catch (error) {
    console.error('Error fetching visibility settings:', error);
    toast.error('Failed to load evaluation settings');
    // Return defaults on error
    return {
      show_homework: true,
      show_discipline: false,
      show_participation: false,
      show_behaviour: false,
      admin_override: false,
      updated_by_admin: false
    };
  }
};

/**
 * Update visibility settings for a teacher
 * Teachers can only update if admin_override is false
 */
export const updateTeacherVisibility = async (teacherId, settings) => {
  try {
    const { show_homework, show_discipline, show_participation, show_behaviour } = settings;

    const { error } = await supabase.rpc('update_teacher_visibility', {
      p_teacher_id: teacherId,
      p_show_homework: show_homework,
      p_show_discipline: show_discipline,
      p_show_participation: show_participation,
      p_show_behaviour: show_behaviour
    });

    if (error) {
      if (error.message.includes('locked by an administrator')) {
        toast.error('Settings are locked by an administrator');
      } else {
        throw error;
      }
      return false;
    }

    toast.success('Evaluation settings updated');
    return true;
  } catch (error) {
    console.error('Error updating visibility settings:', error);
    toast.error('Failed to update evaluation settings');
    return false;
  }
};

/**
 * Get all teachers' visibility settings (admin only)
 */
export const getAllTeachersVisibility = async () => {
  try {
    const { data, error } = await supabase
      .from('evaluation_visibility')
      .select(`
        *,
        profiles:teacher_id (
          id,
          full_name,
          email
        )
      `)
      .order('profiles(full_name)');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all visibility settings:', error);
    toast.error('Failed to load teacher settings');
    return [];
  }
};

/**
 * Bulk update visibility for all teachers (admin only)
 */
export const adminBulkUpdateVisibility = async (settings, override = false) => {
  try {
    const { show_homework, show_discipline, show_participation, show_behaviour } = settings;

    const { data, error } = await supabase.rpc('admin_bulk_update_visibility', {
      p_show_homework: show_homework,
      p_show_discipline: show_discipline,
      p_show_participation: show_participation,
      p_show_behaviour: show_behaviour,
      p_override: override
    });

    if (error) throw error;

    const count = data || 0;
    toast.success(`Updated settings for ${count} teacher${count !== 1 ? 's' : ''}`);
    return true;
  } catch (error) {
    console.error('Error bulk updating visibility:', error);
    toast.error('Failed to update teacher settings');
    return false;
  }
};

/**
 * Update visibility for a specific teacher (admin only)
 */
export const adminUpdateTeacherVisibility = async (teacherId, settings, override = false) => {
  try {
    const { show_homework, show_discipline, show_participation, show_behaviour } = settings;

    const { error } = await supabase
      .from('evaluation_visibility')
      .update({
        show_homework,
        show_discipline,
        show_participation,
        show_behaviour,
        updated_by_admin: true,
        admin_override: override,
        last_modified_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('teacher_id', teacherId);

    if (error) throw error;

    toast.success('Teacher settings updated');
    return true;
  } catch (error) {
    console.error('Error updating teacher visibility:', error);
    toast.error('Failed to update teacher settings');
    return false;
  }
};

/**
 * Reset teacher visibility to defaults (admin only)
 */
export const adminResetTeacherVisibility = async (teacherId) => {
  try {
    const { error } = await supabase.rpc('admin_reset_teacher_visibility', {
      p_teacher_id: teacherId
    });

    if (error) throw error;

    toast.success('Settings reset to defaults');
    return true;
  } catch (error) {
    console.error('Error resetting visibility:', error);
    toast.error('Failed to reset settings');
    return false;
  }
};

/**
 * Get visible categories based on settings
 * Returns array of category objects that should be displayed
 */
export const getVisibleCategories = (visibilitySettings) => {
  const allCategories = [
    { key: 'D', label: 'Discipline', color: '#3b82f6', settingKey: 'show_discipline' },
    { key: 'B', label: 'Behaviour', color: '#10b981', settingKey: 'show_behaviour' },
    { key: 'HW', label: 'Homework', color: '#f59e0b', settingKey: 'show_homework' },
    { key: 'AP', label: 'Active Participation', color: '#8b5cf6', settingKey: 'show_participation' }
  ];

  return allCategories.filter(category => 
    visibilitySettings[category.settingKey] === true
  );
};

/**
 * Get hidden categories that can be added
 */
export const getHiddenCategories = (visibilitySettings) => {
  const allCategories = [
    { key: 'D', label: 'Discipline', color: '#3b82f6', settingKey: 'show_discipline' },
    { key: 'B', label: 'Behaviour', color: '#10b981', settingKey: 'show_behaviour' },
    { key: 'HW', label: 'Homework', color: '#f59e0b', settingKey: 'show_homework' },
    { key: 'AP', label: 'Active Participation', color: '#8b5cf6', settingKey: 'show_participation' }
  ];

  return allCategories.filter(category => 
    visibilitySettings[category.settingKey] === false
  );
};

/**
 * Check if at least one category is visible
 */
export const hasVisibleCategories = (visibilitySettings) => {
  return visibilitySettings.show_homework ||
         visibilitySettings.show_discipline ||
         visibilitySettings.show_participation ||
         visibilitySettings.show_behaviour;
};

/**
 * Toggle a specific category visibility
 */
export const toggleCategoryVisibility = async (teacherId, categoryKey, currentSettings) => {
  const settingKeyMap = {
    'D': 'show_discipline',
    'B': 'show_behaviour',
    'HW': 'show_homework',
    'AP': 'show_participation'
  };

  const settingKey = settingKeyMap[categoryKey];
  if (!settingKey) {
    console.error('Invalid category key:', categoryKey);
    return false;
  }

  const newSettings = {
    ...currentSettings,
    [settingKey]: !currentSettings[settingKey]
  };

  return await updateTeacherVisibility(teacherId, newSettings);
};