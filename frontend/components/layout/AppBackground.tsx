export default function AppBackground() {
  return (
    <div className="app-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="app-bg-orb app-bg-orb-1" />
      <div className="app-bg-orb app-bg-orb-2" />
      <div className="app-bg-grid" />
    </div>
  )
}
