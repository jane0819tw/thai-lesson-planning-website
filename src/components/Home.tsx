import { Link } from 'react-router-dom'
import { CATEGORIES } from '../categories'

export default function Home() {
  return (
    <>
      <h1>所有課程</h1>
      <ul className="cats">
        {CATEGORIES.map(c => (
          <li key={c.key}>
            {c.to ? (
              <Link to={c.to} className="cat">
                <strong>{c.title}</strong>
                <small>{c.desc}</small>
              </Link>
            ) : (
              <div className="cat off" aria-disabled="true">
                <strong>{c.title}</strong>
                <small>{c.desc}</small>
                <em className="badge">即將推出</em>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
