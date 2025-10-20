import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import PlayerStats from './components/PlayerStats'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="card">
        <PlayerStats/>
      </div>

    </>
  )
}

export default App
