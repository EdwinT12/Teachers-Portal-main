import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";

import "./index.css";
import App from "./App.jsx";
import AppBar from "./containers/AppBar"; 
import AuthProvider from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleBasedRoute from "./components/RoleBasedRoute.jsx"; 

// Home page
import HomePage from "./pages/HomePage.jsx";

// Auth pages
import GoogleAuthLanding from "./pages/auth/GoogleAuthLanding.jsx";
import ParentAuthLanding from "./pages/auth/ParentAuthLanding.jsx";
import ParentSignUp from "./pages/auth/ParentSignUp.jsx";
import ParentPasswordReset from "./pages/auth/ParentPasswordReset.jsx";

// Dashboard pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import ParentDashboard from "./pages/parent/ParentDashboard.jsx";
import AttendancePage from "./pages/teacher/AttendancePage.jsx";
import EvaluationPage from "./pages/teacher/EvaluationPage.jsx";
import EvaluationDiagnostic from "./components/EvaluationDiagnostic.jsx";
import ExtendedTeacherDashboard from "./pages/teacher/ExtendedTeacherDashboard.jsx";
import HelpPage from "./pages/teacher/HelpPage.jsx";

// Catechism pages
import CatechismLessonTracker from "./pages/admin/CatechismLessonTracker.jsx";

// Lesson Plan Viewer
import LessonPlanViewer from "./components/LessonPlanViewer.jsx";

createRoot(document.getElementById("root")).render(
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      margin: "1rem",
    }}
  >
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StrictMode>
        <AuthProvider>
          <BrowserRouter>
            <AppBar />
            <Routes>
              {/* Public route - Home/Landing page */}
              <Route path="/" element={<HomePage />} />
              
              {/* Public route - Teacher Google OAuth landing page */}
              <Route path="/auth" element={<GoogleAuthLanding />} />
              
              {/* Public route - Parent OAuth landing page */}
              <Route path="/parent/auth" element={<ParentAuthLanding />} />
              
              {/* Public route - Parent password reset */}
              <Route path="/parent/reset-password" element={<ParentPasswordReset />} />
              
              {/* Protected route - Parent signup/registration */}
              <Route path="/parent/signup" element={
                <ProtectedRoute>
                  <ParentSignUp />
                </ProtectedRoute>
              } />
              
              {/* Protected routes - Main App (now for authenticated users) */}
              <Route path="/app" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <App />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              
              {/* Teacher Dashboard */}
              <Route path="/teacher" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <TeacherDashboard />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              
              {/* Attendance Page */}
              <Route path="/teacher/attendance/:classId?" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <AttendancePage />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              {/* Evaluation Page */}
              <Route path="/teacher/evaluation/:classId?" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <EvaluationPage />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              {/* Extended Teacher Dashboard */}
              <Route path="/teacher/extended-dashboard" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <ExtendedTeacherDashboard />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              {/* Help Page */}
              <Route path="/teacher/help" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <HelpPage />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              {/* Lesson Plans - Standalone Page */}
              <Route path="/teacher/lesson-plans" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <LessonPlanViewer />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              {/* Evaluation Diagnostic */}
              <Route path="/admin/diagnostic" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <EvaluationDiagnostic />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              
              {/* Admin Dashboard */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <AdminDashboard />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              {/* Catechism Lesson Tracker - Standalone Route (Optional) */}
              <Route path="/admin/catechism" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <CatechismLessonTracker />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              {/* Parent Dashboard */}
              <Route path="/parent" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <ParentDashboard />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </AuthProvider>

        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
              fontWeight: '600',
              borderRadius: '10px',
              padding: '16px',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </StrictMode>
    </div>
  </div>
);