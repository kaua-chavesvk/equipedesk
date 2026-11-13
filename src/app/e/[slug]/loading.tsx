import { Layers3, LoaderCircle } from 'lucide-react';

export default function Loading() {
  return <div className="app-shell loading-shell" aria-busy="true">
    <aside className="sidebar" aria-hidden="true"><span className="brand"><span className="brand-icon"><Layers3 size={24}/></span>equipe<span>desk</span></span><div className="skeleton skeleton-nav"/><div className="skeleton skeleton-nav"/><div className="skeleton skeleton-nav"/></aside>
    <div className="main-shell"><div className="topbar" aria-hidden="true"><span className="skeleton skeleton-breadcrumb"/></div>
      <main className="content" aria-label="Carregando espaço"><p className="eyebrow">EquipeDesk</p><h1>Carregando seu espaço…</h1><p className="loading-status" role="status"><LoaderCircle size={18} className="spin"/>Buscando seus chamados e permissões.</p>
        <div className="stats-grid" aria-hidden="true">{[1,2,3,4].map(n=><div key={n} className="stat-card skeleton skeleton-stat"/>)}</div>
        <div className="panel" aria-hidden="true">{[1,2,3].map(n=><div key={n} className="skeleton skeleton-row"/>)}</div>
      </main>
    </div>
  </div>;
}
