export default function DeveloperLoading() {
  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ width: '200px', height: '32px', background: '#e2e8f0', borderRadius: '8px', marginBottom: '8px' }} />
        <div style={{ width: '280px', height: '14px', background: '#f1f5f9', borderRadius: '6px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ width: '120px', height: '16px', background: '#e2e8f0', borderRadius: '6px', marginBottom: '12px' }} />
            <div style={{ width: '180px', height: '12px', background: '#f1f5f9', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  )
}