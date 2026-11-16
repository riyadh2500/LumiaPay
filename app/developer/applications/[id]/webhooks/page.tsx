'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ApplicationSidebar from '@/components/application-sidebar'
import { Webhook, Plus, Power, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface WebhookType {
  id: string
  url: string
  events: string[]
  is_active: boolean
  created_at: string
  last_triggered_at: string | null
}

interface Application {
  id: string
  name: string
}

export default function WebhooksPage() {
  const params = useParams()
  const id = params.id as string
  const [application, setApplication] = useState<Application | null>(null)
  const [webhooks, setWebhooks] = useState<WebhookType[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    events: [] as string[]
  })
  const supabase = createClient()

  const availableEvents = [
    'payment.created',
    'payment.succeeded',
    'payment.failed',
    'payment.expired',
    'refund.created',
    'refund.succeeded'
  ]

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
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

      // Fetch webhooks
      const { data: hooks } = await supabase
        .from('webhooks')
        .select('*')
        .eq('application_id', id)
        .order('created_at', { ascending: false })

      setWebhooks(hooks || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (newWebhook.events.length === 0) {
        alert('Please select at least one event')
        return
      }

      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          application_id: id,
          url: newWebhook.url,
          events: newWebhook.events,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      setWebhooks([data, ...webhooks])
      setNewWebhook({ url: '', events: [] })
      setShowCreateForm(false)
    } catch (error: any) {
      console.error('Error creating webhook:', error)
      alert('Failed to create webhook: ' + error.message)
    }
  }

  const toggleWebhookStatus = async (webhookId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('webhooks')
        .update({ is_active: !currentStatus })
        .eq('id', webhookId)

      if (error) throw error

      setWebhooks(webhooks.map(w => 
        w.id === webhookId ? { ...w, is_active: !currentStatus } : w
      ))
    } catch (error) {
      console.error('Error toggling webhook:', error)
    }
  }

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return

    try {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId)

      if (error) throw error

      setWebhooks(webhooks.filter(w => w.id !== webhookId))
    } catch (error) {
      console.error('Error deleting webhook:', error)
    }
  }

  const toggleEvent = (event: string) => {
    if (newWebhook.events.includes(event)) {
      setNewWebhook({
        ...newWebhook,
        events: newWebhook.events.filter(e => e !== event)
      })
    } else {
      setNewWebhook({
        ...newWebhook,
        events: [...newWebhook.events, event]
      })
    }
  }

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
            <Webhook size={13} /> Webhooks
          </span>
          <h1 className="heading">Manage Webhooks</h1>
          <p className="subheading">
            Receive real-time notifications about payment events
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="button primary"
          >
            {showCreateForm ? 'Cancel' : <><Plus size={16} /> Add Webhook</>}
          </button>
        </div>

        {showCreateForm && (
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Create New Webhook</h3>
            <form onSubmit={handleCreateWebhook}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder="https://your-domain.com/webhooks/lumia"
                  required
                  className="input"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
                  Events to Listen
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {availableEvents.map(event => (
                    <label
                      key={event}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        border: '1px solid var(--line)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: newWebhook.events.includes(event) ? 'var(--paper)' : 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '13px', fontFamily: 'DM Mono' }}>{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="button primary">
                Create Webhook
              </button>
            </form>
          </div>
        )}

        {webhooks.length === 0 ? (
          <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'var(--mint)',
              color: '#1d5c3a',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 20px'
            }}>
              <Webhook size={32} strokeWidth={1.5} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              No webhooks yet
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '400px', margin: '0 auto 20px' }}>
              Create your first webhook to receive real-time payment notifications
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="button primary"
            >
              <Plus size={16} /> Add Your First Webhook
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {webhooks.map(webhook => (
              <div key={webhook.id} className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <code style={{
                        fontSize: '13px',
                        fontFamily: 'DM Mono',
                        background: 'var(--paper)',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        {webhook.url}
                      </code>
                      <span className={`badge ${webhook.is_active ? 'success' : 'error'}`}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {webhook.events.map(event => (
                        <span
                          key={event}
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            background: 'var(--paper)',
                            color: 'var(--muted)',
                            borderRadius: '4px',
                            fontFamily: 'DM Mono'
                          }}
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Created {new Date(webhook.created_at).toLocaleDateString()}
                      {webhook.last_triggered_at && (
                        <> • Last triggered {new Date(webhook.last_triggered_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => toggleWebhookStatus(webhook.id, webhook.is_active)}
                      className={`button ${webhook.is_active ? 'secondary' : 'primary'}`}
                      style={{ fontSize: '13px', padding: '8px 12px' }}
                    >
                      <Power size={13} /> {webhook.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="button secondary"
                      style={{ fontSize: '13px', padding: '8px 12px', color: '#dc2626' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: '40px' }} />
      </main>
    </div>
  )
}
