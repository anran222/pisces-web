import { lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const ExperimentList = lazy(() => import('./pages/ExperimentList'))
const ExperimentDetail = lazy(() => import('./pages/ExperimentDetail'))
const CreateExperiment = lazy(() => import('./pages/CreateExperiment'))
const Analysis = lazy(() => import('./pages/Analysis'))
const VariantGenerator = lazy(() => import('./pages/VariantGenerator'))
const ApplicationSpaces = lazy(() => import('./pages/ApplicationSpaces'))

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/ai-center" replace />} />
          <Route path="ai-center" element={<Dashboard />} />
          <Route path="ai-design" element={<CreateExperiment />} />
          <Route path="experiments" element={<ExperimentList />} />
          <Route path="experiments/create" element={<Navigate to="/ai-design" replace />} />
          <Route path="experiments/:id" element={<ExperimentDetail />} />
          <Route path="experiments/:id/decision" element={<Analysis />} />
          <Route path="applications" element={<ApplicationSpaces />} />
          <Route path="analysis/:id" element={<Navigate to="/ai-center" replace />} />
          <Route path="variants-lab" element={<VariantGenerator />} />
          <Route path="dashboard" element={<Navigate to="/ai-center" replace />} />
          <Route path="variants" element={<Navigate to="/variants-lab" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
