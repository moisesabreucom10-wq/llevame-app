/**
 * TierBenefitsModal.jsx — Bottom Sheet de Beneficios por Nivel
 * Se abre desde la pestaña Puntos → Resumen → "Ver beneficios por nivel"
 */

import React, { useEffect, useState } from 'react';
import { X, Check, Lock } from 'lucide-react';

const TIER_ORDER = ['bronce', 'plata', 'oro', 'diamante'];

const TIER_STYLES = {
  bronce: {
    gradient: 'linear-gradient(135deg, #8B4513 0%, #CD7F32 50%, #A0522D 100%)',
    headerText: '#fff',
    badgeBg: 'rgba(255,255,255,0.2)',
    checkColor: '#FFD580',
    glow: '0 8px 32px rgba(205,127,50,0.35)',
  },
  plata: {
    gradient: 'linear-gradient(135deg, #5a5a5a 0%, #C0C0C0 50%, #808080 100%)',
    headerText: '#fff',
    badgeBg: 'rgba(255,255,255,0.2)',
    checkColor: '#E8E8E8',
    glow: '0 8px 32px rgba(192,192,192,0.35)',
  },
  oro: {
    gradient: 'linear-gradient(135deg, #b8860b 0%, #FFD700 50%, #DAA520 100%)',
    headerText: '#1a1a1a',
    badgeBg: 'rgba(0,0,0,0.15)',
    checkColor: '#5c3d00',
    glow: '0 8px 32px rgba(255,215,0,0.4)',
  },
  diamante: {
    gradient: 'linear-gradient(135deg, #006994 0%, #00CED1 50%, #B9F2FF 100%)',
    headerText: '#1a1a2e',
    badgeBg: 'rgba(0,0,0,0.12)',
    checkColor: '#003d5c',
    glow: '0 8px 32px rgba(0,206,209,0.45)',
  },
};

const TIER_DATA = {
  bronce: {
    icon: '🥉',
    label: 'Bronce',
    multiplier: '1.0x',
    requirement: 'Nivel de entrada',
    benefits: [
      { text: 'Acceso al catálogo básico de recompensas', available: true },
      { text: 'Gasolina desde 50 puntos', available: true },
      { text: 'Datos móviles desde 30 puntos', available: true },
      { text: 'Repuestos básicos de moto', available: true },
    ],
    locked: [],
  },
  plata: {
    icon: '🥈',
    label: 'Plata',
    multiplier: '1.2x',
    requirement: '50 viajes/mes + 4.7★',
    benefits: [
      { text: 'Todo lo del nivel Bronce', available: true },
      { text: '+20% más puntos por cada viaje', available: true },
      { text: 'Acceso a repuestos premium', available: true },
      { text: 'Prioridad en asignación de viajes', available: true, soon: true },
    ],
  },
  oro: {
    icon: '🥇',
    label: 'Oro',
    multiplier: '1.5x',
    requirement: '120 viajes/mes + 4.8★',
    benefits: [
      { text: 'Todo lo del nivel Plata', available: true },
      { text: '+50% más puntos por cada viaje', available: true },
      { text: 'Descuento 10% en moto financiada', available: true },
      { text: 'Soporte prioritario 24/7', available: true },
      { text: 'Badge dorado visible para pasajeros', available: true },
    ],
  },
  diamante: {
    icon: '💎',
    label: 'Diamante',
    multiplier: '2.0x',
    requirement: '250 viajes/mes + 4.9★',
    benefits: [
      { text: 'Todo lo del nivel Oro', available: true },
      { text: '2x puntos por cada viaje', available: true },
      { text: 'Descuento 25% en moto financiada', available: true },
      { text: 'Moto financiada con 0% de entrada', available: true },
      { text: 'Acceso anticipado a nuevas funciones', available: true },
      { text: 'Badge exclusivo 💎 en tu perfil', available: true },
    ],
  },
};

export default function TierBenefitsModal({ show, onClose, currentTier = 'bronce' }) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  const currentIndex = TIER_ORDER.indexOf(currentTier);

  return (
    <div
      style={{
        ...s.overlay,
        opacity: animating ? 1 : 0,
        transition: 'opacity 0.35s ease',
      }}
      onClick={onClose}
    >
      {/* Bottom Sheet Panel */}
      <div
        style={{
          ...s.sheet,
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle Bar */}
        <div style={s.handleBar} />

        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.title}>Beneficios por Nivel</h2>
            <p style={s.subtitle}>Sube de nivel para multiplicar tus puntos y desbloquear más recompensas</p>
          </div>
          <button onClick={onClose} style={s.closeBtn}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        {/* Scrollable Cards */}
        <div style={s.scrollArea}>
          {TIER_ORDER.map((tier, idx) => {
            const data = TIER_DATA[tier];
            const style = TIER_STYLES[tier];
            const isActive = tier === currentTier;
            const isUnlocked = idx <= currentIndex;
            const isLocked = idx > currentIndex;

            return (
              <div
                key={tier}
                style={{
                  ...s.card,
                  boxShadow: isActive ? style.glow : '0 2px 10px rgba(0,0,0,0.08)',
                  border: isActive ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                  marginBottom: idx < TIER_ORDER.length - 1 ? 16 : 0,
                }}
              >
                {/* Card Header */}
                <div style={{ ...s.cardHeader, background: style.gradient }}>
                  {/* Active Badge */}
                  {isActive && (
                    <div style={{ ...s.activeBadge, background: style.badgeBg }}>
                      <div style={s.activeDot} />
                      <span style={{ color: style.headerText, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
                        TU NIVEL ACTUAL
                      </span>
                    </div>
                  )}
                  {isLocked && (
                    <div style={{ ...s.activeBadge, background: 'rgba(0,0,0,0.2)' }}>
                      <Lock size={9} color="rgba(255,255,255,0.8)" />
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
                        BLOQUEADO
                      </span>
                    </div>
                  )}

                  <div style={s.cardHeaderContent}>
                    <span style={s.tierIcon}>{data.icon}</span>
                    <div>
                      <div style={{ ...s.tierName, color: style.headerText }}>{data.label}</div>
                      <div style={{ ...s.tierReq, color: style.headerText, opacity: 0.75 }}>{data.requirement}</div>
                    </div>
                    <div style={{ ...s.multiplierBig, color: style.headerText }}>
                      {data.multiplier}
                      <div style={{ ...s.multiplierLabel, color: style.headerText }}>puntos</div>
                    </div>
                  </div>
                </div>

                {/* Benefits List */}
                <div style={{
                  ...s.benefitsList,
                  opacity: isLocked ? 0.55 : 1,
                }}>
                  {data.benefits.map((b, i) => (
                    <div key={i} style={s.benefitRow}>
                      <div style={{
                        ...s.checkCircle,
                        background: isUnlocked ? style.gradient : '#e2e8f0',
                      }}>
                        <Check size={10} color={isUnlocked ? '#fff' : '#94a3b8'} strokeWidth={3} />
                      </div>
                      <span style={s.benefitText}>
                        {b.text}
                        {b.soon && <span style={s.soonBadge}> Próximamente</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Bottom spacing for safe area */}
          <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
        </div>
      </div>
    </div>
  );
}

// ───────── STYLES ─────────
const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '90vh',
    background: '#f8fafc',
    borderRadius: '24px 24px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  handleBar: {
    width: 40,
    height: 4,
    background: '#cbd5e1',
    borderRadius: 2,
    margin: '12px auto 0',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '16px 20px 12px',
    flexShrink: 0,
    borderBottom: '1px solid #e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: '#1e293b',
    margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    margin: '4px 0 0',
    lineHeight: 1.4,
    maxWidth: 260,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: '#f1f5f9',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  scrollArea: {
    overflowY: 'auto',
    flex: 1,
    padding: '16px 16px 0',
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    background: '#fff',
  },
  cardHeader: {
    padding: '16px 18px 14px',
    position: 'relative',
  },
  activeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 20,
    marginBottom: 10,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#4ade80',
    boxShadow: '0 0 6px #4ade80',
  },
  cardHeaderContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  tierIcon: {
    fontSize: 36,
    lineHeight: 1,
  },
  tierName: {
    fontSize: 20,
    fontWeight: 800,
    fontFamily: "'Inter', sans-serif",
  },
  tierReq: {
    fontSize: 12,
    marginTop: 2,
  },
  multiplierBig: {
    marginLeft: 'auto',
    fontSize: 28,
    fontWeight: 900,
    textAlign: 'center',
    lineHeight: 1,
    fontFamily: "'Inter', sans-serif",
  },
  multiplierLabel: {
    fontSize: 10,
    fontWeight: 600,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 2,
  },
  benefitsList: {
    padding: '14px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  benefitRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  benefitText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.4,
  },
  soonBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#f59e0b',
    background: '#fef3c7',
    padding: '1px 6px',
    borderRadius: 6,
    marginLeft: 4,
  },
};
