import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ExperimentList from './pages/ExperimentList'
import ExperimentDetail from './pages/ExperimentDetail'
import CreateExperiment from './pages/CreateExperiment'
import Analysis from './pages/Analysis'
import VariantGenerator from './pages/VariantGenerator'
import ApplicationSpaces from './pages/ApplicationSpaces'

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
