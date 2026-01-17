import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import './App.css'
import './styles/mock-draft.css'
import PlayerStats from './components/PlayerStats'
import DraftSetup from './components/MockDraft/DraftSetup'
import DraftRoom from './components/MockDraft/DraftRoom'
import { DraftProvider } from './contexts/DraftContext'

function Navigation() {
  const location = useLocation();
  const isDraftRoom = location.pathname.includes('/mock-draft/draft-room');

  // Hide navigation in draft room for immersive experience
  if (isDraftRoom) {
    return null;
  }

  return (
    <nav className="app-navigation">
      <div className="nav-content">
        <h1 className="nav-logo">Fantasy Puck</h1>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}>
            Player Rankings
          </Link>
          <Link
            to="/mock-draft/setup"
            className={location.pathname.includes('/mock-draft') ? 'nav-link active' : 'nav-link'}
          >
            Mock Draft
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <DraftProvider>
        <div className="app-container">
          <Navigation />
          <Routes>
            <Route path="/" element={<PlayerStats />} />
            <Route path="/mock-draft/setup" element={<DraftSetup />} />
            <Route path="/mock-draft/draft-room" element={<DraftRoom />} />
          </Routes>
        </div>
      </DraftProvider>
    </Router>
  )
}

export default App
