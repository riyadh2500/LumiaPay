'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ApplicationSidebar from '@/components/application-sidebar'
import { BarChart3, TrendingUp, AlertCircle, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AnalyticsData {
  totalPayments: number
  successfulPayments: number
  failedPayments: number
  totalVolume: number
  recentPayments: Array<{
    id: string
    amount: any
    status: string
    created_at: string
    transaction_hash?: string
  }>
}

interface Application {
  id: string
  name: string
}

interface Payment {
  id: string
  amount: any
  status: string
  created_at: string
  transaction_hash?: string
  application_id: string
}

export default function AnalyticsPage() {
  const params = useParams()
  const id = params.id as string
  const [application, setApplication] = useState<Application | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalPayments: 0,
    successfulPayments: 0,
    failedPayments: 0,
    totalVolume: 0,
    recentPayments: []
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const supabase = createClient()

  useEffect(() => {
    fetchAnalytics()
  }, [id, timeRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch application
      const { data: app } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      setApplication(app)

      // Calculate date range
      let dateFilter = new Date()
      if (timeRange === '7d') {
        dateFilter.setDate(dateFilter.getDate() - 7)
      } else if (timeRange === '30d') {
        dateFilter.setDate(dateFilter.getDate() - 30)
      } else if (timeRange === '90d') {
        dateFilter.setDate(dateFilter.getDate() - 90)
      } else {
        dateFilter = new Date(0) // All time
      }

      // Fetch all payments for this application
      let query = supabase
        .from('payments')
        .select('*')
        .eq('application_id', id)

      if (timeRange !== 'all') {
        query = query.gte('created_at', dateFilter.toISOString())
      }

      const { data: payments, error } = await query.order('created_at', { ascending: false }) as { data: Payment[] | null, error: any }

      if (error) throw error

      // Calculate analytics
      const total = payments?.length || 0
      const successful = payments?.filter(p => p.status === 'completed').length || 0
      const failed = payments?.filter(p => p.status === 'failed' || p.status === 'expired').length || 0
      const volume = payments?.reduce((sum, p) => {
        if (p.status === 'completed') {
          return sum + (Number(p.amount) || 0)
        }
        return sum
      }, 0) || 0

      setAnalytics({
        totalPayments: total,
        successfulPayments: successful,
        failedPayments: failed,
        totalVolume: volume,
        recentPayments: payments?.slice(0, 10) || []
      })
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'pending':
        return 'warning'
      case 'failed':
      case 'expired':
        return 'error'
      default:
        return 'default'
    }
  }

  const successRate = analytics.totalPayments > 0 
    ? ((analytics.successfulPayments / analytics.totalPayments) * 100).toFixed(1)
    : '0'

  if (loading) {
    return (
      <div className="app-layout">
        <ApplicationSidebar 
          applicationId={id} 
          applicationName="Loading..."
        />
        <main className="app-main">
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
            Loading...
          </div>
        </main>
      </div>
    )
  }

  if (!application) {
    return null
  }

  return (
    <div className="app-layout">
      <ApplicationSidebar 
        applicationId={application.id} 
        applicationName={application.name}
      />
      
      <main className="app-main">
        <div className="app-header">
          <span className="eyebrow">
            <BarChart3 size={13} /> Analytics
          </span>
          <h1 className="heading">Payment Analytics</h1>
          <p className="subheading">
            Payment statistics and transaction history
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--mint)',
                color: '#1d5c3a',
                display: 'grid',
                placeItems: 'center'
              }}>
                <BarChart3 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Total Payments
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>
                  {analytics.totalPayments}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#dcfce7',
                color: '#166534',
                display: 'grid',
                placeItems: 'center'
              }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Successful
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>
                  {analytics.successfulPayments}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {successRate}% success rate
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#fee2e2',
                color: '#991b1b',
                display: 'grid',
                placeItems: 'center'
              }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Failed
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626' }}>
                  {analytics.failedPayments}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--mint)',
                color: '#1d5c3a',
                display: 'grid',
                placeItems: 'center'
              }}>
                <DollarSign size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Total Volume
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>
                  {analytics.totalVolume.toFixed(4)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              LUMIA
            </div>
          </div>
        </div>

        {/* Recent Payments Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Recent Transactions</h2>
          </div>

          {analytics.recentPayments.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
              <BarChart3 size={48} strokeWidth={1} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p>No payments yet</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--paper)' }}>
                    <th style={{ 
                      padding: '12px 24px', 
                      textAlign: 'left', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: 'var(--muted)', 
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--line)'
                    }}>
                      Transaction ID
                    </th>
                    <th style={{ 
                      padding: '12px 24px', 
                      textAlign: 'left', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: 'var(--muted)', 
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--line)'
                    }}>
                      Amount
                    </th>
                    <th style={{ 
                      padding: '12px 24px', 
                      textAlign: 'left', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: 'var(--muted)', 
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--line)'
                    }}>
                      Status
                    </th>
                    <th style={{ 
                      padding: '12px 24px', 
                      textAlign: 'left', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: 'var(--muted)', 
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--line)'
                    }}>
                      Date
                    </th>
                    <th style={{ 
                      padding: '12px 24px', 
                      textAlign: 'left', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: 'var(--muted)', 
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--line)'
                    }}>
                      Blockchain
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentPayments.map((payment, index) => (
                    <tr key={payment.id} style={{ borderBottom: index < analytics.recentPayments.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <code style={{ fontSize: '12px', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                          {payment.id.slice(0, 8)}...{payment.id.slice(-8)}
                        </code>
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: '13px' }}>
                        {(Number(payment.amount) as number).toFixed(4)} LUMIA
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span className={`badge ${getStatusColor(payment.status)}`} style={{ textTransform: 'capitalize' }}>
                          {payment.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--muted)', fontSize: '13px' }}>
                        {new Date(payment.created_at).toLocaleDateString()} {new Date(payment.created_at).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {payment.transaction_hash ? (
                          <a
                            href={`https://testnet.lumiaexplorer.com/tx/${payment.transaction_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#667eea', fontSize: '13px', textDecoration: 'none' }}
                          >
                            View ↗
                          </a>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ height: '40px' }} />
      </main>
    </div>
  )
}
