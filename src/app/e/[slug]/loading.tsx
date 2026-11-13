import { Layers3 } from 'lucide-react';

export default function Loading() {
  return <div className="app-shell loading-shell" aria-busy="true">
    <aside className="sidebar" aria-hidden="true"><span className="brand"><span className="brand-icon"><Layers3 size={24}/></span>equipe<span>desk</span></span><div className="skeleton skeleton-nav"/><div className="skeleton skeleton-nav"/><div className="skeleton skeleton-nav"/></aside>
    <div className="main-shell"><div className="topbar" aria-hidden="true"><span className="skeleton skeleton-breadcrumb"/></div>
      <main className="content" aria-label="Carregando espaço"><p className="eyebrow">EquipeDesk</p><h1>Carregando seu espaço…</h1><p className="sr-only" role="status">Buscando seus chamados e permissões.</p><div className="skeleton skeleton-summary" aria-hidden="true"/>
        <div className="stats-grid" aria-hidden="true">{[1,2,3,4].map(n=><div key={n} className="stat-card skeleton skeleton-stat"/>)}</div>
        <div className="panel skeleton-queue" aria-hidden="true"><div className="skeleton skeleton-toolbar"/>{[1,2,3,4].map(n=><div key={n} className="skeleton-ticket"><span className="skeleton"/><span className="skeleton"/><span className="skeleton"/></div>)}</div>
      </main>
    </div>
  </div>;
}
