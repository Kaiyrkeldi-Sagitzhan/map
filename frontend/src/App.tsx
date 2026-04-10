import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import MapEditor from './components/Editor/MapEditor'
import Layout from './components/Layout/Layout'
import Landing from './components/Landing/Landing'
import OAuthCallback from './components/Landing/OAuthCallback'
import MapViewer from './components/Viewer/MapViewer'
import SettingsPage from './components/Settings/SettingsPage'
import AdminLayout from './components/Admin/AdminLayout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, canEdit } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" />
  // If admin/expert tries to access /map, send them to /editor
  if (canEdit && window.location.pathname.startsWith('/map')) {
    return <Navigate to="/editor" />
  }
  return <>{children}</>
}

function EditorRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, canEdit } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" />
  if (!canEdit) return <Navigate to="/map" />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" />
  if (!isAdmin) return <Navigate to="/map" />
  return <>{children}</>
}

function App() {
  const location = useLocation()

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/google/callback" element={<OAuthCallback />} />

      {/* Editor — admin/expert only */}
      <Route
        path="/editor/*"
        element={
          <EditorRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<MapEditor />} />
                <Route path="*" element={<MapEditor />} />
              </Routes>
            </Layout>
          </EditorRoute>
        }
      />

      {/* Viewer — any authenticated user */}
      <Route
        path="/map/*"
        element={
          <PrivateRoute>
            <Layout>
              <MapViewer />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Settings — any authenticated user */}
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Admin dashboard — admin only */}
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      />
    </Routes>
  )
}

export default App
