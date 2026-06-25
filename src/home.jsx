import React from 'react'
import { useNavigate } from 'react-router-dom'

const SECTORS = [
  {
    route: '/proteinas',
    label: 'Proteínas',
    description: 'Beef BR · Beef US · Poultry BR · Poultry US · Macro',
    accent: 'oklch(0.82 0.18 155)',
    active: true,
  },
  {
    route: '/car-rental',
    label: 'Car Rental',
    description: 'Locação de veículos',
    accent: 'oklch(0.72 0.16 250)',
    active: false,
  },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-eyebrow">XP Asset Management</div>
        <h1 className="home-title">Dashboard Setorial</h1>
        <p className="home-sub">Escolha um setor para acessar a dashboard</p>
      </header>

      <div className="home-grid">
        {SECTORS.map(s => (
          <button
            key={s.route}
            className={`home-card${s.active ? ' is-active' : ' is-soon'}`}
            style={{ '--card-accent': s.accent }}
            onClick={() => s.active && navigate(s.route)}
            disabled={!s.active}
          >
            <div className="home-card-stripe" />
            <div className="home-card-body">
              <div className="home-card-label">{s.label}</div>
              <div className="home-card-desc">{s.description}</div>
              {!s.active && <span className="home-card-badge">Em breve</span>}
            </div>
            {s.active && <span className="home-card-arrow">→</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
