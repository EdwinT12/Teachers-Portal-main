// api/send-weekly-report.js
// Vercel Serverless Function to send weekly report emails

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting email send process...');

    // Check if EmailJS is configured
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
      console.error('EmailJS not configured. Missing env vars:', {
        hasServiceId: !!EMAILJS_SERVICE_ID,
        hasTemplateId: !!EMAILJS_TEMPLATE_ID,
        hasPublicKey: !!EMAILJS_PUBLIC_KEY,
        hasPrivateKey: !!EMAILJS_PRIVATE_KEY
      });
      return res.status(500).json({ 
        error: 'EmailJS not configured. Please set up environment variables.',
        details: 'Missing EmailJS credentials in environment variables'
      });
    }

    const { lessonDate, reportData } = req.body;

    if (!lessonDate || !reportData) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    console.log('Getting admin users...');

    // Get all admin users to send email to
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('role', 'admin')
      .eq('status', 'active');

    if (adminsError) {
      console.error('Error fetching admins:', adminsError);
      throw adminsError;
    }

    if (!admins || admins.length === 0) {
      return res.status(400).json({ error: 'No admin users found' });
    }

    console.log(`Found ${admins.length} admin(s)`);

    // Import EmailJS dynamically
    const emailjs = await import('@emailjs/browser');

    // Initialize EmailJS
    emailjs.init({
      publicKey: EMAILJS_PUBLIC_KEY,
      privateKey: EMAILJS_PRIVATE_KEY,
    });

    // Format the email content
    const emailContent = formatEmailContent(lessonDate, reportData);

    console.log('Sending emails...');

    // Send email to each admin
    const emailPromises = admins.map(async (admin) => {
      try {
        const templateParams = {
          to_email: admin.email,
          to_name: admin.full_name || 'Admin',
          subject: `Weekly Report - ${new Date(lessonDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
          lesson_date: new Date(lessonDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
          group_type: reportData.lesson.group_type,
          completion_rate: reportData.stats.completionRate,
          total_teachers: reportData.stats.totalTeachers,
          completed_both: reportData.stats.completedBoth,
          completed_attendance: reportData.stats.completedAttendance,
          completed_evaluation: reportData.stats.completedEvaluation,
          completed_neither: reportData.stats.completedNeither,
          junior_summary: formatTeachersSummary(reportData.juniorTeachers),
          senior_summary: formatTeachersSummary(reportData.seniorTeachers),
          report_html: emailContent
        };

        const result = await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          templateParams
        );

        console.log(`Email sent to ${admin.email}:`, result.text);
        return { success: true, email: admin.email };
      } catch (error) {
        console.error(`Failed to send to ${admin.email}:`, error);
        return { success: false, email: admin.email, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Email results: ${successCount} success, ${failCount} failed`);

    if (successCount === 0) {
      return res.status(500).json({
        error: 'Failed to send any emails',
        details: results
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: `Report sent to ${successCount} admin(s)`,
      successCount,
      failCount,
      results
    });

  } catch (error) {
    console.error('Error in send-weekly-report:', error);
    return res.status(500).json({ 
      error: 'Failed to send email', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

function formatTeachersSummary(teachers) {
  if (!teachers || teachers.length === 0) return 'No teachers in this group';
  
  return teachers.map(t => {
    const status = t.isComplete ? '✅ Complete' : 
                   t.hasAttendance ? '⚠️ Attendance only' :
                   t.hasEvaluation ? '⚠️ Evaluation only' : 
                   '❌ Not submitted';
    return `${t.teacher.full_name} (${t.teacher.classes.name}): ${status}`;
  }).join('\n');
}

function formatEmailContent(lessonDate, reportData) {
  const lessonDateFormatted = new Date(lessonDate).toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Weekly Teacher Progress Report</h2>
      <p style="color: #64748b; font-size: 14px;">
        ${lessonDateFormatted} - ${reportData.lesson.group_type} Group
      </p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #1e293b; margin-top: 0;">📊 Overall Statistics</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; color: #64748b;">Completion Rate:</td>
            <td style="padding: 8px; font-weight: bold; color: #10b981;">${reportData.stats.completionRate}%</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #64748b;">Total Teachers:</td>
            <td style="padding: 8px; font-weight: bold;">${reportData.stats.totalTeachers}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #64748b;">Complete (Both):</td>
            <td style="padding: 8px; font-weight: bold; color: #10b981;">${reportData.stats.completedBoth}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #64748b;">Attendance Only:</td>
            <td style="padding: 8px; font-weight: bold; color: #3b82f6;">${reportData.stats.completedAttendance - reportData.stats.completedBoth}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #64748b;">Evaluation Only:</td>
            <td style="padding: 8px; font-weight: bold; color: #8b5cf6;">${reportData.stats.completedEvaluation - reportData.stats.completedBoth}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #64748b;">Not Submitted:</td>
            <td style="padding: 8px; font-weight: bold; color: #ef4444;">${reportData.stats.completedNeither}</td>
          </tr>
        </table>
      </div>

      ${reportData.juniorTeachers.length > 0 ? `
        <div style="margin: 20px 0;">
          <h3 style="color: #92400e;">👥 Junior Teachers (Reception - Year 5)</h3>
          ${reportData.juniorTeachers.map(t => `
            <div style="padding: 12px; margin: 8px 0; background: ${t.isComplete ? '#d4edda' : '#fff3cd'}; border-radius: 6px;">
              <strong>${t.teacher.full_name}</strong> (${t.teacher.classes.name})<br/>
              <span style="color: ${t.isComplete ? '#10b981' : t.hasAttendance || t.hasEvaluation ? '#f59e0b' : '#ef4444'}; font-size: 12px;">
                ${t.isComplete ? '✅ Complete' : 
                  t.hasAttendance ? '⚠️ Attendance only' :
                  t.hasEvaluation ? '⚠️ Evaluation only' : 
                  '❌ Not submitted'}
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${reportData.seniorTeachers.length > 0 ? `
        <div style="margin: 20px 0;">
          <h3 style="color: #6d28d9;">🏆 Senior Teachers (Year 6+)</h3>
          ${reportData.seniorTeachers.map(t => `
            <div style="padding: 12px; margin: 8px 0; background: ${t.isComplete ? '#d4edda' : '#f5f3ff'}; border-radius: 6px;">
              <strong>${t.teacher.full_name}</strong> (${t.teacher.classes.name})<br/>
              <span style="color: ${t.isComplete ? '#10b981' : t.hasAttendance || t.hasEvaluation ? '#f59e0b' : '#ef4444'}; font-size: 12px;">
                ${t.isComplete ? '✅ Complete' : 
                  t.hasAttendance ? '⚠️ Attendance only' :
                  t.hasEvaluation ? '⚠️ Evaluation only' : 
                  '❌ Not submitted'}
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 12px;">
        <p>This is an automated report from the Teachers Portal System.</p>
      </div>
    </div>
  `;
}