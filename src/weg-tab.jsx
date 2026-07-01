import React from 'react'

// Aba WEG (provisória) — dados da planilha WEG - Setorial.xlsm
const EmptyWeg = () => (
  <main className="main" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,minHeight:'60vh',color:'var(--fg-dim)'}}>
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 21V9l6-3v3l6-3v3l6-3v15zM3 21h18"/>
    </svg>
    <div style={{fontSize:16,fontWeight:500,color:'var(--fg)'}}>Sem dados da WEG</div>
    <div style={{fontSize:13,textAlign:'center',maxWidth:320}}>Atualize a planilha WEG - Setorial.xlsm para visualizar os gráficos.</div>
  </main>
);

const WegTab = ({ data, accent }) => {
  if (!data.weg_transformadores || !data.weg_transformadores.length) return <EmptyWeg />;

  return (
    <main className="main">
      <window.ContinuousCard
        cardId="card-weg-transformadores"
        title="Preço Transformadores"
        sub="PPI · Electric Power and Specialty Transformer Manufacturing"
        accent={accent} data={data} dataset="weg_transformadores"
        field="value" unit="Base 100" decimals={2}
      />
    </main>
  );
};

window.WegTab = WegTab;
