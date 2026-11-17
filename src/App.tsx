import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Wizard from './pages/Wizard'
import Player from './pages/Player'
import Tune from './pages/Tune'
import MySets from './pages/MySets'
import Join from './pages/Join'
import EngineTest from './pages/EngineTest'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#07060b] text-[#f4f1ff]">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wizard" element={<Wizard />} />
          <Route path="/play" element={<Player />} />
          <Route path="/tune" element={<Tune />} />
          <Route path="/sets" element={<MySets />} />
          <Route path="/join/:roomId?" element={<Join />} />
          <Route path="/engine-test" element={<EngineTest />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
