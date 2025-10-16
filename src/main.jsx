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

// Auth pages
import GoogleAuthLanding from "./pages/auth/GoogleAuthLanding.jsx";

// Dashboard pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AttendancePage from "./pages/teacher/AttendancePage.jsx";
import EvaluationPage from "./pages/teacher/EvaluationPage.jsx";
import EvaluationDiagnostic from "./components/EvaluationDiagnostic.jsx";

// Catechism pages
import CatechismLessonTracker from "./pages/admin/CatechismLessonTracker.jsx";

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
              {/* Public route - Google OAuth landing page */}
              <Route path="/auth" element={<GoogleAuthLanding />} />
              
              {/* Protected routes - Main App */}
              <Route path="/" element={
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