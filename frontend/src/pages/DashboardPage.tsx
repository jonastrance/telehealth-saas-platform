import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import type { Appointment, HealthMetric } from '../types';

export const DashboardPage = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [appointmentsRes, metricsRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/health-metrics'),
      ]);

      setAppointments(appointmentsRes.data.data || []);
      setHealthMetrics(metricsRes.data.data?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleJoinCall = (roomId: string) => {
    navigate(`/video/${roomId}`);
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const upcomingAppointments = appointments
    .filter((a) => a.status === 'scheduled' || a.status === 'in_progress')
    .slice(0, 5);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🏥 Telehealth Dashboard</h1>
        <div style={styles.userInfo}>
          <span style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </span>
          <span style={styles.userRole}>{user?.role}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      <div style={styles.content}>
        <div style={styles.grid}>
          {/* Appointments Section */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📅 Upcoming Appointments</h2>
            {upcomingAppointments.length === 0 ? (
              <p style={styles.emptyState}>No upcoming appointments</p>
            ) : (
              <div style={styles.list}>
                {upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} style={styles.listItem}>
                    <div>
                      <div style={styles.itemTitle}>
                        {user?.role === 'patient'
                          ? `Dr. ${appointment.provider_first_name} ${appointment.provider_last_name}`
                          : `${appointment.patient_first_name} ${appointment.patient_last_name}`}
                      </div>
                      <div style={styles.itemSubtitle}>
                        {new Date(appointment.scheduled_at).toLocaleString()}
                      </div>
                      <div style={styles.itemStatus}>{appointment.status}</div>
                    </div>
                    {appointment.status === 'in_progress' && (
                      <button
                        onClick={() => handleJoinCall(appointment.video_room_id)}
                        style={styles.joinButton}
                      >
                        Join Call
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Health Metrics Section */}
          {user?.role === 'patient' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>📊 Recent Health Metrics</h2>
              {healthMetrics.length === 0 ? (
                <p style={styles.emptyState}>No health metrics recorded</p>
              ) : (
                <div style={styles.list}>
                  {healthMetrics.map((metric) => (
                    <div key={metric.id} style={styles.listItem}>
                      <div>
                        <div style={styles.itemTitle}>
                          {metric.metric_type.replace('_', ' ').toUpperCase()}
                        </div>
                        <div style={styles.itemSubtitle}>
                          {metric.value} {metric.unit}
                        </div>
                        <div style={styles.itemDate}>
                          {new Date(metric.recorded_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Stats */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{appointments.length}</div>
              <div style={styles.statLabel}>Total Appointments</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{upcomingAppointments.length}</div>
              <div style={styles.statLabel}>Upcoming</div>
            </div>
            {user?.role === 'patient' && (
              <div style={styles.statCard}>
                <div style={styles.statValue}>{healthMetrics.length}</div>
                <div style={styles.statLabel}>Health Records</div>
              </div>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div style={styles.infoBanner}>
          <h3 style={styles.infoBannerTitle}>🔒 HIPAA Compliance</h3>
          <p style={styles.infoBannerText}>
            All data is encrypted end-to-end and complies with HIPAA regulations.
            Your privacy and security are our top priorities.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    fontSize: '20px',
    color: '#666',
  },
  header: {
    backgroundColor: 'white',
    padding: '20px 40px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  userName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
  },
  userRole: {
    fontSize: '14px',
    color: '#666',
    backgroundColor: '#e3f2fd',
    padding: '4px 12px',
    borderRadius: '12px',
  },
  logoutButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  content: {
    padding: '40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginBottom: '24px',
  },
  card: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#333',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  listItem: {
    padding: '16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '4px',
  },
  itemSubtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '4px',
  },
  itemStatus: {
    fontSize: '12px',
    color: '#2196f3',
    textTransform: 'uppercase',
  },
  itemDate: {
    fontSize: '12px',
    color: '#999',
  },
  emptyState: {
    fontSize: '14px',
    color: '#999',
    textAlign: 'center',
    padding: '32px',
  },
  joinButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    gridColumn: '1 / -1',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#2196f3',
    marginBottom: '8px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#666',
  },
  infoBanner: {
    backgroundColor: '#e8f5e9',
    padding: '24px',
    borderRadius: '12px',
    border: '2px solid #4caf50',
  },
  infoBannerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: '8px',
  },
  infoBannerText: {
    fontSize: '14px',
    color: '#1b5e20',
    lineHeight: '1.6',
    margin: 0,
  },
};
