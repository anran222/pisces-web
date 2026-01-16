import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ExperimentList from './pages/ExperimentList'
import ExperimentDetail from './pages/ExperimentDetail'
import CreateExperiment from './pages/CreateExperiment'
import Analysis from './pages/Analysis'
import VariantGenerator from './pages/VariantGenerator'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="experiments" element={<ExperimentList />} />
          <Route path="experiments/create" element={<CreateExperiment />} />
          <Route path="experiments/:id" element={<ExperimentDetail />} />
          <Route path="analysis/:id" element={<Analysis />} />
          <Route path="variants" element={<VariantGenerator />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
