import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import BingoApp from './components/BingoApp';

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <BingoApp />
    </>
  )
}

export default App
