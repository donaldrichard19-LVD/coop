import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Drawer from './Drawer'
import Header from './Header'

export default function Shell({ title, bordered, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()

  function handleNewConversation() {
    setDrawerOpen(false)
    navigate('/')
  }

  return (
    <div className="h-svh flex bg-bg-primary">
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onNewConversation={handleNewConversation} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} bordered={bordered} onMenuClick={() => setDrawerOpen(true)} />
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  )
}
