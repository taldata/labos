import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import './AppLayout.css'

function AppLayout({ children, user, setUser }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Remember sidebar state
    const saved = localStorage.getItem('sidebarOpen')
    return saved ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen))
  }, [sidebarOpen])

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <Sidebar 
        user={user} 
        setUser={setUser} 
        isOpen={sidebarOpen} 
        onToggle={toggleSidebar} 
      />
      
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={toggleSidebar}>
          <i className="fas fa-bars"></i>
        </button>
        <img
          src="/static/images/labos-logo.svg"
          alt="Labos"
          className="mobile-logo"
        />
        <div className="mobile-user">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
      </header>
      
      <main className="app-main">
        {children}
      </main>
    </div>
  )
}

export default AppLayout
