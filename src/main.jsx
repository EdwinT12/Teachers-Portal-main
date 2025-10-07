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
import githubLogo from "/github.svg";

// Auth pages
import GoogleAuthLanding from "./pages/auth/GoogleAuthLanding.jsx";

// Dashboard pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AttendancePage from "./pages/teacher/AttendancePage.jsx";
import EvaluationPage from "./pages/teacher/EvaluationPage.jsx";
import EvaluationDiagnostic from "./components/EvaluationDiagnostic.jsx";

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
              
              {/* Protected routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <App />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              
              <Route path="/teacher" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <TeacherDashboard />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              
              <Route path="/teacher/attendance/:classId?" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <AttendancePage />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              // Add this route inside your Routes component:
              <Route path="/teacher/evaluation/:classId?" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <EvaluationPage />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />

              // Add this route:
<Route path="/admin/diagnostic" element={
  <ProtectedRoute>
    <RoleBasedRoute>
      <EvaluationDiagnostic />
    </RoleBasedRoute>
  </ProtectedRoute>
} />
              
              <Route path="/admin" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <AdminDashboard />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </AuthProvider>

        <Toaster />
      </StrictMode>
    </div>
  </div>
);
