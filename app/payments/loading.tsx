export default function PaymentsLoading() {
  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ width: '200px', height: '32px', background: '#e2e8f0', borderRadius: '8px', marginBottom: '8px' }} />
        <div style={{ width: '280px', height: '14px', background: '#f1f5f9', borderRadius: '6px' }} />
      </div>
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ width: '140px', height: '16px', background: '#e2e8f0', borderRadius: '6px' }} />
        </div>
        {[1,2,3,4,5,6,7,8].map(i => (
          <div key={i} style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{ width: '160px', height: '12px', background: '#f1f5f9', borderRadius: '4px' }} />
            <div style={{ width: '80px', height: '12px', background: '#f1f5f9', borderRadius: '4px' }} />
            <div style={{ width: '60px', height: '20px', background: '#f1f5f9', borderRadius: '20px' }} />
            <div style={{ width: '100px', height: '12px', background: '#f1f5f9', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  )
}