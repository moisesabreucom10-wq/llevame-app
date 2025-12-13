import React, { useState, useEffect, useRef } from 'react';
import { Send, X, User, Phone } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { notificationService } from '../../services/NotificationService';

const Chat = ({ tripId, currentUser, otherUserName, onClose, otherUserDecoratedName, isDriver = false }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const [previousMessageCount, setPreviousMessageCount] = useState(0);

    // Auto-scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Listen to messages in real-time
    useEffect(() => {
        if (!tripId) return;

        const messagesRef = collection(db, 'llevame_trips', tripId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // NOTIFICACIÓN: Si hay nuevo mensaje de la otra persona
            if (msgs.length > previousMessageCount && previousMessageCount > 0) {
                const lastMsg = msgs[msgs.length - 1];
                // Solo notificar si el mensaje NO es mío
                if (lastMsg.senderId !== currentUser.uid) {
                    notificationService.notifyNewMessage(
                        lastMsg.senderName || otherUserName,
                        lastMsg.text,
                        isDriver
                    );
                }
            }
            setPreviousMessageCount(msgs.length);

            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [tripId, currentUser, otherUserName, isDriver, previousMessageCount]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const text = newMessage.trim();
            setNewMessage(''); // Clear input immediately for better UX

            await addDoc(collection(db, 'llevame_trips', tripId, 'messages'), {
                text: text,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'Usuario',
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error sending message:", error);
            alert("No se pudo enviar el mensaje");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-slideUp">
            {/* Header */}
            <div className="bg-black text-white p-4 pt-safe-top flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 -ml-2 rounded-full active:bg-white/20">
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center border-2 border-yellow-400">
                            <User size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-none">{otherUserName}</h3>
                            <span className="text-xs text-yellow-400 font-medium tracking-wide">
                                {otherUserDecoratedName || 'En viaje'}
                            </span>
                        </div>
                    </div>
                </div>
                {/* Optional: Add Phone Call button here later */}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 bg-opacity-90 space-y-3">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-2">
                            <span className="text-2xl">💬</span>
                        </div>
                        <p className="text-sm font-medium">Inicia la conversación</p>
                    </div>
                )}

                {messages.map((msg) => {
                    const isMe = msg.senderId === currentUser.uid;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[80%] rounded-2xl px-4 py-3 shadow-sm text-sm font-medium
                                ${isMe
                                    ? 'bg-black text-white rounded-tr-none'
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}
                            `}>
                                <p>{msg.text}</p>
                                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-gray-400' : 'text-gray-400'}`}>
                                    {msg.createdAt?.seconds
                                        ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : '...'}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100 pb-safe-bottom">
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 bg-gray-100 text-gray-900 placeholder-gray-500 rounded-full px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-black transition-all font-medium"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-yellow-400 text-black p-3.5 rounded-full shadow-lg disabled:opacity-50 disabled:shadow-none hover:bg-yellow-500 active:scale-95 transition-all"
                    >
                        <Send size={20} className="ml-0.5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chat;
