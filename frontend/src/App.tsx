import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'

const MapEditor = lazy(() => import('./components/Editor/MapEditor'))
const Landing = lazy(() => import('./components/Landing/Landing'))
const OAuthCallback = lazy(() => import('./components/Landing/OAuthCallback'))
const MapViewer = lazy(() => import('./components/Viewer/MapViewer'))
const SettingsPage = lazy(() => import('./components/Settings/SettingsPage'))
const AdminLayout = lazy(() => import('./components/Admin/AdminLayout'))

const RouteLoader = () => (
  <div className="h-full w-full flex items-center justify-center bg-[#010814] text-slate-300 text-sm">Загрузка...</div>
)

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
    <Suspense fallback={<RouteLoader />}>
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
    </Suspense>
  )
}

export default App
