import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Car, Mail, Lock, ArrowRight, Chrome } from 'lucide-react';

const LoginPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showReset, setShowReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const { loginWithGoogle, loginEmail, signupEmail, resetPassword } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Connectivity Test
        try {
            console.log("Testing connectivity...");
            await fetch('https://www.google.com', { mode: 'no-cors' });
            console.log("Connectivity OK");
        } catch (netErr) {
            console.error("Connectivity Check Failed:", netErr);
            alert("TU DISPOSITIVO NO TIENE INTERNET (No conecta a Google)");
            return;
        }

        console.log("EMAIL FORM SUBMITTED");
        try {
            if (isLogin) {
                await loginEmail(email, password);
            } else {
                await signupEmail(email, password);
            }
            navigate('/');
        } catch (err) {
            setError(err.message.replace('Firebase: ', '').replace('Error ', ''));
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setError('');
            await loginWithGoogle();
            navigate('/'); // Force navigation after native login success
        } catch (err) {
            console.error("Google login error:", err);
            // Show detailed error to user for debugging
            alert(`Error de Login: ${err.message} (${err.code})`);
            setError(`Error: ${err.message}`);
        }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        if (!resetEmail) return;
        try {
            await resetPassword(resetEmail);
            alert('Enlace enviado. Revisa tu correo electrónico para restablecer tu contraseña.');
            setShowReset(false);
            setResetEmail('');
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo Section */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-2xl mb-4 transform hover:scale-110 transition-transform">
                        <Car size={40} className="text-indigo-600" />
                    </div>
                    <h1 className="text-5xl font-black text-white mb-2 tracking-tight">LLEVAME</h1>
                    <p className="text-white/80 text-lg font-medium">Tu viaje comienza aquí</p>
                </div>

                {/* Main Card */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100 flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            {error}
                        </div>
                    )}

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="email"
                                placeholder="Correo electrónico"
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-gray-800 placeholder-gray-400"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="password"
                                placeholder="Contraseña"
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-gray-800 placeholder-gray-400"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {isLogin && (
                            <div className="flex justify-end -mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReset(true)}
                                    className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/60 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                        >
                            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                            <ArrowRight size={20} />
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500 font-medium">o continúa con</span>
                        </div>
                    </div>

                    {/* Social Login */}
                    <button
                        onClick={handleGoogleLogin}
                        type="button"
                        className="w-full py-4 bg-white border-2 border-gray-200 rounded-2xl font-bold text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                    >
                        <Chrome size={24} className="text-indigo-600" />
                        Continuar con Google
                    </button>

                    {/* Toggle Login/Signup */}
                    <div className="mt-8 text-center">
                        <p className="text-gray-600 text-sm">
                            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="ml-2 font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                {isLogin ? 'Regístrate gratis' : 'Inicia Sesión'}
                            </button>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-white/60 text-xs mt-6">
                    Al continuar, aceptas nuestros Términos de Servicio y Política de Privacidad
                </p>
            </div>

            {/* Password Reset Modal - Premium Design */}
            {showReset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-900/40 backdrop-blur-md animate-fade-in">
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-white/50 transform transition-all scale-100 relative overflow-hidden">

                        {/* Decorative Background Blob */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>

                        <div className="text-center mb-6 relative z-10">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl mb-4 shadow-sm">
                                <Mail size={32} className="text-indigo-600" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800">Recuperar Acceso</h3>
                            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                                No te preocupes. Ingresa tu correo y te enviaremos las instrucciones de rescate. 🚀
                            </p>
                        </div>

                        <form onSubmit={handlePasswordReset} className="relative z-10 space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="email"
                                    placeholder="tucorreo@ejemplo.com"
                                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-gray-800 placeholder-gray-400 shadow-sm"
                                    value={resetEmail}
                                    onChange={e => setResetEmail(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReset(false)}
                                    className="flex-1 py-3.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    Enviar Link
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;
