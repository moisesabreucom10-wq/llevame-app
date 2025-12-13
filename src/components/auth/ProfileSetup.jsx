import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';
import { User, Car, Check } from 'lucide-react';

const ProfileSetup = () => {
    const { currentUser } = useAuth();
    const [userType, setUserType] = useState(null); // 'rider' | 'driver'
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSave = async () => {
        if (!userType) return;
        setLoading(true);
        try {
            const userRef = doc(db, 'llevame_users', currentUser.uid);
            await setDoc(userRef, {
                userType: userType,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            navigate('/');
        } catch (error) {
            console.error("Error updating profile:", error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-md">
                <h1 className="text-2xl font-bold text-center mb-2">¿Cómo quieres usar LLEVAME?</h1>
                <p className="text-center text-gray-500 mb-8">Elige tu tipo de perfil para continuar</p>

                <div className="grid grid-cols-1 gap-4 mb-8">
                    <button
                        onClick={() => setUserType('rider')}
                        className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center ${userType === 'rider'
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-indigo-200'
                            }`}
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${userType === 'rider' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>
                            <User size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Pasajero</h3>
                        <p className="text-sm text-gray-500 text-center mt-1">Quiero solicitar viajes</p>

                        {userType === 'rider' && (
                            <div className="absolute top-4 right-4 text-indigo-600">
                                <Check size={24} />
                            </div>
                        )}
                    </button>

                    <button
                        onClick={() => setUserType('driver')}
                        className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center ${userType === 'driver'
                            ? 'border-cyan-600 bg-cyan-50'
                            : 'border-gray-200 bg-white hover:border-cyan-200'
                            }`}
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${userType === 'driver' ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>
                            <Car size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Conductor</h3>
                        <p className="text-sm text-gray-500 text-center mt-1">Quiero ofrecer viajes</p>

                        {userType === 'driver' && (
                            <div className="absolute top-4 right-4 text-cyan-600">
                                <Check size={24} />
                            </div>
                        )}
                    </button>
                </div>

                <button
                    onClick={handleSave}
                    disabled={!userType || loading}
                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${!userType || loading
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-cyan-500 hover:shadow-xl transform hover:-translate-y-1'
                        }`}
                >
                    {loading ? 'Guardando...' : 'Continuar'}
                </button>
            </div>
        </div>
    );
};

export default ProfileSetup;
