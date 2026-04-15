/**
 * AdminLoyaltyTabs.jsx — Admin Panel Tabs for Loyalty Engine
 * 
 * Pestañas para que el admin integre en su panel existente:
 * 1. Dashboard de Puntos (resumen global)
 * 2. Gestión de Conductores (wallets, tiers, ajustes)
 * 3. Canjes Pendientes (fulfillment de recompensas)
 * 4. Anti-Fraude (alertas y auditoría)
 * 5. Reportes (evaluaciones mensuales)
 */

import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import {
  collection, query, where, orderBy, limit, onSnapshot, getDocs, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  BarChart3, Users, Gift, ShieldAlert, FileText,
  Search, ChevronDown, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, Coins, Eye,
} from 'lucide-react';

// ─── TIER CONFIG ───
const TIERS = {
  bronce: { label: 'Bronce', icon: '🥉', color: '#CD7F32' },
  plata: { label: 'Plata', icon: '🥈', color: '#C0C0C0' },
  oro: { label: 'Oro', icon: '🥇', color: '#FFD700' },
  diamante: { label: 'Diamante', icon: '💎', color: '#00CED1' },
};

// ═══════════════════════════════════════════
// TAB 1: DASHBOARD
// ═══════════════════════════════════════════
function DashboardTab() {
  const [stats, setStats] = useState({ totalDrivers: 0, totalPointsIssued: 0, totalRedeemed: 0, pendingRedemptions: 0 });
  const [tierDistribution, setTierDistribution] = useState({ bronce: 0, plata: 0, oro: 0, diamante: 0 });

  useEffect(() => {
    // Listen to all wallets for aggregate stats
    const unsubWallets = onSnapshot(collection(db, 'driver_wallet'), (snap) => {
      let totalIssued = 0, totalRedeemed = 0;
      snap.forEach(d => {
        const data = d.data();
        totalIssued += data.lifetimeEarned || 0;
        totalRedeemed += data.lifetimeRedeemed || 0;
      });
      setStats(s => ({ ...s, totalDrivers: snap.size, totalPointsIssued: totalIssued, totalRedeemed }));
    });

    // Tier distribution
    const unsubTiers = onSnapshot(collection(db, 'driver_tier'), (snap) => {
      const dist = { bronce: 0, plata: 0, oro: 0, diamante: 0 };
      snap.forEach(d => {
        const tier = d.data().currentTier || 'bronce';
        dist[tier] = (dist[tier] || 0) + 1;
      });
      setTierDistribution(dist);
    });

    // Pending redemptions
    const q = query(collection(db, 'redemptions'), where('status', '==', 'pending_fulfillment'));
    const unsubRedemptions = onSnapshot(q, (snap) => {
      setStats(s => ({ ...s, pendingRedemptions: snap.size }));
    });

    return () => { unsubWallets(); unsubTiers(); unsubRedemptions(); };
  }, []);

  return (
    <div>
      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <Users size={24} color="#6366f1" />
          <div style={styles.kpiValue}>{stats.totalDrivers}</div>
          <div style={styles.kpiLabel}>Conductores con Wallet</div>
        </div>
        <div style={styles.kpiCard}>
          <Coins size={24} color="#10b981" />
          <div style={styles.kpiValue}>{stats.totalPointsIssued.toLocaleString()}</div>
          <div style={styles.kpiLabel}>Puntos Emitidos</div>
        </div>
        <div style={styles.kpiCard}>
          <Gift size={24} color="#f59e0b" />
          <div style={styles.kpiValue}>{stats.totalRedeemed.toLocaleString()}</div>
          <div style={styles.kpiLabel}>Puntos Canjeados</div>
        </div>
        <div style={styles.kpiCard}>
          <AlertTriangle size={24} color="#ef4444" />
          <div style={styles.kpiValue}>{stats.pendingRedemptions}</div>
          <div style={styles.kpiLabel}>Canjes Pendientes</div>
        </div>
      </div>

      {/* Tier Distribution */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Distribución de Niveles</h3>
        <div style={styles.tierBars}>
          {Object.entries(TIERS).map(([key, tier]) => {
            const count = tierDistribution[key] || 0;
            const total = Object.values(tierDistribution).reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={key} style={styles.tierBarRow}>
                <span style={styles.tierBarLabel}>{tier.icon} {tier.label}</span>
                <div style={styles.tierBarBg}>
                  <div style={{ ...styles.tierBarFill, width: `${pct}%`, background: tier.color }} />
                </div>
                <span style={styles.tierBarCount}>{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 2: GESTIÓN DE CONDUCTORES
// ═══════════════════════════════════════════
function DriversTab() {
  const [drivers, setDrivers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'driver_wallet'), orderBy('balance', 'desc'), limit(50)),
      async (snap) => {
        const list = [];
        for (const walletDoc of snap.docs) {
          const walletData = walletDoc.data();
          const driverId = walletDoc.id;
          // Get tier info
          const tierSnap = await getDocs(query(collection(db, 'driver_tier'), where('driverId', '==', driverId), limit(1)));
          const tierData = tierSnap.empty ? { currentTier: 'bronce' } : tierSnap.docs[0].data();
          // Get user info
          const userRef = doc(db, 'llevame_users', driverId);
          let userName = driverId;
          try {
            const userSnap = await getDocs(query(collection(db, 'llevame_users'), limit(1))); // simplified
            userName = walletData.driverName || driverId.slice(0, 12);
          } catch (e) {}

          list.push({ id: driverId, ...walletData, ...tierData, userName });
        }
        setDrivers(list);
      }
    );
    return () => unsub();
  }, []);

  const filtered = drivers.filter(d =>
    !searchTerm || d.id.includes(searchTerm) || (d.userName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <div style={styles.searchRow}>
        <Search size={16} color="#94a3b8" />
        <input
          style={styles.searchInput}
          placeholder="Buscar por ID o nombre..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Driver list */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Conductor</th>
              <th style={styles.th}>Nivel</th>
              <th style={styles.th}>Balance</th>
              <th style={styles.th}>Viajes/Mes</th>
              <th style={styles.th}>Rating</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} style={styles.tr}>
                <td style={styles.td}>{d.userName || d.id.slice(0, 12)}</td>
                <td style={styles.td}>{TIERS[d.currentTier]?.icon} {TIERS[d.currentTier]?.label}</td>
                <td style={styles.td}><strong>{(d.balance || 0).toLocaleString()}</strong> pts</td>
                <td style={styles.td}>{d.tripsThisMonth || 0}</td>
                <td style={styles.td}>{d.ratingAvg?.toFixed(1) || '5.0'}★</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 3: CANJES PENDIENTES
// ═══════════════════════════════════════════
function RedemptionsTab() {
  const [redemptions, setRedemptions] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'redemptions'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setRedemptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleFulfill = async (redemptionId) => {
    await updateDoc(doc(db, 'redemptions', redemptionId), {
      status: 'fulfilled',
      fulfilledAt: serverTimestamp(),
    });
  };

  const handleReject = async (redemptionId) => {
    await updateDoc(doc(db, 'redemptions', redemptionId), {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
    });
    // TODO: Refund points to driver wallet
  };

  const statusBadge = (status) => {
    const map = {
      pending_fulfillment: { bg: '#fef3c7', color: '#d97706', text: 'Pendiente' },
      fulfilled: { bg: '#d1fae5', color: '#059669', text: 'Entregado' },
      rejected: { bg: '#fee2e2', color: '#dc2626', text: 'Rechazado' },
    };
    const s = map[status] || map.pending_fulfillment;
    return <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{s.text}</span>;
  };

  return (
    <div>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Conductor</th>
              <th style={styles.th}>Recompensa</th>
              <th style={styles.th}>Puntos</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.map(r => (
              <tr key={r.id} style={styles.tr}>
                <td style={styles.td}>{r.driverId?.slice(0, 12)}</td>
                <td style={styles.td}>{r.rewardName}</td>
                <td style={styles.td}>{r.pointsCost?.toLocaleString()}</td>
                <td style={styles.td}>{statusBadge(r.status)}</td>
                <td style={styles.td}>
                  {r.status === 'pending_fulfillment' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleFulfill(r.id)} style={styles.actionBtn}>
                        <CheckCircle size={14} /> Entregar
                      </button>
                      <button onClick={() => handleReject(r.id)} style={{ ...styles.actionBtn, background: '#fee2e2', color: '#dc2626' }}>
                        <XCircle size={14} /> Rechazar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 4: ANTI-FRAUDE
// ═══════════════════════════════════════════
function AntifraudTab() {
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'points_audit_log'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Alertas de Fraude</h3>
        {auditLogs.length === 0 ? (
          <p style={styles.emptyText}>No hay alertas registradas</p>
        ) : (
          auditLogs.map(log => (
            <div key={log.id} style={{
              ...styles.alertCard,
              borderLeft: `4px solid ${log.action === 'BLOCKED' ? '#ef4444' : log.action === 'FLAGGED' ? '#f59e0b' : '#94a3b8'}`,
            }}>
              <div style={styles.alertHeader}>
                <ShieldAlert size={16} color={log.action === 'BLOCKED' ? '#ef4444' : '#f59e0b'} />
                <strong>{log.action}</strong>
                <span style={styles.alertDate}>{log.createdAt?.toDate?.()?.toLocaleDateString?.('es-VE') || ''}</span>
              </div>
              <div style={styles.alertBody}>
                <span>Driver: {log.driverId?.slice(0, 12)}</span>
                <span>Trip: {log.tripId?.slice(0, 12)}</span>
                <span>Fare: ${log.grossFare}</span>
              </div>
              {log.flags && (
                <div style={styles.alertFlags}>
                  {log.flags.map((f, i) => (
                    <span key={i} style={styles.flagBadge}>{f.rule}: {f.detail}</span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 5: REPORTES MENSUALES
// ═══════════════════════════════════════════
function ReportsTab() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'monthly_eval_reports'), orderBy('createdAt', 'desc'), limit(12));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Evaluaciones Mensuales</h3>
        {reports.length === 0 ? (
          <p style={styles.emptyText}>No hay reportes. La primera evaluación se ejecutará el día 1 del próximo mes.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Mes</th>
                  <th style={styles.th}>Evaluados</th>
                  <th style={styles.th}>Descendidos</th>
                  <th style={styles.th}>Purgados</th>
                  <th style={styles.th}>Sin Cambio</th>
                  <th style={styles.th}>Errores</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}><strong>{r.month}</strong></td>
                    <td style={styles.td}>{r.total}</td>
                    <td style={styles.td}>{r.demoted}</td>
                    <td style={styles.td}>{r.purged}</td>
                    <td style={styles.td}>{r.unchanged}</td>
                    <td style={styles.td}>{r.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN EXPORT — TAB CONTAINER
// ═══════════════════════════════════════════
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} />, Component: DashboardTab },
  { id: 'drivers', label: 'Conductores', icon: <Users size={16} />, Component: DriversTab },
  { id: 'redemptions', label: 'Canjes', icon: <Gift size={16} />, Component: RedemptionsTab },
  { id: 'antifraud', label: 'Anti-Fraude', icon: <ShieldAlert size={16} />, Component: AntifraudTab },
  { id: 'reports', label: 'Reportes', icon: <FileText size={16} />, Component: ReportsTab },
];

export default function AdminLoyaltyTabs() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const ActiveComponent = TABS.find(t => t.id === activeTab)?.Component || DashboardTab;

  return (
    <div style={styles.adminContainer}>
      <h2 style={styles.adminTitle}>
        <Coins size={22} color="#6366f1" /> Loyalty & Rewards Engine
      </h2>

      {/* Tab Navigation */}
      <div style={styles.adminTabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.adminTab,
              ...(activeTab === tab.id ? styles.adminTabActive : {}),
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.adminContent}>
        <ActiveComponent />
      </div>
    </div>
  );
}

// ───────── STYLES ─────────
const styles = {
  adminContainer: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  adminTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 20 },
  adminTabs: { display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20 },
  adminTab: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', background: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#64748b', transition: 'all .2s' },
  adminTabActive: { background: '#fff', color: '#6366f1', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  adminContent: { background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },

  // KPI Grid
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: { background: '#f8fafc', borderRadius: 14, padding: '20px 18px', textAlign: 'center', border: '1px solid #e2e8f0' },
  kpiValue: { fontSize: 32, fontWeight: 800, color: '#1e293b', marginTop: 8 },
  kpiLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4 },

  // Sections
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 12 },

  // Tier Bars
  tierBars: { display: 'flex', flexDirection: 'column', gap: 10 },
  tierBarRow: { display: 'flex', alignItems: 'center', gap: 12 },
  tierBarLabel: { width: 100, fontSize: 13, fontWeight: 600 },
  tierBarBg: { flex: 1, height: 20, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' },
  tierBarFill: { height: '100%', borderRadius: 10, transition: 'width .5s ease' },
  tierBarCount: { width: 80, fontSize: 12, color: '#64748b', textAlign: 'right' },

  // Search
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16 },
  searchInput: { flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 14 },

  // Table
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 12px', color: '#334155' },

  // Action buttons
  actionBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: 'none', borderRadius: 6, background: '#d1fae5', color: '#059669', fontSize: 11, fontWeight: 600, cursor: 'pointer' },

  // Alert cards
  alertCard: { background: '#fafafa', borderRadius: 10, padding: '12px 16px', marginBottom: 10 },
  alertHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 },
  alertDate: { fontSize: 11, color: '#94a3b8', marginLeft: 'auto' },
  alertBody: { display: 'flex', gap: 16, fontSize: 12, color: '#64748b' },
  alertFlags: { marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 },
  flagBadge: { padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6, fontSize: 11 },

  emptyText: { color: '#94a3b8', fontSize: 14 },
};
