export default function MenuLoading() {
  return (
    <div style={{ minHeight: '100vh', background: '#FBF3E9', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .sk {
          background: linear-gradient(90deg, #ede8e2 25%, #f7f2ec 50%, #ede8e2 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: 10px;
        }
      `}} />

      {/* Hero skeleton */}
      <div className="sk" style={{ width: '100%', height: 220 }} />

      {/* Category pills skeleton */}
      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 8, overflowX: 'hidden' }}>
        {[80, 100, 70, 90, 60].map((w, i) => (
          <div key={i} className="sk" style={{ width: w, height: 34, flexShrink: 0, borderRadius: 999 }} />
        ))}
      </div>

      {/* Product cards skeleton */}
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            background: '#fff',
            borderRadius: 18,
            padding: '14px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 2px 12px -8px rgba(0,0,0,.15)',
          }}>
            <div className="sk" style={{ width: 76, height: 76, borderRadius: 13, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="sk" style={{ width: '65%', height: 14 }} />
              <div className="sk" style={{ width: '90%', height: 11 }} />
              <div className="sk" style={{ width: '40%', height: 14 }} />
            </div>
            <div className="sk" style={{ width: 36, height: 36, borderRadius: 999, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
