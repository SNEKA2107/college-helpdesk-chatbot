import { useEffect, useState } from 'react';

// Animated circular progress ring (dependency-free SVG).
export function RingGauge({ value = 0, size = 140, stroke = 12, color = 'var(--primary)', label, sublabel }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 80);   // animate from 0 → value on mount
    return () => clearTimeout(t);
  }, [value]);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, shown)) / 100) * circ;
  return (
    <div className="ring-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-value">{Math.round(shown)}{label === '%' ? '%' : ''}</div>
        {sublabel && <div className="ring-sub">{sublabel}</div>}
      </div>
    </div>
  );
}

// Line/area chart for trends. data: [{label, value}].
export function LineChart({ data = [], height = 160, color = 'var(--primary)', yMax, unit = '' }) {
  if (!data.length) return <div className="chart-empty">No data yet</div>;
  const w = 100, h = 100, pad = 8;
  const max = yMax ?? Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const span = max - min || 1;
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, data.length - 1);
  const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${pad},${h - pad} ${pts} ${x(data.length - 1)},${h - pad}`;
  return (
    <div className="line-chart" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#lcfill)" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="1.6" fill={color} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="chart-xaxis">
        {data.map((d, i) => <span key={i}>{d.label}</span>)}
      </div>
    </div>
  );
}

// Horizontal bar list. data: [{label, value}].
export function BarList({ data = [], color = 'var(--primary)', unit = '' }) {
  if (!data.length) return <div className="chart-empty">No data yet</div>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bar-list">
      {data.map((d, i) => (
        <div key={i} className="bar-row">
          <span className="bar-label" title={d.label}>{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <span className="bar-value">{d.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}
