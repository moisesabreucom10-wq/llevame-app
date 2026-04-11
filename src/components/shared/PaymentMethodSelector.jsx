import React, { useState } from 'react';
import { CreditCard, Banknote, CheckCircle, Plus, X, Smartphone, Copy } from 'lucide-react';
import { VENEZUELA_BANKS } from '../../constants/banks';

const PaymentMethodSelector = ({ selectedMethod, onSelect }) => {
    const [showModal, setShowModal] = useState(false);
    const [cards, setCards] = useState([
        { id: 'card_demo_1', brand: 'visa', last4: '4242' }
    ]);
    const [isAddingCard, setIsAddingCard] = useState(false);

    // New Card State
    const [newCard, setNewCard] = useState({ number: '', expiry: '', cvc: '' });

    // C2P State
    const [showC2PForm, setShowC2PForm] = useState(false);
    const [c2pData, setC2pData] = useState({ bankCode: '', phone: '', idType: 'V', idNumber: '' });

    // Manual Pago Movil State
    const [showPagoMovilDetails, setShowPagoMovilDetails] = useState(false);

    // Mock Company Details
    const companyData = {
        bank: 'Banesco',
        phone: '0414-1234567',
        id: 'J-123456789',
        name: 'LLEVAME C.A.'
    };

    const handleCopy = (text) => {
        navigator.clipboard?.writeText(text).catch(() => {});
        window.showInAppNotification?.('default', 'Copiado', text);
    };

    const handleAddCard = () => {
        if (newCard.number.length > 10) {
            const cardBrand = newCard.number.startsWith('5') ? 'mastercard' : 'visa';
            const mockNewCard = {
                id: `card_${Date.now()}`,
                brand: cardBrand,
                last4: newCard.number.slice(-4)
            };
            setCards([...cards, mockNewCard]);
            onSelect({ type: 'card', ...mockNewCard });
            setIsAddingCard(false);
            setNewCard({ number: '', expiry: '', cvc: '' });
            setShowModal(false);
        }
    };

    const getMethodIcon = (type) => {
        switch (type) {
            case 'cash': return <Banknote size={20} />;
            case 'card': return <CreditCard size={20} />;
            case 'c2p':
            case 'pago_movil': return <Smartphone size={20} />;
            default: return <Banknote size={20} />;
        }
    };

    const getMethodLabel = (method) => {
        switch (method.type) {
            case 'cash': return 'Efectivo';
            case 'card': return `**** ${method.last4}`;
            case 'c2p': return `Pago C2P (${method.data?.bankCode || 'Configurado'})`;
            case 'pago_movil': return `Pago Móvil Manual`;
            default: return 'Efectivo';
        }
    };

    const resetForms = () => {
        setShowC2PForm(false);
        setShowPagoMovilDetails(false);
        setIsAddingCard(false);
    };

    return (
        <>
            <div onClick={() => setShowModal(true)} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedMethod.type === 'cash' ? 'bg-green-100 text-green-600' :
                        selectedMethod.type === 'c2p' ? 'bg-indigo-100 text-indigo-600' :
                            selectedMethod.type === 'pago_movil' ? 'bg-blue-100 text-blue-600' :
                                'bg-gray-100 text-gray-600'
                    }`}>
                    {getMethodIcon(selectedMethod.type)}
                </div>
                <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Método de Pago</p>
                    <p className="font-bold text-gray-800">
                        {getMethodLabel(selectedMethod)}
                    </p>
                </div>
                <div className="text-indigo-600 font-bold text-sm">Cambiar</div>
            </div>

            {/* Selection Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-3xl p-6 animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Método de Pago</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
                        </div>

                        {showC2PForm ? (
                            /* C2P Configuration Form */
                            <div className="space-y-4 animate-fade-in">
                                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-4">
                                    <h4 className="font-bold text-indigo-900 mb-2">Configurar Cobro C2P</h4>
                                    <p className="text-xs text-indigo-700">El cobro se realizará automáticamente a tu cuenta. Solo necesitarás aprobarlo con el SMS/Token de tu banco al finalizar el viaje.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Tu Banco</label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                        value={c2pData.bankCode}
                                        onChange={(e) => setC2pData({ ...c2pData, bankCode: e.target.value })}
                                    >
                                        <option value="">Selecciona un banco</option>
                                        {VENEZUELA_BANKS.map(bank => (
                                            <option key={bank.code} value={bank.code}>{bank.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Cédula</label>
                                        <div className="flex">
                                            <select
                                                className="px-2 py-3 bg-gray-50 border border-yy-200 rounded-l-xl border-r-0 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={c2pData.idType}
                                                onChange={(e) => setC2pData({ ...c2pData, idType: e.target.value })}
                                            >
                                                <option value="V">V</option>
                                                <option value="E">E</option>
                                                <option value="J">J</option>
                                            </select>
                                            <input
                                                type="tel"
                                                placeholder="12345678"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-r-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={c2pData.idNumber}
                                                onChange={(e) => setC2pData({ ...c2pData, idNumber: e.target.value.replace(/\D/g, '') })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono Afiliado</label>
                                    <input
                                        type="tel"
                                        placeholder="04141234567"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={c2pData.phone}
                                        onChange={(e) => setC2pData({ ...c2pData, phone: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setShowC2PForm(false)}
                                        className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        disabled={!c2pData.bankCode || !c2pData.phone || !c2pData.idNumber}
                                        onClick={() => {
                                            onSelect({
                                                type: 'c2p',
                                                data: c2pData,
                                                verified: true
                                            });
                                            setShowModal(false);
                                            setShowC2PForm(false);
                                        }}
                                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>

                        ) : showPagoMovilDetails ? (
                            /* Manual Pago Movil View */
                            <div className="space-y-4 animate-fade-in">
                                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                    <h4 className="font-bold text-blue-900 mb-3 text-center">Datos para el Pago</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center bg-white/50 p-2 rounded-lg">
                                            <span className="text-gray-500">Banco:</span>
                                            <span className="font-bold text-gray-800">{companyData.bank}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/50 p-2 rounded-lg cursor-pointer" onClick={() => handleCopy(companyData.phone)}>
                                            <span className="text-gray-500">Teléfono:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800">{companyData.phone}</span>
                                                <Copy size={14} className="text-blue-500" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/50 p-2 rounded-lg cursor-pointer" onClick={() => handleCopy(companyData.id)}>
                                            <span className="text-gray-500">RIF/C.I.:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800">{companyData.id}</span>
                                                <Copy size={14} className="text-blue-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-yellow-50 p-3 mb-4 rounded-xl border border-yellow-100 flex gap-2">
                                    <div className="text-yellow-700 text-xs font-bold">Nota: Realizarás el pago al conductor al finalizar el viaje.</div>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setShowPagoMovilDetails(false)}
                                        className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        onClick={() => {
                                            onSelect({
                                                type: 'pago_movil',
                                                bank: companyData.bank,
                                                verified: false
                                            });
                                            setShowModal(false);
                                            setShowPagoMovilDetails(false);
                                        }}
                                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                                    >
                                        Confirmar Método
                                    </button>
                                </div>
                            </div>

                        ) : isAddingCard ? (
                            /* Card Form */
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Número de Tarjeta</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                        <input
                                            type="text"
                                            placeholder="0000 0000 0000 0000"
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none font-mono text-lg"
                                            value={newCard.number}
                                            onChange={(e) => setNewCard({ ...newCard, number: e.target.value.replace(/\D/g, '').substring(0, 16) })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Expira</label>
                                        <input
                                            type="text"
                                            placeholder="MM/AA"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none text-center font-mono"
                                            value={newCard.expiry}
                                            onChange={(e) => setNewCard({ ...newCard, expiry: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">CVC</label>
                                        <input
                                            type="text"
                                            placeholder="123"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black outline-none text-center font-mono"
                                            value={newCard.cvc}
                                            onChange={(e) => setNewCard({ ...newCard, cvc: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 flex gap-2">
                                    <div className="text-yellow-600 text-xs">ℹ️ Simulación de tarjeta.</div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        onClick={() => setIsAddingCard(false)}
                                        className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleAddCard}
                                        className="flex-1 py-3 bg-black text-white rounded-xl font-bold shadow-lg hover:bg-gray-800"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Method List (Default) */
                            <div className="space-y-3 animate-fade-in">
                                {/* Cash */}
                                <div
                                    onClick={() => { onSelect({ type: 'cash' }); setShowModal(false); }}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod.type === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:bg-gray-50'}`}
                                >
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                        <Banknote size={24} />
                                    </div>
                                    <div className="flex-1 font-bold text-gray-700">Efectivo</div>
                                    {selectedMethod.type === 'cash' && <CheckCircle size={20} className="text-green-600" />}
                                </div>

                                {/* C2P (New Feature) */}
                                <div
                                    onClick={() => setShowC2PForm(true)}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod.type === 'c2p' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:bg-gray-50'}`}
                                >
                                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                        <Smartphone size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-700">Pago Móvil C2P</p>
                                        <p className="text-xs text-gray-400">Automático</p>
                                    </div>
                                    {selectedMethod.type === 'c2p' && <CheckCircle size={20} className="text-indigo-600" />}
                                </div>

                                {/* Manual Pago Movil */}
                                <div
                                    onClick={() => setShowPagoMovilDetails(true)}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod.type === 'pago_movil' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
                                >
                                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-400">
                                        <Copy size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-700">Pago Móvil Manual</p>
                                        <p className="text-xs text-gray-400">Transferencia Tradicional</p>
                                    </div>
                                    {selectedMethod.type === 'pago_movil' && <CheckCircle size={20} className="text-blue-600" />}
                                </div>

                                {/* Cards */}
                                {cards.map(card => (
                                    <div
                                        key={card.id}
                                        onClick={() => { onSelect({ type: 'card', ...card }); setShowModal(false); }}
                                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod.id === card.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:bg-gray-50'}`}
                                    >
                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                            <CreditCard size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-700 capitalize">{card.brand} •••• {card.last4}</p>
                                        </div>
                                        {selectedMethod.id === card.id && <CheckCircle size={20} className="text-indigo-600" />}
                                    </div>
                                ))}

                                <button
                                    onClick={() => setIsAddingCard(true)}
                                    className="w-full py-4 mt-4 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 font-bold hover:bg-gray-50 hover:border-gray-400 transition-all"
                                >
                                    <Plus size={20} /> Agregar Tarjeta
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default PaymentMethodSelector;
