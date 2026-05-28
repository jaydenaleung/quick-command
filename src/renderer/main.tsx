import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'
import { CommandBar } from '../components/CommandBar'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <CommandBar />
  </React.StrictMode>
)
