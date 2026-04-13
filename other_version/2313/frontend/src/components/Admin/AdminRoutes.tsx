import { Routes, Route } from 'react-router-dom'
import DashboardPage from './DashboardPage'
import UsersPage from './UsersPage'
import ComplaintsPage from './ComplaintsPage'

const AdminRoutes = () => {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="complaints" element={<ComplaintsPage />} />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  )
}

export default AdminRoutes
