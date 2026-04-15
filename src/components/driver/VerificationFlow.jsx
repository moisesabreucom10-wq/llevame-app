import React, { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import {
    ArrowLeft, ArrowRight, CheckCircle, Upload, Camera as CameraIcon,
    Car, FileText, Shield, AlertCircle, X, ImageIcon, Loader
} from 'lucide-react';

// ─── Utilidad: subir imagen base64 a Firebase Storage ──────────────────────
const uploadImageToStorage = async (base64String, format, path) => {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: `image/${format}` });
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, blob);
    return getDownloadURL(snapshot.ref);
};

// ─── Componente: Botón de captura de imagen ──────────────────────────────
const ImageCapture = ({ label, icon: Icon, value, onChange, uploading }) => {
    const handleCapture = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 70,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt,
            });
            if (image.base64String) {
                onChange({ base64: image.base64String, format: image.format });
            }
        } catch (error) {
            if (error.message !== 'User cancelled photos app') {
                console.error('Camera error:', error);
                alert('Error al abrir la cámara: ' + error.message);
            }
        }
    };

    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                {Icon && <Icon size={12} />} {label}
            </label>
            <button
                type="button"
                onClick={handleCapture}
                disabled={uploading}
                className={`w-full h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all active:scale-98 ${
                    value
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
            >
                {value ? (
                    <>
                        <img
                            src={`data:image/${value.format};base64,${value.base64}`}
                            alt={label}
                            className="h-24 w-full object-cover rounded-xl"
                        />
                        <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                            <CheckCircle size={12} /> Foto tomada — toca para cambiar
                        </span>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                            <CameraIcon size={24} />
                        </div>
                        <span className="text-sm text-gray-500 font-medium">Toca para fotografiar</span>
                    </>
                )}
            </button>
        </div>
    );
};

// ─── Paso 1: Datos del Vehículo ───────────────────────────────────────────
const Step1Vehicle = ({ data, onChange }) => (
    <div className="space-y-5">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                <Car size={24} />
            </div>
            <div>
                <h3 className="font-black text-gray-900 text-lg">Datos del Vehículo</h3>
                <p className="text-sm text-gray-500">Información del auto o moto que usarás</p>
            </div>
        </div>

        <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Marca</label>
                <input
                    type="text"
                    value={data.marca}
                    onChange={e => onChange({ ...data, marca: e.target.value })}
                    placeholder="Ej: Toyota, Chevrolet, Honda..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Modelo</label>
                <input
                    type="text"
                    value={data.modelo}
                    onChange={e => onChange({ ...data, modelo: e.target.value })}
                    placeholder="Ej: Corolla, Aveo, CBR..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Año</label>
                    <input
                        type="number"
                        value={data.anio}
                        onChange={e => onChange({ ...data, anio: e.target.value })}
                        placeholder="2020"
                        min="1990"
                        max={new Date().getFullYear()}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Placa</label>
                    <input
                        type="text"
                        value={data.placa}
                        onChange={e => onChange({ ...data, placa: e.target.value.toUpperCase() })}
                        placeholder="ABC-123"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all uppercase"
                    />
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Tipo de Vehículo</label>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { value: 'carro', label: 'Carro', icon: '🚗' },
                        { value: 'moto', label: 'Moto / Motor', icon: '🏍️' },
                    ].map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange({ ...data, tipo: opt.value })}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                data.tipo === opt.value
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-100 hover:border-gray-200'
                            }`}
                        >
                            <span className="text-2xl">{opt.icon}</span>
                            <span className="text-sm font-bold">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// ─── Paso 2: Documentos de Identidad ─────────────────────────────────────
const Step2KYC = ({ data, onChange }) => (
    <div className="space-y-5">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                <Shield size={24} />
            </div>
            <div>
                <h3 className="font-black text-gray-900 text-lg">Documentos de Identidad</h3>
                <p className="text-sm text-gray-500">Necesitamos verificar que eres tú</p>
            </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 mb-4">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
                Coloca el documento sobre una superficie plana, bien iluminada. Las fotos deben ser legibles.
            </p>
        </div>

        <ImageCapture
            label="Selfie con Cédula en mano"
            icon={CameraIcon}
            value={data.selfie}
            onChange={val => onChange({ ...data, selfie: val })}
        />
        <ImageCapture
            label="Cédula — Parte Frontal"
            icon={ImageIcon}
            value={data.cedulaFrente}
            onChange={val => onChange({ ...data, cedulaFrente: val })}
        />
        <ImageCapture
            label="Cédula — Parte Reverso"
            icon={ImageIcon}
            value={data.cedulaReverso}
            onChange={val => onChange({ ...data, cedulaReverso: val })}
        />
    </div>
);

// ─── Paso 3: Documentos del Vehículo ─────────────────────────────────────
const Step3VehicleDocs = ({ data, onChange }) => (
    <div className="space-y-5">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                <FileText size={24} />
            </div>
            <div>
                <h3 className="font-black text-gray-900 text-lg">Documentos del Vehículo</h3>
                <p className="text-sm text-gray-500">Para confirmar que el vehículo es legal</p>
            </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 mb-4">
            <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 font-medium">
                Si los documentos son digitales, toma una captura de pantalla. Si son físicos, fotografíalos claramente.
            </p>
        </div>

        <ImageCapture
            label="Carnet de Circulación"
            icon={FileText}
            value={data.carnet}
            onChange={val => onChange({ ...data, carnet: val })}
        />
        <ImageCapture
            label="Póliza de Seguro"
            icon={Shield}
            value={data.poliza}
            onChange={val => onChange({ ...data, poliza: val })}
        />
    </div>
);

// ─── Componente de Progreso ───────────────────────────────────────────────
const StepIndicator = ({ current, total }) => (
    <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: total }).map((_, i) => (
            <React.Fragment key={i}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-black transition-all ${
                    i < current
                        ? 'bg-indigo-600 text-white'
                        : i === current
                            ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                            : 'bg-gray-100 text-gray-400'
                }`}>
                    {i < current ? <CheckCircle size={16} /> : i + 1}
                </div>
                {i < total - 1 && (
                    <div className={`flex-1 h-0.5 rounded transition-all ${i < current ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                )}
            </React.Fragment>
        ))}
    </div>
);

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────
const VerificationFlow = ({ onClose }) => {
    const { currentUser, userProfile, updateUserProfile } = useAuth();
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitProgress, setSubmitProgress] = useState('');
    const [done, setDone] = useState(false);

    // Datos de cada paso
    const [vehicleData, setVehicleData] = useState({
        marca: userProfile?.vehicleInfo?.marca || '',
        modelo: userProfile?.vehicleInfo?.model || '',
        anio: userProfile?.vehicleInfo?.anio || '',
        placa: userProfile?.vehicleInfo?.plate || '',
        tipo: userProfile?.vehicleInfo?.type || 'carro',
    });

    const [kycData, setKycData] = useState({
        selfie: null,
        cedulaFrente: null,
        cedulaReverso: null,
    });

    const [vehicleDocsData, setVehicleDocsData] = useState({
        carnet: null,
        poliza: null,
    });

    const steps = [
        {
            title: 'Vehículo',
            component: <Step1Vehicle data={vehicleData} onChange={setVehicleData} />,
            isValid: () => vehicleData.marca && vehicleData.modelo && vehicleData.anio && vehicleData.placa,
        },
        {
            title: 'Identidad',
            component: <Step2KYC data={kycData} onChange={setKycData} />,
            isValid: () => kycData.selfie && kycData.cedulaFrente && kycData.cedulaReverso,
        },
        {
            title: 'Documentos',
            component: <Step3VehicleDocs data={vehicleDocsData} onChange={setVehicleDocsData} />,
            isValid: () => vehicleDocsData.carnet && vehicleDocsData.poliza,
        },
    ];

    const currentStep = steps[step];
    const canProceed = currentStep.isValid();

    const handleNext = () => {
        if (step < steps.length - 1) setStep(s => s + 1);
    };

    const handleBack = () => {
        if (step > 0) setStep(s => s - 1);
    };

    const handleSubmit = async () => {
        if (!currentUser) return;
        setSubmitting(true);

        try {
            const uid = currentUser.uid;
            const uploadedUrls = {};

            // Subir imágenes KYC
            setSubmitProgress('Subiendo selfie...');
            uploadedUrls.selfie = await uploadImageToStorage(
                kycData.selfie.base64, kycData.selfie.format,
                `verification/${uid}/selfie_${Date.now()}.${kycData.selfie.format}`
            );

            setSubmitProgress('Subiendo cédula (frente)...');
            uploadedUrls.cedula_frente = await uploadImageToStorage(
                kycData.cedulaFrente.base64, kycData.cedulaFrente.format,
                `verification/${uid}/cedula_frente_${Date.now()}.${kycData.cedulaFrente.format}`
            );

            setSubmitProgress('Subiendo cédula (reverso)...');
            uploadedUrls.cedula_reverso = await uploadImageToStorage(
                kycData.cedulaReverso.base64, kycData.cedulaReverso.format,
                `verification/${uid}/cedula_reverso_${Date.now()}.${kycData.cedulaReverso.format}`
            );

            setSubmitProgress('Subiendo carnet de circulación...');
            uploadedUrls.carnet = await uploadImageToStorage(
                vehicleDocsData.carnet.base64, vehicleDocsData.carnet.format,
                `verification/${uid}/carnet_${Date.now()}.${vehicleDocsData.carnet.format}`
            );

            setSubmitProgress('Subiendo póliza de seguro...');
            uploadedUrls.poliza = await uploadImageToStorage(
                vehicleDocsData.poliza.base64, vehicleDocsData.poliza.format,
                `verification/${uid}/poliza_${Date.now()}.${vehicleDocsData.poliza.format}`
            );

            // Escribir en conductores_verificaciones
            setSubmitProgress('Guardando solicitud...');
            await setDoc(doc(db, 'conductores_verificaciones', uid), {
                status: 'pending',
                submittedAt: serverTimestamp(),
                rejectReason: null,
                vehiculo: {
                    marca: vehicleData.marca,
                    modelo: vehicleData.modelo,
                    anio: vehicleData.anio,
                    placa: vehicleData.placa,
                    tipo: vehicleData.tipo,
                },
                documentos_kyc: {
                    selfie: uploadedUrls.selfie,
                    cedula_frente: uploadedUrls.cedula_frente,
                    cedula_reverso: uploadedUrls.cedula_reverso,
                },
                documentos_vehiculo: {
                    carnet_circulacion: uploadedUrls.carnet,
                    poliza_seguro: uploadedUrls.poliza,
                },
            }, { merge: true });

            // Actualizar perfil del usuario con estado de verificación y datos del vehículo
            setSubmitProgress('Actualizando perfil...');
            await setDoc(doc(db, 'llevame_users', uid), {
                verificationStatus: 'pending',
                vehicleInfo: {
                    model: vehicleData.modelo,
                    plate: vehicleData.placa,
                    color: userProfile?.vehicleInfo?.color || '',
                    type: vehicleData.tipo,
                    marca: vehicleData.marca,
                    anio: vehicleData.anio,
                },
            }, { merge: true });

            // Actualizar contexto local
            updateUserProfile({ verificationStatus: 'pending' });

            setDone(true);
        } catch (error) {
            console.error('Error en verificación:', error);
            alert('Error al enviar documentos: ' + error.message);
        } finally {
            setSubmitting(false);
            setSubmitProgress('');
        }
    };

    // ─── Pantalla de Éxito ────────────────────────────────────────────────
    if (done) {
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <CheckCircle size={48} className="text-green-500" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-3">¡Solicitud Enviada!</h2>
                <p className="text-gray-500 text-base leading-relaxed mb-2">
                    Tu solicitud de verificación fue enviada correctamente.
                </p>
                <p className="text-gray-400 text-sm mb-10">
                    Nuestro equipo revisará tus documentos en las próximas <strong className="text-gray-600">24-48 horas</strong>. Te notificaremos cuando sea aprobado.
                </p>

                <div className="w-full max-w-xs bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8">
                    <p className="text-amber-700 text-sm font-bold">⏳ Estado: En revisión</p>
                    <p className="text-amber-600 text-xs mt-1">Puedes seguir accediendo a la app mientras tanto.</p>
                </div>

                <button
                    onClick={onClose}
                    className="w-full max-w-xs py-4 bg-black text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-all"
                >
                    Entendido, volver al perfil
                </button>
            </div>
        );
    }

    // ─── Pantalla de Carga (subiendo archivos) ────────────────────────────
    if (submitting) {
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin mb-6" />
                <h3 className="text-xl font-black text-gray-900 mb-2">Enviando documentos</h3>
                <p className="text-sm text-indigo-500 font-medium animate-pulse">{submitProgress}</p>
                <p className="text-xs text-gray-400 mt-4">No cierres la aplicación</p>
            </div>
        );
    }

    // ─── Wizard Principal ────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-safe-top pt-12 pb-4 border-b border-gray-100 bg-white">
                <button
                    onClick={step === 0 ? onClose : handleBack}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                    {step === 0 ? <X size={20} /> : <ArrowLeft size={20} />}
                </button>
                <div className="flex-1">
                    <h2 className="font-black text-gray-900 text-lg">Verificar Cuenta</h2>
                    <p className="text-xs text-gray-400">Paso {step + 1} de {steps.length} — {steps[step].title}</p>
                </div>
                <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                    {step + 1}/{steps.length}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-5 py-6">
                    <StepIndicator current={step} total={steps.length} />
                    {steps[step].component}
                </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 border-t border-gray-100 bg-white">
                {!canProceed && (
                    <p className="text-xs text-center text-red-400 mb-3 font-medium flex items-center justify-center gap-1">
                        <AlertCircle size={12} /> Completa todos los campos para continuar
                    </p>
                )}

                {step < steps.length - 1 ? (
                    <button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg ${
                            canProceed
                                ? 'bg-black text-white hover:bg-gray-900 shadow-gray-300'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        Continuar <ArrowRight size={20} />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={!canProceed}
                        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg ${
                            canProceed
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        <Upload size={20} /> Enviar para Verificación
                    </button>
                )}
            </div>
        </div>
    );
};

export default VerificationFlow;
