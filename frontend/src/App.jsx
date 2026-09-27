import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import TodayPlan from './pages/TodayPlan';
import Progress from './pages/Progress';
import DeadlinePileUp from './pages/DeadlinePileUp';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected App Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/deadline-pileup" element={<DeadlinePileUp />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tasks" element={<MyTasks />} />
              <Route path="/today" element={<TodayPlan />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="*" element={<Navigate to="/deadline-pileup" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
