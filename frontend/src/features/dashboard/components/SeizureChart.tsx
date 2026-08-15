import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { ManualSeizureLog } from '../../../api/seizures';

/* ────────────────────────────────────────────────────
   Seizure Frequency Chart — 7-day histogram
   ──────────────────────────────────────────────────── */

interface SeizureChartProps {
  logs?: ManualSeizureLog[];
}

export function SeizureChart({ logs = [] }: SeizureChartProps) {
  const chartData = useMemo(() => {
    const days: { label: string; date: string; count: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dateStr,
        count: 0,
      });
    }

    if (Array.isArray(logs)) {
      for (const log of logs) {
        if (!log || !log.occurred_at) continue;
        const logDate = String(log.occurred_at).split('T')[0];
        const match = days.find(d => d.date === logDate);
        if (match) match.count++;
      }
    }

    return days;
  }, [logs]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);
  const hasData = chartData.some(d => d.count > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="bento-header">
        <h3>Seizure Activity</h3>
        <span className="glass-badge">Last 7 days</span>
      </div>

      {!hasData ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          color: 'var(--color-text-muted)',
          minHeight: '120px',
        }}>
          <BarChart3 size={32} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 'var(--text-sm)', margin: 0, textAlign: 'center' }}>
            No seizures logged this week.<br />
            <span style={{ color: 'var(--color-success)' }}>That's great news!</span>
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 120, width: '100%' }}>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} barSize={24}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                width={20}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-hover)', radius: 6 }}
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  fontSize: 'var(--text-sm)',
                }}
                labelStyle={{ color: 'var(--color-text-main)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--color-text-muted)' }}
                formatter={(value: any) => [`${value ?? 0} seizure${value !== 1 ? 's' : ''}`, '']}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.count === 0
                        ? 'var(--color-border)'
                        : entry.count >= maxCount * 0.7
                          ? 'var(--color-risk-high)'
                          : entry.count >= maxCount * 0.4
                            ? 'var(--color-risk-medium)'
                            : 'var(--color-primary)'
                    }
                    opacity={entry.count === 0 ? 0.3 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
