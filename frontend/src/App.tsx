import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import MapEditor from './components/Editor/MapEditor'
import Layout from './components/Layout/Layout'
import Landing from './components/Landing/Landing'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/" />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/editor/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<MapEditor />} />
                <Route path="*" element={<MapEditor />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

export default App
