import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Map, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Layout = () => {
    const { userProfile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isDriver = userProfile?.userType === 'driver';

    const navItems = isDriver ? [
        { icon: Home, label: 'Inicio', path: '/' },
        { icon: Map, label: 'Viajes', path: '/trips' },
        { icon: User, label: 'Perfil', path: '/profile' },
    ] : [
        { icon: Home, label: 'Inicio', path: '/' },
        { icon: Map, label: 'Mis Viajes', path: '/history' },
        { icon: User, label: 'Perfil', path: '/profile' },
    ];

    const handleNavigation = (path) => {
        navigate(path);
    };

    return (
        <div className="h-screen bg-slate-50 flex flex-col">
            {/* Main Content Area */}
            <main className="flex-1 relative overflow-hidden">
                <div className="h-full w-full">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Navigation with Improved Animations */}
            <nav className="bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] shadow-lg">
                <div className="flex justify-around items-center h-16 relative">
                    {/* Active Indicator */}
                    <div
                        className="absolute top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300 ease-out rounded-full"
                        style={{
                            width: `${100 / navItems.length}%`,
                            left: `${(navItems.findIndex(item => item.path === location.pathname) * 100) / navItems.length}%`
                        }}
                    />

                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => handleNavigation(item.path)}
                                className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative transition-all duration-300 ${isActive
                                        ? 'text-indigo-600 scale-110'
                                        : 'text-gray-400 hover:text-gray-600 active:scale-95'
                                    }`}
                            >
                                {/* Icon with bounce animation when active */}
                                <div className={`transition-transform duration-300 ${isActive ? 'animate-bounce-subtle' : ''}`}>
                                    <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                </div>

                                {/* Label with fade effect */}
                                <span className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'opacity-100 font-semibold' : 'opacity-70'
                                    }`}>
                                    {item.label}
                                </span>

                                {/* Active dot indicator */}
                                {isActive && (
                                    <div className="absolute -bottom-1 w-1 h-1 bg-indigo-600 rounded-full animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* CSS Animations */}
            <style>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 0.6s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default Layout;
