// api/cron-weekly-report.js
// Vercel Cron Job - Runs every Sunday at 7 PM

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Verify this is a cron request (Vercel adds this header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get today's date (should be Sunday)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Check if there's a catechism lesson logged for today
    const { data: lesson, error: lessonError } = await supabase
      .from('catechism_lesson_logs')
      .select('*')
      .eq('lesson_date', todayStr)
      .single();

    if (lessonError || !lesson) {
      console.log('No lesson found for today:', todayStr);
      return res.status(200).json({ 
        message: 'No lesson found for today', 
        date: todayStr 
      });
    }

    // Get all teachers with their classes
    const { data: teachers, error: teachersError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        classes:default_class_id (
          id,
          name,
          year_level
        )
      `)
      .eq('role', 'teacher')
      .eq('status', 'active')
      .not('default_class_id', 'is', null);

    if (teachersError) throw teachersError;

    // Categorize teachers
    const juniorTeachers = teachers.filter(t => 
      t.classes && t.classes.year_level <= 5
    );
    const seniorTeachers = teachers.filter(t => 
      t.classes && t.classes.year_level > 5
    );

    // Determine relevant teachers based on group_type
    let relevantTeachers = [];
    if (lesson.group_type === 'Both') {
      relevantTeachers = [...juniorTeachers, ...seniorTeachers];
    } else if (lesson.group_type === 'Junior') {
      relevantTeachers = juniorTeachers;
    } else if (lesson.group_type === 'Senior') {
      relevantTeachers = seniorTeachers;
    }

    // Check attendance and evaluation completion for each teacher
    const teacherProgress = await Promise.all(
      relevantTeachers.map(async (teacher) => {
        const { data: attendanceData } = await supabase
          .from('attendance_records')
          .select('id, created_at')
          .eq('teacher_id', teacher.id)
          .eq('attendance_date', todayStr);

        const { data: evaluationData } = await supabase
          .from('lesson_evaluations')
          .select('id, created_at')
          .eq('teacher_id', teacher.id)
          .eq('evaluation_date', todayStr);

        const hasAttendance = attendanceData && attendanceData.length > 0;
        const hasEvaluation = evaluationData && evaluationData.length > 0;

        return {
          teacher,
          hasAttendance,
          hasEvaluation,
          isComplete: hasAttendance && hasEvaluation,
          group: teacher.classes.year_level <= 5 ? 'Junior' : 'Senior'
        };
      })
    );

    // Calculate statistics
    const totalTeachers = teacherProgress.length;
    const completedBoth = teacherProgress.filter(t => t.isComplete).length;
    const completedAttendance = teacherProgress.filter(t => t.hasAttendance).length;
    const completedEvaluation = teacherProgress.filter(t => t.hasEvaluation).length;
    const completedNeither = teacherProgress.filter(t => !t.hasAttendance && !t.hasEvaluation).length;

    const reportData = {
      lesson,
      teacherProgress,
      stats: {
        totalTeachers,
        completedBoth,
        completedAttendance,
        completedEvaluation,
        completedNeither,
        completionRate: totalTeachers > 0 ? Math.round((completedBoth / totalTeachers) * 100) : 0,
        attendanceRate: totalTeachers > 0 ? Math.round((completedAttendance / totalTeachers) * 100) : 0,
        evaluationRate: totalTeachers > 0 ? Math.round((completedEvaluation / totalTeachers) * 100) : 0
      },
      juniorTeachers: teacherProgress.filter(t => t.group === 'Junior'),
      seniorTeachers: teacherProgress.filter(t => t.group === 'Senior')
    };

    // Call the send-weekly-report API to send the email
    const sendResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-weekly-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lessonDate: todayStr,
        reportData: reportData
      })
    });

    if (!sendResponse.ok) {
      throw new Error('Failed to send email');
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Weekly report sent successfully',
      date: todayStr,
      stats: reportData.stats
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ 
      error: 'Cron job failed', 
      details: error.message 
    });
  }
}