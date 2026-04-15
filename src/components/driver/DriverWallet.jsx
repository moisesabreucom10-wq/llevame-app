/**
 * DriverWallet.jsx — Wallet & Rewards Panel for Drivers
 * 
 * Displays: balance, tier badge, progress bars, transaction history, rewards catalog.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loyaltyService, TIER_CONFIG, TIER_ORDER } from '../../services/LoyaltyService';
import { ChevronRight, Gift, Fuel, Wrench, Smartphone, Bike, Star, TrendingUp, History, ArrowLeft } from 'lucide-react';
import TierBenefitsModal from './TierBenefitsModal';

// Rewards catalog (frontend mirror — must match backend RedemptionService.js)
const REWARDS = [
  // Gasolina
  { id: 'gasolina_5', cat: 'gasolina', name: 'Bono Gasolina $5', pts: 50, icon: '⛽', usd: 5 },
  { id: 'gasolina_10', cat: 'gasolina', name: 'Bono Gasolina $10', pts: 100, icon: '⛽', usd: 10 },
  { id: 'gasolina_20', cat: 'gasolina', name: 'Bono Gasolina $20', pts: 200, icon: '⛽', usd: 20 },
  // Repuestos
  { id: 'repuesto_aceite', cat: 'repuestos', name: 'Cambio de Aceite', pts: 80, icon: '🔧', usd: 8 },
  { id: 'repuesto_frenos', cat: 'repuestos', name: 'Kit de Frenos', pts: 250, icon: '🔧', usd: 25 },
  { id: 'repuesto_caucho', cat: 'repuestos', name: 'Caucho de Moto', pts: 350, icon: '🏍️', usd: 35 },
  { id: 'repuesto_bateria', cat: 'repuestos', name: 'Batería de Moto', pts: 300, icon: '🔋', usd: 30 },
  // Datos
  { id: 'datos_1gb', cat: 'datos', name: '1 GB de Datos', pts: 30, icon: '📱', usd: 3 },
  { id: 'datos_3gb', cat: 'datos', name: '3 GB de Datos', pts: 70, icon: '📱', usd: 7 },
  { id: 'datos_5gb', cat: 'datos', name: '5 GB de Datos', pts: 100, icon: '📶', usd: 10 },
  // Moto financiada
  { id: 'moto_descuento_10', cat: 'moto', name: 'Descuento 10% Moto', pts: 5000, icon: '🏍️', usd: 500, minTier: 'plata' },
  { id: 'moto_descuento_25', cat: 'moto', name: 'Descuento 25% Moto', pts: 12500, icon: '🏍️', usd: 1250, minTier: 'oro' },
  { id: 'moto_financiada_completa', cat: 'moto', name: 'Moto 0% Entrada', pts: 25000, icon: '🏍️✨', usd: 2500, minTier: 'diamante' },
];

const CATEGORIES = [
  { id: 'all', label: 'Todas', icon: <Gift size={16} /> },
  { id: 'gasolina', label: 'Gasolina', icon: <Fuel size={16} /> },
  { id: 'repuestos', label: 'Repuestos', icon: <Wrench size={16} /> },
  { id: 'datos', label: 'Datos', icon: <Smartphone size={16} /> },
  { id: 'moto', label: 'Moto', icon: <Bike size={16} /> },
];

const TIER_COLORS = {
  bronce: { bg: 'linear-gradient(135deg, #CD7F32, #A0522D)', text: '#FFF' },
  plata: { bg: 'linear-gradient(135deg, #C0C0C0, #808080)', text: '#FFF' },
  oro: { bg: 'linear-gradient(135deg, #FFD700, #DAA520)', text: '#333' },
  diamante: { bg: 'linear-gradient(135deg, #B9F2FF, #00CED1)', text: '#1a1a2e' },
};

export default function DriverWallet({ onBack }) {
  const { currentUser } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [tier, setTier] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('wallet'); // wallet | rewards | history
  const [activeCat, setActiveCat] = useState('all');
  const [showBenefits, setShowBenefits] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubs = [
      loyaltyService.subscribeToWallet(currentUser.uid, setWallet),
      loyaltyService.subscribeToTier(currentUser.uid, setTier),
      loyaltyService.subscribeToHistory(currentUser.uid, 30, setHistory),
    ];

    return () => unsubs.forEach(u => u());
  }, [currentUser?.uid]);

  const progress = loyaltyService.getProgress(tier);
  const balance = wallet?.balance || 0;
  const balanceUSD = loyaltyService.pointsToUSD(balance);
  const currentTier = tier?.currentTier || 'bronce';
  const tierStyle = TIER_COLORS[currentTier] || TIER_COLORS.bronce;
  const tierInfo = TIER_CONFIG[currentTier] || TIER_CONFIG.bronce;

  const filteredRewards = REWARDS.filter(r => {
    if (activeCat !== 'all' && r.cat !== activeCat) return false;
    return true;
  });

  const canRedeem = (reward) => {
    if (balance < reward.pts) return false;
    if (reward.minTier) {
      const driverLevel = TIER_ORDER.indexOf(currentTier);
      const requiredLevel = TIER_ORDER.indexOf(reward.minTier);
      if (driverLevel < requiredLevel) return false;
    }
    return true;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {onBack && (
          <button onClick={onBack} style={styles.backBtn}>
            <ArrowLeft size={22} color="#fff" />
          </button>
        )}
        <h2 style={styles.headerTitle}>Mi Wallet</h2>
      </div>

      {/* Balance Card */}
      <div style={{ ...styles.balanceCard, background: tierStyle.bg }}>
        <div style={styles.tierBadge}>
          <span style={styles.tierIcon}>{tierInfo.icon}</span>
          <span style={{ ...styles.tierLabel, color: tierStyle.text }}>{tierInfo.label}</span>
          <span style={{ ...styles.multiplierBadge, color: tierStyle.text }}>x{tierInfo.multiplier}</span>
        </div>
        <div style={{ ...styles.balanceAmount, color: tierStyle.text }}>{balance.toLocaleString()}</div>
        <div style={{ ...styles.balanceLabel, color: tierStyle.text, opacity: 0.85 }}>puntos · ${balanceUSD} USD</div>

        {/* Mini Stats */}
        <div style={styles.miniStats}>
          <div style={styles.miniStat}>
            <span style={{ ...styles.miniValue, color: tierStyle.text }}>{(wallet?.lifetimeEarned || 0).toLocaleString()}</span>
            <span style={{ ...styles.miniLabel, color: tierStyle.text }}>Ganados</span>
          </div>
          <div style={{ ...styles.miniDivider, borderColor: tierStyle.text + '40' }} />
          <div style={styles.miniStat}>
            <span style={{ ...styles.miniValue, color: tierStyle.text }}>{(wallet?.lifetimeRedeemed || 0).toLocaleString()}</span>
            <span style={{ ...styles.miniLabel, color: tierStyle.text }}>Canjeados</span>
          </div>
        </div>
      </div>

      {/* Progress toward next tier */}
      {!progress?.isMax && (
        <div style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <TrendingUp size={16} color="#6366f1" />
            <span style={styles.progressTitle}>Progreso a {progress?.nextTierLabel} {progress?.nextTierIcon}</span>
          </div>
          <div style={styles.progressRow}>
            <span style={styles.progressLabel}>Viajes: {tier?.tripsThisMonth || 0}/{progress?.tripsRequired}</span>
            <div style={styles.progressBarBg}>
              <div style={{ ...styles.progressBarFill, width: `${progress?.tripsProgress || 0}%` }} />
            </div>
          </div>
          <div style={styles.progressRow}>
            <span style={styles.progressLabel}>Rating: {tier?.ratingAvg || '5.0'}★/{progress?.ratingRequired}★</span>
            <div style={styles.progressBarBg}>
              <div style={{ ...styles.progressBarFill, width: `${progress?.ratingProgress || 0}%`, background: '#f59e0b' }} />
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        {[
          { id: 'wallet', label: 'Resumen', icon: <Star size={14} /> },
          { id: 'rewards', label: 'Recompensas', icon: <Gift size={14} /> },
          { id: 'history', label: 'Historial', icon: <History size={14} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeTab === 'wallet' && (
          <div>
            <div style={styles.infoCard}>
              <h4 style={styles.infoTitle}>¿Cómo funciona?</h4>
              <p style={styles.infoText}>Gana <strong>10 puntos por cada $1</strong> de tarifa bruta.</p>
              <p style={styles.infoText}>Tu nivel <strong>{tierInfo.label}</strong> multiplica tus puntos por <strong>{tierInfo.multiplier}x</strong>.</p>
              <p style={styles.infoText}>Canjea puntos por gasolina, repuestos, datos móviles, ¡o financia una moto!</p>
            </div>
            <div style={styles.infoCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ ...styles.infoTitle, margin: 0 }}>Niveles</h4>
                <button
                  onClick={() => setShowBenefits(true)}
                  style={styles.benefitsBtn}
                >
                  Ver beneficios <ChevronRight size={14} />
                </button>
              </div>
              {TIER_ORDER.map(t => {
                const c = TIER_CONFIG[t];
                const isActive = t === currentTier;
                return (
                  <div key={t} style={{ ...styles.tierRow, opacity: isActive ? 1 : 0.6, fontWeight: isActive ? 700 : 400 }}>
                    <span>{c.icon} {c.label}</span>
                    <span>x{c.multiplier} · {c.minTrips > 0 ? `${c.minTrips} viajes + ${c.minRating}★` : 'Default'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'rewards' && (
          <div>
            {/* Category filter */}
            <div style={styles.catRow}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  style={{
                    ...styles.catBtn,
                    ...(activeCat === cat.id ? styles.catBtnActive : {}),
                  }}
                >
                  {cat.icon}
                  <span style={{ fontSize: 11 }}>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Reward Items */}
            {filteredRewards.map(reward => {
              const redeemable = canRedeem(reward);
              return (
                <div key={reward.id} style={{ ...styles.rewardCard, opacity: redeemable ? 1 : 0.5 }}>
                  <div style={styles.rewardIcon}>{reward.icon}</div>
                  <div style={styles.rewardInfo}>
                    <span style={styles.rewardName}>{reward.name}</span>
                    <span style={styles.rewardPts}>{reward.pts.toLocaleString()} pts · ${reward.usd}</span>
                    {reward.minTier && (
                      <span style={styles.rewardTierReq}>Requiere: {TIER_CONFIG[reward.minTier]?.label}</span>
                    )}
                  </div>
                  <button
                    style={{ ...styles.redeemBtn, ...(redeemable ? {} : styles.redeemBtnDisabled) }}
                    disabled={!redeemable}
                  >
                    Canjear
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div style={styles.emptyState}>
                <History size={40} color="#ccc" />
                <p>Aún no tienes transacciones</p>
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} style={styles.historyRow}>
                  <div style={styles.historyIcon}>
                    {item.type === 'TRIP_EARN' ? '🟢' : item.type === 'REDEMPTION' ? '🔴' : '⚪'}
                  </div>
                  <div style={styles.historyInfo}>
                    <span style={styles.historyType}>
                      {item.type === 'TRIP_EARN' ? 'Viaje completado' :
                       item.type === 'REDEMPTION' ? 'Canjeo' :
                       item.type === 'INACTIVITY_PURGE' ? 'Expiración' : item.type}
                    </span>
                    <span style={styles.historyDate}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <span style={{
                    ...styles.historyAmount,
                    color: item.type === 'TRIP_EARN' ? '#10b981' : '#ef4444',
                  }}>
                    {item.type === 'TRIP_EARN' ? '+' : '-'}{item.amount?.toLocaleString()} pts
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <TierBenefitsModal
        show={showBenefits}
        onClose={() => setShowBenefits(false)}
        currentTier={currentTier}
      />
    </div>
  );
}

// ───────── STYLES ─────────
const styles = {
  container: { height: '100%', overflowY: 'auto', background: '#f8fafc', paddingBottom: 32 },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: '#1a1a2e', position: 'sticky', top: 0, zIndex: 10 },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: "'Inter', sans-serif" },

  // Balance Card
  balanceCard: { margin: '16px 16px 12px', borderRadius: 20, padding: '24px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  tierBadge: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  tierIcon: { fontSize: 22 },
  tierLabel: { fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 },
  multiplierBadge: { fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 12 },
  balanceAmount: { fontSize: 42, fontWeight: 800, lineHeight: 1, fontFamily: "'Inter', sans-serif" },
  balanceLabel: { fontSize: 14, marginTop: 4 },
  miniStats: { display: 'flex', alignItems: 'center', marginTop: 16, gap: 16 },
  miniStat: { display: 'flex', flexDirection: 'column' },
  miniValue: { fontSize: 16, fontWeight: 700 },
  miniLabel: { fontSize: 11, opacity: 0.7 },
  miniDivider: { width: 1, height: 28, borderRight: '1px solid' },

  // Progress
  progressCard: { margin: '0 16px 12px', background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  progressHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 },
  progressTitle: { fontSize: 13, fontWeight: 600, color: '#6366f1' },
  progressRow: { marginBottom: 8 },
  progressLabel: { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' },
  progressBarBg: { height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', background: '#6366f1', borderRadius: 3, transition: 'width 0.5s ease' },

  // Tabs
  tabs: { display: 'flex', margin: '0 16px', background: '#fff', borderRadius: 12, padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tab: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 8px', border: 'none', background: 'none', fontSize: 12, fontWeight: 500, color: '#94a3b8', borderRadius: 8, cursor: 'pointer', transition: 'all .2s' },
  tabActive: { background: '#6366f1', color: '#fff', fontWeight: 700 },
  tabContent: { padding: '12px 16px' },

  // Info cards
  infoCard: { background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  infoTitle: { fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' },
  benefitsBtn: { display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 0' },
  infoText: { fontSize: 13, color: '#64748b', margin: '4px 0', lineHeight: 1.5 },
  tierRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#334155', borderBottom: '1px solid #f1f5f9' },

  // Category filter
  catRow: { display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 },
  catBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 20, background: '#fff', fontSize: 12, color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .2s' },
  catBtnActive: { background: '#6366f1', color: '#fff', borderColor: '#6366f1' },

  // Reward cards
  rewardCard: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'opacity .2s' },
  rewardIcon: { fontSize: 28, width: 40, textAlign: 'center' },
  rewardInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  rewardName: { fontSize: 14, fontWeight: 600, color: '#1e293b' },
  rewardPts: { fontSize: 12, color: '#64748b' },
  rewardTierReq: { fontSize: 11, color: '#f59e0b', fontWeight: 600 },
  redeemBtn: { padding: '8px 16px', border: 'none', borderRadius: 10, background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  redeemBtnDisabled: { background: '#cbd5e1', cursor: 'not-allowed' },

  // History
  historyRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
  historyIcon: { fontSize: 18 },
  historyInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  historyType: { fontSize: 13, fontWeight: 600, color: '#1e293b' },
  historyDate: { fontSize: 11, color: '#94a3b8' },
  historyAmount: { fontSize: 14, fontWeight: 700 },

  // Empty state
  emptyState: { textAlign: 'center', padding: 40, color: '#94a3b8' },
};
