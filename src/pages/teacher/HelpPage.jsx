import { useState } from 'react';
import { useNavigate } from 'react-router';
import { 
  ArrowLeft, 
  BookOpen, 
  Calendar, 
  Award, 
  BarChart3, 
  FolderOpen, 
  Cloud, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Clock, 
  Church, 
  AlertCircle, 
  XCircle, 
  Heart, 
  Zap,
  Loader,
  Database,
  LogOut,
  Shield,
  Users
} from 'lucide-react';

/**
 * A sub-component to create a collapsible help section.
 */
const Section = ({ id, icon: Icon, title, children, expandedSection, toggleSection }) => {
  const isExpanded = expandedSection === id;

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      marginBottom: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      border: '1px solid #e5e7eb',
      overflow: 'hidden'
    }}>
      <button
        onClick={() => toggleSection(id)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isExpanded ? '#f9fafb' : 'white',
          border: 'none',
          cursor: 'pointer',
          padding: '24px',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Icon style={{ width: '28px', height: '28px', color: '#8b5cf6' }} />
          <h2 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: 0
          }}>
            {title}
          </h2>
        </div>
        {isExpanded ? 
          <ChevronUp style={{ width: '24px', height: '24px', color: '#666', flexShrink: 0 }} /> :
          <ChevronDown style={{ width: '24px', height: '24px', color: '#666', flexShrink: 0 }} />
        }
      </button>
      
      {isExpanded && (
        <div style={{
          padding: '0 24px 24px 24px',
          fontSize: '16px',
          lineHeight: '1.7',
          color: '#374151',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{ paddingTop: '24px' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * A styled component for highlighting important tips.
 */
const InfoBox = ({ children, type = 'info' }) => {
  const colors = {
    info: { bg: '#dbeafe', border: '#93c5fd', icon: HelpCircle, iconColor: '#3b82f6' },
    warning: { bg: '#fef3c7', border: '#fcd34d', icon: AlertCircle, iconColor: '#f59e0b' },
    danger: { bg: '#fee2e2', border: '#fca5a5', icon: AlertCircle, iconColor: '#ef4444' }
  };
  const config = colors[type];
  const Icon = config.icon;

  return (
    <div style={{
      backgroundColor: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: '8px',
      padding: '16px',
      marginTop: '16px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start'
    }}>
      <Icon style={{ width: '20px', height: '20px', color: config.iconColor, flexShrink: 0, marginTop: '2px' }} />
      <div style={{ fontSize: '15px', color: '#374151' }}>
        {children}
      </div>
    </div>
  );
};

/**
 * A comprehensive help page for teachers using the attendance and evaluation system.
 */
const HelpPage = () => {
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (id) => {
    setExpandedSection(prev => (prev === id ? null : id));
  };
  
  const commonProps = { expandedSection, toggleSection };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      paddingTop: '60px',
      paddingBottom: '60px',
      paddingLeft: window.innerWidth < 768 ? '16px' : '40px',
      paddingRight: window.innerWidth < 768 ? '16px' : '40px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .help-content h3 {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        .help-content p {
          margin-top: 0;
          margin-bottom: 16px;
        }
        .help-content ul, .help-content ol {
          padding-left: 24px;
          margin-bottom: 16px;
        }
        .help-content li {
          margin-bottom: 8px;
        }
        .help-content code {
          background-color: #f3f4f6;
          padding: 3px 6px;
          border-radius: 4px;
          font-family: 'monospace';
          font-size: 15px;
          color: #4b5563;
          font-weight: 600;
        }
      `}</style>
      
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <button
          onClick={() => navigate('/teacher')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: '#8b5cf6',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '24px',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ArrowLeft style={{ width: '20px', height: '20px' }} />
          Back to Dashboard
        </button>

        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.1)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <HelpCircle style={{ width: '48px', height: '48px' }} />
          </div>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '800',
            color: '#1a1a1a',
            margin: '0 0 12px 0'
          }}>
            Teacher Help Guide
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#666',
            margin: 0
          }}>
            Your complete guide to using the Catechism Management System.
          </p>
        </div>

        <div className="help-content">
          {/* Getting Started Section */}
          <Section id="getting-started" icon={BookOpen} title="Getting Started" {...commonProps}>
            <p>Welcome! This system helps you manage your class's attendance and evaluations, and access lesson plans. When you first log in, you'll see your Teacher Dashboard with a few main options:</p>
            
            <ul>
              <li><strong>Take Attendance:</strong> Use this for your weekly attendance marking.</li>
              <li><strong>Lesson Evaluation:</strong> Use this to enter student performance evaluations for each lesson/chapter.</li>
              <li><strong>Extended Dashboard:</strong> View all your class data, analyze trends, and see summaries.</li>
              <li><strong>View Lesson Plans:</strong> Access lesson plans and general resources.</li>
            </ul>

            <InfoBox type="warning">
              <strong>Pending Approval?</strong>
              <p style={{ margin: '4px 0 0 0' }}>If you don't see these buttons, or they are disabled, your account is likely pending approval. Please contact an administrator to be assigned to a class.</p>
            </InfoBox>
          </Section>

          {/* Taking Attendance Section */}
          <Section id="attendance" icon={Calendar} title="Taking Attendance (Daily Page)" {...commonProps}>
            <p>This page is for marking your class attendance for a specific Sunday. Here’s how to use it:</p>
            
            <h3>Step 1: Select the Date</h3>
            <p>Use the date picker at the top. The system will automatically suggest the nearest Sunday, but you can select any date to mark or update attendance.</p>
            
            <h3>Step 2: Mark Each Student's Status</h3>
            <p>For each student, click one of the five status buttons. Clicking the same button again will deselect it (mark as "Not Marked").</p>
            
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
              <li><CheckCircle2 style={{ color: '#10b981', marginRight: '8px', verticalAlign: 'middle' }} /> <code>P</code> - <strong>Present:</strong> Student attended class.</li>
              <li><Clock style={{ color: '#f59e0b', marginRight: '8px', verticalAlign: 'middle' }} /> <code>L</code> - <strong>Late:</strong> Student arrived late.</li>
              <li><Church style={{ color: '#8b5cf6', marginRight: '8px', verticalAlign: 'middle' }} /> <code>UM</code> - <strong>Unattended Mass:</strong> Student attended class but missed Mass.</li>
              <li><AlertCircle style={{ color: '#3b82f6', marginRight: '8px', verticalAlign: 'middle' }} /> <code>E</code> - <strong>Excused:</strong> Student had an excused absence.</li>
              <li><XCircle style={{ color: '#ef4444', marginRight: '8px', verticalAlign: 'middle' }} /> <code>U</code> - <strong>Unexcused:</strong> Student had an unexcused absence.</li>
            </ul>
            <p>You can click the floating <HelpCircle /> button on the page to see this legend at any time.</p>

            <h3>Step 3: Save & Sync</h3>
            <p>Once you're done, click the large <strong>"Save & Sync"</strong> button. A confirmation box will appear. After confirming, your data will be saved to the database and synced with the Google Sheet.</p>
            
            <InfoBox type="info">
              <p style={{ margin: 0 }}>If you are an <strong>Admin</strong>, you will also see a dropdown menu to switch between different classes on this page.</p>
            </InfoBox>
          </Section>

          {/* Lesson Evaluation Section */}
          <Section id="evaluation" icon={Award} title="Lesson Evaluation (Daily Page)" {...commonProps}>
            <p>This page is for rating student performance for a specific lesson or chapter.</p>
            
            <h3>Step 1: Select the Chapter</h3>
            <p>Use the dropdown menu at the top to select which chapter number you are evaluating (e.g., "Chapter 1", "Chapter 2", etc.).</p>
            
            <h3>Step 2: Rate Each Category</h3>
            <p>For each student, provide a rating for the four categories. Click the rating (E, G, or I) for each category. Clicking the same rating again will deselect it.</p>
            
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
              <li><Award style={{ color: '#3b82f6', marginRight: '8px', verticalAlign: 'middle' }} /> <code>D</code> - <strong>Discipline:</strong> Student's adherence to rules and self-control.</li>
              <li><Heart style={{ color: '#10b981', marginRight: '8px', verticalAlign: 'middle' }} /> <code>B</code> - <strong>Behaviour:</strong> Student's conduct and attitude towards peers and teachers.</li>
              <li><BookOpen style={{ color: '#f59e0b', marginRight: '8px', verticalAlign: 'middle' }} /> <code>HW</code> - <strong>Homework:</strong> Completion and quality of homework.</li>
              <li><Zap style={{ color: '#8b5cf6', marginRight: '8px', verticalAlign: 'middle' }} /> <code>AP</code> - <strong>Active Participation:</strong> Student's engagement and involvement in class.</li>
            </ul>
            
            <h3>Step 3: Choose a Rating</h3>
            <p>The rating scale is:</p>
            <ul>
              <li><code>E</code> - <strong>Excellent</strong></li>
              <li><code>G</code> - <strong>Good</strong></li>
              <li><code>I</code> - <strong>Improving</strong></li>
            </ul>

            <h3>Step 4: Add Notes (Optional)</h3>
            <p>Use the "Teacher Notes" text box for any specific comments about the student's performance for that chapter. This is very helpful for parent-teacher meetings.</p>
            
            <h3>Step 5: Save & Sync</h3>
            <p>Click the <strong>"Save & Sync"</strong> button. This will save all ratings and notes for that chapter and sync them to the Google Sheet.</p>
          </Section>
          
          {/* Extended Dashboard Section */}
          <Section id="extended-dashboard" icon={BarChart3} title="The Extended Dashboard" {...commonProps}>
            <p>The Extended Dashboard gives you a complete overview of all your class data in one place. It's the best way to see the "big picture."</p>
            
            <h3>View Toggle: Attendance vs. Evaluation</h3>
            <p>At the top, you can switch between <strong>"Attendance"</strong> and <strong>"Evaluation"</strong> views. This changes all the modules on the page to show data for that topic.</p>
            
            <p>When in <strong>Evaluation</strong> view, you can also select a specific <strong>Chapter</strong> to focus on using the dropdown in the summary cards.</p>
            
            <h3>Main Tabs</h3>
            <p>The dashboard is organized into three tabs:</p>
            <ol>
              <li>
                <strong>Grid Tab:</strong>
                <p>This is a powerful spreadsheet-like grid showing all students and all weeks (for Attendance) or all categories (for Evaluations). You can:</p>
                <ul>
                  <li>Click <strong>"Edit Mode"</strong> to make changes.</li>
                  <li>Click any cell to cycle through statuses (P, L, U...) or ratings (E, G, I...).</li>
                  <li>Click <strong>"Save"</strong> to save and sync all your changes at once.</li>
                  <li>Use the <strong>Search</strong> and <strong>Filter</strong> bars to find specific students.</li>
                </ul>
              </li>
              <li>
                <strong>Summary Tab:</strong>
                <p>This tab shows a high-level summary. You can see:</p>
                <ul>
                  <li>Top 3 Performers</li>
                  <li>Students Needing Attention</li>
                  <li>A full list of all students and their overall scores/attendance rates.</li>
                  <li><strong>Click on any student's name</strong> in this table to open a detailed <strong>Student Profile Popup</strong> with all their individual stats.</li>
                </ul>
              </li>
              <li>
                <strong>Analytics Tab:</strong>
                <p>This tab shows charts and graphs of your class data, such as:</p>
                <ul>
                  <li>Weekly attendance trends over time.</li>
                  <li>Distribution of statuses (how many 'Present' vs. 'Late' vs. 'Absent').</li>
                  <li>Performance Tiers (how many students are 'Excellent', 'Good', etc.).</li>
                </ul>
              </li>
            </ol>
            
            <h3>Export to CSV</h3>
            <p>Use the <strong>"Export"</strong> button in the header to download a CSV file of the summary data you are currently viewing (either Attendance or Evaluation summary).</p>
          </Section>

          {/* Lesson Plan Viewer Section */}
          <Section id="lesson-plans" icon={FolderOpen} title="Viewing Lesson Plans" {...commonProps}>
            <p>This page is your central hub for all teaching materials. It allows you to access lesson plans and other important documents.</p>
            
            <h3>Navigating Folders</h3>
            <p>You will see a list of folders:</p>
            <ul>
              <li><strong>General Resources:</strong> Contains files for all teachers (e.g., calendars, general guides).</li>
              <li><strong>[Your Class Name]:</strong> A folder specifically for your class's lesson plans.</li>
            </ul>
            <p>Click on any folder to expand it and see the files inside. The number on the right shows how many files are in that folder.</p>
            
            <h3>File Actions</h3>
            <p>For each file, you have several options:</p>
            <ul>
              <li><strong>Open:</strong> Opens the PDF file in a new browser tab.</li>
              <li><strong>Download:</strong> Saves the file to your computer or device.</li>
              <li><strong>Delete:</strong> (If you have permission) Removes the file permanently.</li>
            </ul>
            
            <h3>Uploading a New File</h3>
            <ol>
              <li>Click the <strong>"Upload New File"</strong> button.</li>
              <li>In the modal, <strong>select the Class Folder</strong> you want to upload to (e.g., "General Resources" or your specific class).</li>
              <li>Click <strong>"Select PDF File"</strong> and choose the file from your computer (must be a PDF, max 10MB).</li>
              <li>Type in a descriptive <strong>File Name</strong> (e.g., "Week 1 - The Apostles' Creed").</li>
              <li>Click <strong>"Upload File"</strong>.</li>
            </ol>
          </Section>

          {/* Understanding Sync Section */}
          <Section id="sync" icon={Cloud} title="Understanding 'Save & Sync'" {...commonProps}>
            <p>The <strong>"Save & Sync"</strong> button performs a critical two-step process. When you click it, a modal will appear showing you the progress:</p>
            
            <div style={{ display: 'flex', gap: '16px', margin: '16px 0', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
              <div style={{ flex: 1, backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Database style={{ color: '#667eea' }} /> <strong>1. Saving to Database...</strong>
                </p>
                <p style={{ fontSize: '15px', marginTop: '8px' }}>Your data is first saved to our secure central database. This is the primary record. You'll see a <Loader style={{ display: 'inline', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> icon.</p>
              </div>
              <div style={{ flex: 1, backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Cloud style={{ color: '#3b82f6' }} /> <strong>2. Syncing to Google Sheets...</strong>
                </p>
                <p style={{ fontSize: '15px', marginTop: '8px' }}>After saving, the system sends the data to the Google Sheet. You'll see a <Cloud /> icon.</p>
              </div>
            </div>
            
            <p>When finished, you'll see a <CheckCircle2 style={{ color: '#10b981', display: 'inline' }} /> <strong>"All Done!"</strong> message. The modal will close automatically.</p>
            
            <InfoBox type="danger">
              <strong>Do Not Close The Page!</strong>
              <p style={{ margin: '4px 0 0 0' }}>While the "Saving" or "Syncing" modal is active, please <strong>do not close your browser tab or navigate away</strong>. This can interrupt the process and your data might not sync correctly.</p>
            </InfoBox>
            
            <h3>What if Sync Fails?</h3>
            <p>Sometimes, the Google Sheets sync might fail (e.g., if your Google login expired). If this happens, you will see a <strong>"Sync Failed"</strong> modal.</p>
            <p><strong>Don't worry! Your data is still safe.</strong> It was saved to the database in Step 1.</p>
            <p>The modal will recommend an action:</p>
            <ol>
              <li>Click the <strong>"Logout & Retry"</strong> button.</li>
              <li>Log back into the website (this will refresh your Google authentication).</li>
              <li>Go back to the page and try saving again. It should sync successfully.</li>
            </ol>
          </Section>

          {/* FAQ and Troubleshooting Section */}
          <Section id="faq" icon={Users} title="FAQ & Troubleshooting" {...commonProps}>
            <h3>Q: My buttons are disabled and I can't do anything.</h3>
            <p><strong>A:</strong> Your account is pending approval by an administrator. Please contact them to be assigned to your class.</p>
            
            <h3>Q: I made a mistake. How do I fix it?</h3>
            <p><strong>A:</strong> You can fix mistakes at any time.</p>
            <ul>
              <li><strong>For Daily Pages (Attendance/Evaluation):</strong> Just go back to that date or chapter, change the status/rating, and click "Save & Sync" again. The new data will overwrite the old data.</li>
              <li><strong>For the Extended Dashboard Grid:</strong> Click "Edit Mode", make your changes, and click "Save".</li>
            </ul>
            
            <h3>Q: A student is missing from my class list.</h3>
            <p><strong>A:</strong> Please contact an administrator. They are the only ones who can add or remove students from class rosters.</p>
            
            <h3>Q: I forgot to take attendance on Sunday.</h3>
            <p><strong>A:</strong> No problem. On the "Take Attendance" page, just select the past Sunday from the date picker, fill in the data, and click "Save & Sync".</p>

            <h3>Q: The website seems slow or isn't loading.</h3>
            <p><strong>A:</strong> Try refreshing the page. If that doesn't work, try logging out and logging back in. This often clears up any temporary issues.</p>
          </Section>
        </div>

        {/* Contact Support Section */}
        <div style={{
          backgroundColor: '#6d28d9',
          borderRadius: '16px',
          padding: '32px 40px',
          marginTop: '40px',
          color: 'white',
          textAlign: 'center'
        }}>
          <Shield style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.8 }} />
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 12px 0' }}>
            Still Need Help?
          </h2>
          <p style={{ fontSize: '16px', margin: '0 0 20px 0', opacity: 0.9 }}>
            If you're experiencing issues not covered in this guide, please contact your system administrator for assistance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;