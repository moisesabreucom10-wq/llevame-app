import React, { useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Camera as CameraIcon, User, LogOut, Car, Shield, Star, Edit2, CheckCircle, X, MessageCircle, TrendingUp, Lock, Mail, Key, ChevronRight, MessageSquare, AlertCircle, Clock, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { storage, db, auth } from '../../services/firebase';
import { updateProfile, verifyBeforeUpdateEmail, updatePassword } from 'firebase/auth';
import { doc, setDoc, addDoc, serverTimestamp, query, where, orderBy, limit, collection, getDocs, onSnapshot, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import SecureImage from './SecureImage';
import Chat from './Chat';
import VerificationFlow from '../driver/VerificationFlow';

const Profile = () => {
    const { userProfile, logout, currentUser, updateUserProfile } = useAuth();
    const navigate = useNavigate();
    const [image, setImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    const [isEditingVehicle, setIsEditingVehicle] = useState(false);
    const [showVerificationFlow, setShowVerificationFlow] = useState(false);

    // Identity editing state
    const [isEditingIdentity, setIsEditingIdentity] = useState(false);
    const [identityForm, setIdentityForm] = useState({ firstName: '', lastName: '', alias: '', cedula: '', cedulaPrefix: 'V' });
    const [identityError, setIdentityError] = useState('');
    const [savingIdentity, setSavingIdentity] = useState(false);

    // Feedback State
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');

    // Name Editing State
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

    // Inbox / Chat State
    const [chatList, setChatList] = useState([]);
    const [selectedChatTrip, setSelectedChatTrip] = useState(null);

    // Security State
    const [showSecurity, setShowSecurity] = useState(false);
    const [securityForm, setSecurityForm] = useState({
        email: '',
        password: ''
    });

    // Initialize state directly from localStorage
    const [localPhotoUrl, setLocalPhotoUrl] = useState(() => {
        try {
            const stored = localStorage.getItem('userProfile');
            if (stored) {
                const p = JSON.parse(stored);
                if (p && p.photoURL) return p.photoURL;
            }
        } catch (e) { }
        return null;
    });

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const handleSendFeedback = async () => {
        if (!feedbackText.trim()) return;
        setUploading(true);
        try {
            await addDoc(collection(db, 'llevame_feedback'), {
                userId: currentUser.uid,
                userName: userProfile.name || 'Usuario',
                userEmail: userProfile.email || 'Sin correo',
                content: feedbackText,
                createdAt: serverTimestamp(),
                status: 'new', // new, read, archived
                platform: 'app'
            });
            setFeedbackText('');
            setShowFeedback(false);
            alert("¡Gracias! Tu sugerencia ha sido enviada.");
        } catch (error) {
            console.error("Error sending feedback:", error);
            alert("Error al enviar sugerencia.");
        } finally {
            setUploading(false);
        }
    };

    const handlePhotoUpdate = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt
            });

            if (image.base64String) {
                setUploading(true);
                setProgressMsg('Preparando imagen...');

                const optimisticUrl = `data:image/${image.format};base64,${image.base64String}`;
                setLocalPhotoUrl(optimisticUrl);

                const byteCharacters = atob(image.base64String);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: `image/${image.format}` });

                setProgressMsg('Subiendo a Firebase...');
                const filename = `profiles/${currentUser.uid}_${Date.now()}.${image.format}`;
                const storageRef = ref(storage, filename);

                const snapshot = await uploadBytes(storageRef, blob);
                setProgressMsg('Obteniendo enlace...');

                const downloadURL = await getDownloadURL(snapshot.ref);

                setProgressMsg('Guardando perfil...');

                if (auth.currentUser) {
                    await updateProfile(auth.currentUser, { photoURL: downloadURL });
                }

                await setDoc(doc(db, 'llevame_users', currentUser.uid), {
                    photoURL: downloadURL
                }, { merge: true });

                setLocalPhotoUrl(downloadURL);
                updateUserProfile({ photoURL: downloadURL });

                alert('¡Foto actualizada con éxito!');
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert('Error al actualizar foto: ' + (error.message || error));
            setLocalPhotoUrl(null);
        } finally {
            setUploading(false);
            setProgressMsg('');
        }
    };

    // Fetch Recent Chats
    React.useEffect(() => {
        if (!currentUser) return;

        const fetchChats = async () => {
            try {
                const qRider = query(collection(db, 'llevame_trips'), where('riderId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(5));
                const qDriver = query(collection(db, 'llevame_trips'), where('driverId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(5));

                const [snapRider, snapDriver] = await Promise.all([getDocs(qRider), getDocs(qDriver)]);

                let chats = [];
                snapRider.forEach(doc => chats.push({ id: doc.id, ...doc.data(), role: 'rider' }));
                snapDriver.forEach(doc => chats.push({ id: doc.id, ...doc.data(), role: 'driver' }));

                chats.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                const uniqueChats = chats.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i);

                setChatList(uniqueChats);
            } catch (err) {
                console.error("Error fetching chats:", err);
            }
        };

        fetchChats();
    }, [currentUser]);

    const handleSaveName = async () => {
        if (!tempName.trim()) return;
        try {
            setUploading(true);
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: tempName });
            }
            await setDoc(doc(db, 'llevame_users', currentUser.uid), {
                name: tempName
            }, { merge: true });
            updateUserProfile({ name: tempName });
            setIsEditingName(false);
            alert('Nombre actualizado.');
        } catch (error) {
            console.error("Error updating name:", error);
            alert("Error al actualizar nombre.");
        } finally {
            setUploading(false);
        }
    };

    // ─── Guardar datos de identidad (con validación de unicidad) ────────────
    const handleSaveIdentity = async () => {
        setIdentityError('');
        const { firstName, lastName, alias, cedula, cedulaPrefix } = identityForm;

        if (!firstName.trim() || !lastName.trim()) {
            return setIdentityError('El nombre y apellido son obligatorios.');
        }

        // Validar formato de cédula si se ingresa
        const cedulaRaw = cedula.replace(/[^0-9]/g, '');
        if (cedula && (cedulaRaw.length < 6 || cedulaRaw.length > 8)) {
            return setIdentityError('La cédula debe tener entre 6 y 8 dígitos.');
        }

        // Validar alias: solo letras, números, guiones bajos
        const cleanAlias = alias.replace(/^@/, '').trim();
        if (alias && !/^[a-zA-Z0-9_]{3,20}$/.test(cleanAlias)) {
            return setIdentityError('El alias solo puede tener letras, números y _ (3-20 caracteres).');
        }

        setSavingIdentity(true);
        try {
            const uid = currentUser.uid;
            const updates = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                name: `${firstName.trim()} ${lastName.trim()}`,
            };

            // ── Verificar unicidad de cédula ──
            if (cedula) {
                const cedulaId = `${cedulaPrefix}-${cedulaRaw}`;
                const cedulaRef = doc(db, 'cedulas_index', cedulaId);
                const cedulaSnap = await getDoc(cedulaRef);

                if (cedulaSnap.exists() && cedulaSnap.data().uid !== uid) {
                    setSavingIdentity(false);
                    return setIdentityError('Esta cédula ya está registrada por otro usuario.');
                }

                // Guardar índice
                await setDoc(cedulaRef, { uid, registeredAt: serverTimestamp() });
                updates.cedula = cedulaId;
                updates.cedulaDisplay = `${cedulaPrefix}-${cedulaRaw.replace(/(\d)(?=(\d{3})+$)/g, '$1.')}`;
            }

            // ── Verificar unicidad de alias ──
            if (cleanAlias) {
                const aliasRef = doc(db, 'aliases_index', cleanAlias.toLowerCase());
                const aliasSnap = await getDoc(aliasRef);

                if (aliasSnap.exists() && aliasSnap.data().uid !== uid) {
                    setSavingIdentity(false);
                    return setIdentityError('Este alias ya está en uso por otro usuario.');
                }

                await setDoc(aliasRef, { uid });
                updates.alias = `@${cleanAlias.toLowerCase()}`;
            }

            // Guardar en perfil
            await setDoc(doc(db, 'llevame_users', uid), updates, { merge: true });
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: updates.name });
            }
            updateUserProfile(updates);
            setIsEditingIdentity(false);
        } catch (err) {
            console.error('Error guardando identidad:', err);
            setIdentityError('Error al guardar: ' + err.message);
        } finally {
            setSavingIdentity(false);
        }
    };

    const handleChangeEmail = async () => {
        if (!securityForm.email || !securityForm.email.includes('@')) return alert("Email inválido");
        try {
            setUploading(true);
            await verifyBeforeUpdateEmail(auth.currentUser, securityForm.email);
            alert(`Se ha enviado un enlace de verificación a ${securityForm.email}. Por favor revísalo para confirmar el cambio.`);
            setSecurityForm(prev => ({ ...prev, email: '' }));
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Por seguridad, debes cerrar sesión y volver a ingresar para cambiar tu correo.");
            } else {
                alert("Error: " + error.message);
            }
        } finally {
            setUploading(false);
        }
    };

    const handleChangePassword = async () => {
        if (securityForm.password.length < 6) return alert("La contraseña debe tener al menos 6 caracteres");
        try {
            setUploading(true);
            await updatePassword(auth.currentUser, securityForm.password);
            alert("Contraseña actualizada exitosamente.");
            setSecurityForm(prev => ({ ...prev, password: '' }));
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Por seguridad, debes cerrar sesión y volver a ingresar para cambiar tu contraseña.");
            } else {
                alert("Error: " + error.message);
            }
        } finally {
            setUploading(false);
        }
    };

    if (!userProfile) return <div className="p-8 text-center">Cargando perfil...</div>;

    const getInitials = () => {
        const fullName = userProfile?.firstName
            ? `${userProfile.firstName} ${userProfile.lastName || ''}`
            : (userProfile?.name || 'U');
        return fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const displayName = userProfile?.firstName
        ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim()
        : (userProfile?.name || 'Usuario');

    const isDriver = userProfile.userType === 'driver';
    const displayPhoto = localPhotoUrl || userProfile.photoURL;

    return (
        <div className="h-full bg-gray-50 overflow-y-auto pb-24">
            {/* Header */}
            <div className="bg-black text-white p-6 pt-12 pb-16 rounded-b-[2.5rem] shadow-lg relative z-0">
                <div className="flex flex-col items-center">
                    <div className="relative group">
                        <div className="w-28 h-28 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full p-1 mb-4 shadow-xl overflow-hidden">
                            {displayPhoto ? (
                                <SecureImage
                                    src={displayPhoto}
                                    alt="Profile"
                                    className="w-full h-full rounded-full object-cover border-4 border-black"
                                    fallback={
                                        <div className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center text-4xl font-bold border-4 border-black">
                                            {getInitials()}
                                        </div>
                                    }
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center text-4xl font-bold border-4 border-black">
                                    {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : <User />}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handlePhotoUpdate}
                            disabled={uploading}
                            className={`absolute bottom-0 right-0 p-3 rounded-full text-white shadow-lg transition-transform hover:scale-110 active:scale-95 ${uploading ? 'bg-gray-500 cursor-not-allowed' : 'bg-yellow-400 hover:bg-yellow-500 text-black'
                                } `}
                        >
                            <CameraIcon size={20} />
                        </button>
                    </div>

                    {uploading && (
                        <div className="text-sm font-medium text-yellow-400 mt-2 animate-pulse">
                            {progressMsg || 'Procesando...'}
                        </div>
                    )}

                    {isEditingName ? (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <input
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                className="bg-transparent text-white font-bold text-2xl text-center border-b-2 border-yellow-400 focus:outline-none px-2 w-48"
                                autoFocus
                            />
                            <button
                                onClick={handleSaveName}
                                className="p-1.5 bg-green-500 rounded-full text-white hover:bg-green-600 transition-colors shadow-lg"
                            >
                                <CheckCircle size={20} />
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditingName(false);
                                    setTempName(userProfile.name || '');
                                }}
                                className="p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors shadow-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold">{displayName}</h2>
                                {userProfile?.alias && <p className="text-gray-400 text-sm mt-0.5">{userProfile.alias}</p>}
                                {userProfile?.cedula && (
                                    <p className="text-gray-500 text-xs mt-0.5 font-mono">
                                        CI: {userProfile.cedulaDisplay || userProfile.cedula}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setTempName(userProfile.name || '');
                                    setIsEditingName(true);
                                }}
                                className="p-1.5 bg-white/10 rounded-full text-gray-300 hover:text-white hover:bg-white/20 transition-colors"
                            >
                                <Edit2 size={16} />
                            </button>
                        </div>
                    )}
                    <p className="text-gray-400 text-sm mt-1">{userProfile.email}</p>

                    <div className="mt-4 flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full">
                        {isDriver ? <Car size={16} className="text-yellow-400" /> : <User size={16} className="text-blue-400" />}
                        <span className="text-sm font-medium">
                            {isDriver ? 'Conductor' : 'Pasajero'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="px-6 -mt-8 relative z-10 grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl mb-3">
                        <TrendingUp size={24} />
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{userProfile.tripsCompleted || 0}</span>
                    <span className="text-xs text-gray-500 font-medium">Viajes Realizados</span>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl mb-3">
                        <Shield size={24} />
                    </div>
                    <span className="text-2xl font-bold text-gray-900">
                        {userProfile.rating ? Number(userProfile.rating).toFixed(1) : 'New'}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                        {userProfile.ratingCount ? `${userProfile.ratingCount} Reseñas` : 'Sin Calif.'}
                    </span>
                </div>
            </div>

            {/* ── INFORMACIÓN PERSONAL (nombre, apellido, alias, cédula) ── */}
            <div className="px-6 mt-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        onClick={() => {
                            setIdentityForm({
                                firstName: userProfile?.firstName || '',
                                lastName: userProfile?.lastName || '',
                                alias: (userProfile?.alias || '').replace(/^@/, ''),
                                cedula: (userProfile?.cedula || '').replace(/^[VE]-/, ''),
                                cedulaPrefix: userProfile?.cedula?.startsWith('E') ? 'E' : 'V',
                            });
                            setIdentityError('');
                            setIsEditingIdentity(!isEditingIdentity);
                        }}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <User size={20} />
                            </div>
                            <span className="font-bold text-gray-800">Información Personal</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {userProfile?.cedula && (
                                <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle size={10} /> Cédula registrada
                                </span>
                            )}
                            <ChevronRight className={`text-gray-400 transition-transform ${isEditingIdentity ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {isEditingIdentity && (
                        <div className="p-4 pt-2 space-y-4 border-t border-gray-100">

                            {/* Nombre y Apellido */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nombre *</label>
                                    <input
                                        type="text"
                                        value={identityForm.firstName}
                                        onChange={e => setIdentityForm(p => ({ ...p, firstName: e.target.value }))}
                                        placeholder="Juan"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Apellido *</label>
                                    <input
                                        type="text"
                                        value={identityForm.lastName}
                                        onChange={e => setIdentityForm(p => ({ ...p, lastName: e.target.value }))}
                                        placeholder="Pérez"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Alias */}
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Alias (usuario único)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">@</span>
                                    <input
                                        type="text"
                                        value={identityForm.alias}
                                        onChange={e => setIdentityForm(p => ({ ...p, alias: e.target.value.replace(/^@/, '').replace(/ /g, '_') }))}
                                        placeholder="juancho23"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Cédula */}
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Cédula de Identidad</label>
                                <div className="flex gap-2">
                                    <select
                                        value={identityForm.cedulaPrefix}
                                        onChange={e => setIdentityForm(p => ({ ...p, cedulaPrefix: e.target.value }))}
                                        className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="V">V</option>
                                        <option value="E">E</option>
                                    </select>
                                    <input
                                        type="tel"
                                        value={identityForm.cedula}
                                        onChange={e => setIdentityForm(p => ({ ...p, cedula: e.target.value.replace(/[^0-9]/g, '') }))}
                                        placeholder="12345678"
                                        maxLength={8}
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                {userProfile?.cedula && (
                                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                        <Shield size={10} /> Cédula actual: <span className="font-mono font-bold">{userProfile.cedulaDisplay || userProfile.cedula}</span>
                                    </p>
                                )}
                            </div>

                            {identityError && (
                                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                                    <p className="text-xs text-red-700 font-medium">{identityError}</p>
                                </div>
                            )}

                            <button
                                onClick={handleSaveIdentity}
                                disabled={savingIdentity}
                                className="w-full py-3 bg-black text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {savingIdentity ? 'Guardando...' : 'Guardar Información'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Security Section */}
            <div className="px-6 mt-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        onClick={() => setShowSecurity(!showSecurity)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                <Lock size={20} />
                            </div>
                            <span className="font-bold text-gray-800">Seguridad de la Cuenta</span>
                        </div>
                        <ChevronRight className={`text-gray-400 transition-transform ${showSecurity ? 'rotate-90' : ''}`} />
                    </button>

                    {showSecurity && (
                        <div className="p-4 pt-0 space-y-6 border-t border-gray-100 animate-slide-up">
                            {/* Change Email */}
                            <div className="space-y-2 pt-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                                    <Mail size={12} /> Cambiar Correo
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-colors"
                                        placeholder={userProfile.email}
                                        value={securityForm.email}
                                        onChange={e => setSecurityForm({ ...securityForm, email: e.target.value })}
                                    />
                                    <button
                                        onClick={handleChangeEmail}
                                        disabled={!securityForm.email || uploading}
                                        className="px-4 bg-black text-white rounded-xl font-bold text-sm shadow-md hover:bg-gray-800 disabled:opacity-50"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>

                            {/* Change Password */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                                    <Key size={12} /> Cambiar Contraseña
                                </label>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="password"
                                        placeholder="Nueva contraseña"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-colors"
                                        value={securityForm.password}
                                        onChange={e => setSecurityForm({ ...securityForm, password: e.target.value })}
                                    />
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={!securityForm.password || uploading}
                                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
                                    >
                                        Actualizar Contraseña
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Driver Vehicle Editing Form */}
            {isDriver && (
                <div className="px-6 mt-6">
                    <div className="bg-white p-5 rounded-3xl shadow-md transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Información del Vehículo</h3>
                            {/* Edit Toggle */}
                            {!isEditingVehicle ? (
                                <button
                                    onClick={() => setIsEditingVehicle(true)}
                                    className="text-indigo-600 text-xs font-bold px-3 py-1 bg-indigo-50 rounded-full hover:bg-indigo-100"
                                >
                                    EDITAR
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsEditingVehicle(false)}
                                    className="text-gray-500 text-xs font-bold px-3 py-1 hover:bg-gray-100 rounded-full"
                                >
                                    CANCELAR
                                </button>
                            )}
                        </div>

                        {!isEditingVehicle ? (
                            // READ ONLY VIEW
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                        {userProfile.vehicleInfo?.type === 'motorcycle' ? <div className="text-xl">🛵</div> : <Car size={24} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-lg">{userProfile.vehicleInfo?.model || 'Sin registrar'}</p>
                                        <p className="text-sm text-gray-500">{userProfile.vehicleInfo?.color || 'Color?'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="bg-yellow-300 px-2 py-0.5 rounded text-xs font-bold border border-black text-black mb-1 inline-block">
                                        {userProfile.vehicleInfo?.plate || '---'}
                                    </div>
                                    <p className="text-xs text-gray-400">{userProfile.phoneNumber || 'Sin Móvil'}</p>
                                </div>
                            </div>
                        ) : (
                            // EDIT FORM VIEW
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.target);
                                const vehicleData = {
                                    model: formData.get('model'),
                                    plate: formData.get('plate'),
                                    color: formData.get('color'),
                                    type: formData.get('type') // 'car' or 'motorcycle'
                                };

                                try {
                                    setUploading(true);
                                    setProgressMsg('Guardando datos...');

                                    // Update Firestore
                                    await setDoc(doc(db, 'llevame_users', currentUser.uid), {
                                        vehicleInfo: vehicleData,
                                        phoneNumber: formData.get('phoneNumber')
                                    }, { merge: true });

                                    // Update Context
                                    updateUserProfile({
                                        vehicleInfo: vehicleData,
                                        phoneNumber: formData.get('phoneNumber')
                                    });

                                    setIsEditingVehicle(false); // Close form on success
                                    alert('¡Información actualizada!');
                                } catch (error) {
                                    console.error(error);
                                    alert('Error al guardar.');
                                } finally {
                                    setUploading(false);
                                }
                            }} className="space-y-4 animate-fadeIn">

                                {/* Model */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 ml-1">Modelo / Marca</label>
                                    <input
                                        name="model"
                                        defaultValue={userProfile.vehicleInfo?.model || ''}
                                        placeholder="Ej: Toyota Corolla"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Plate */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 ml-1">Placa</label>
                                        <input
                                            name="plate"
                                            defaultValue={userProfile.vehicleInfo?.plate || ''}
                                            placeholder="ABC-123"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all uppercase"
                                            required
                                        />
                                    </div>
                                    {/* Color */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 ml-1">Color</label>
                                        <input
                                            name="color"
                                            defaultValue={userProfile.vehicleInfo?.color || ''}
                                            placeholder="Ej: Rojo"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 ml-1">Teléfono de Contacto</label>
                                    <input
                                        name="phoneNumber"
                                        type="tel"
                                        defaultValue={userProfile.phoneNumber || ''}
                                        placeholder="+58 412 1234567"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>

                                {/* Vehicle Type Radio */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 ml-1 mb-2 block">Tipo de Vehículo</label>
                                    <div className="flex gap-4">
                                        <label className="flex-1 cursor-pointer">
                                            <input type="radio" name="type" value="car" defaultChecked={userProfile.vehicleInfo?.type !== 'motorcycle'} className="peer sr-only" />
                                            <div className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-gray-100 peer-checked:border-black peer-checked:bg-black peer-checked:text-white transition-all">
                                                <Car size={24} className="mb-1" />
                                                <span className="text-xs font-bold">Carro</span>
                                            </div>
                                        </label>
                                        <label className="flex-1 cursor-pointer">
                                            <input type="radio" name="type" value="motorcycle" defaultChecked={userProfile.vehicleInfo?.type === 'motorcycle'} className="peer sr-only" />
                                            <div className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-gray-100 peer-checked:border-black peer-checked:bg-black peer-checked:text-white transition-all">
                                                {/* Moto Icon Placeholder */}
                                                <div className="font-bold text-lg">🛵</div>
                                                <span className="text-xs font-bold mt-1">Moto</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform mt-2">
                                    Guardar Cambios
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ---- SECCIÓN DE VERIFICACIÓN (solo para conductores) ---- */}
            {isDriver && (() => {
                const vs = userProfile?.verificationStatus;
                const isVerified = userProfile?.isVerified;

                if (isVerified || vs === 'approved') {
                    return (
                        <div className="px-6 mt-6">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                                    <CheckCircle size={22} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-emerald-800">Cuenta Verificada ✓</p>
                                    <p className="text-xs text-emerald-600 mt-0.5">Tu perfil está activo y puedes recibir viajes</p>
                                </div>
                            </div>
                        </div>
                    );
                }

                if (vs === 'pending') {
                    return (
                        <div className="px-6 mt-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                                    <Clock size={22} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-amber-800">Verificación en proceso</p>
                                    <p className="text-xs text-amber-600 mt-0.5">Nuestro equipo revisará tus documentos en 24-48h</p>
                                </div>
                            </div>
                        </div>
                    );
                }

                if (vs === 'rejected') {
                    return (
                        <div className="px-6 mt-6">
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-red-100 rounded-xl text-red-600">
                                        <XCircle size={22} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-red-800">Verificación Rechazada</p>
                                        {userProfile?.verificationRejectReason && (
                                            <p className="text-xs text-red-600 mt-0.5">{userProfile.verificationRejectReason}</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowVerificationFlow(true)}
                                    className="w-full mt-2 py-3 bg-red-600 text-white font-bold rounded-xl text-sm active:scale-95 transition-all"
                                >
                                    Reenviar Documentos
                                </button>
                            </div>
                        </div>
                    );
                }

                // No verificado — mostrar botón de inicio
                return (
                    <div className="px-6 mt-6">
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 shadow-lg shadow-indigo-200">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <Shield size={22} className="text-white" />
                                </div>
                                <div>
                                    <p className="font-black text-white">¡Verifica tu cuenta!</p>
                                    <p className="text-xs text-indigo-200">Necesario para recibir viajes</p>
                                </div>
                            </div>
                            <p className="text-indigo-100 text-xs mb-4 leading-relaxed">
                                Sube tu cédula, una selfie y los documentos de tu vehículo para que tu equipo te apruebe.
                            </p>
                            <button
                                onClick={() => setShowVerificationFlow(true)}
                                className="w-full py-3 bg-white text-indigo-700 font-black rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                            >
                                <Shield size={16} /> Iniciar Verificación
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Modal de Verificación */}
            {showVerificationFlow && (
                <VerificationFlow onClose={() => setShowVerificationFlow(false)} />
            )}

            {/* Menu Options - FEEDBACK BUTTON */}
            <div className="px-6 mt-6 space-y-4">
                <button
                    onClick={() => setShowFeedback(true)}
                    className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:bg-gray-50 transition-colors"
                >
                    <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl">
                        <MessageSquare size={20} />
                    </div>
                    <span className="font-bold text-gray-700 flex-1 text-left">Enviar Sugerencia</span>
                    <ChevronRight className="text-gray-300" size={20} />
                </button>
            </div>

            {/* Feedback Modal */}
            {showFeedback && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                        <h3 className="text-xl font-black text-gray-900 mb-2">Tu Opinión Importa</h3>
                        <p className="text-gray-500 text-sm mb-4">¿Cómo podemos mejorar LLEVAME? Cuéntanos tu idea o problema.</p>

                        <textarea
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 min-h-[120px] resize-none"
                            placeholder="Escribe aquí tu sugerencia..."
                            value={feedbackText}
                            onChange={e => setFeedbackText(e.target.value)}
                            autoFocus
                        />

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowFeedback(false)}
                                className="flex-1 py-3 text-gray-500 font-bold rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendFeedback}
                                disabled={!feedbackText.trim() || uploading}
                                className="flex-1 py-3 bg-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-200 hover:bg-yellow-500 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {uploading ? 'Enviando...' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inbox / Recent Messages Section */}
            <div className="px-6 mt-6 mb-8">
                <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                    <MessageCircle size={20} className="text-blue-600" />
                    Mensajes Recientes
                </h3>

                <div className="space-y-3">
                    {chatList.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4">No hay conversaciones recientes.</p>
                    ) : (
                        chatList.map(trip => {
                            const isMeRider = trip.riderId === currentUser.uid;
                            const otherName = isMeRider ? trip.driverName : trip.riderName;
                            const otherPhoto = isMeRider ? trip.driverPhoto : trip.riderPhoto;
                            const tripDate = trip.createdAt?.seconds ? new Date(trip.createdAt.seconds * 1000).toLocaleDateString() : '';

                            return (
                                <div
                                    key={trip.id}
                                    onClick={() => setSelectedChatTrip(trip)}
                                    className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 active:scale-98 transition-transform"
                                >
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                        {otherPhoto ? (
                                            <img src={otherPhoto} alt="User" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                                                {otherName?.[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <p className="font-bold text-gray-800 truncate">{otherName || 'Usuario'}</p>
                                            <span className="text-[10px] text-gray-400">{tripDate}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                            {trip.pickup?.address || 'Viaje finalizado'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Logout Button */}
            <div className="px-6 mt-4 pb-12">
                <button
                    onClick={async () => {
                        await logout();
                        navigate('/login');
                    }}
                    className="w-full py-4 bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-300 transition-colors"
                >
                    <LogOut size={20} />
                    Cerrar Sesión
                </button>
            </div>

            {/* Chat Modal Implementation */}
            {selectedChatTrip && (
                <div className="fixed inset-0 z-[100]">
                    <Chat
                        tripId={selectedChatTrip.id}
                        currentUser={currentUser}
                        otherUserName={selectedChatTrip.riderId === currentUser.uid ? selectedChatTrip.driverName : selectedChatTrip.riderName}
                        otherUserDecoratedName={selectedChatTrip.riderId === currentUser.uid ? 'Conductor' : 'Pasajero'}
                        onClose={() => setSelectedChatTrip(null)}
                    />
                </div>
            )}
            <div className="text-center text-gray-400 text-xs pt-8 pb-8">
                LLEVAME App v1.0.0 (Beta)
            </div>
        </div>
    );
};

export default Profile;
