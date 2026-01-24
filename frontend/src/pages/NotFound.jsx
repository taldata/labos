import { Link } from 'react-router-dom'
import './NotFound.css'

function NotFound() {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="not-found-icon">404</div>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/dashboard" className="not-found-button">
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default NotFound
