import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

const LABELS = ['', 'Malo', 'Regular', 'Bien', 'Muy bien', 'Excelente'];

const RatingModal = ({ isOpen, onClose, trip }) => {
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !trip) return null;

    const handleSubmit = async () => {
        if (rating === 0) return;
        setSubmitting(true);
        try {
            await updateDoc(doc(db, 'llevame_trips', trip.id), {
                riderRating: rating,
                riderComment: comment.trim() || null,
                ratedAt: serverTimestamp(),
            });
            window.showInAppNotification?.(
                'trip_completed',
                '¡Gracias!',
                `Calificaste con ${rating} estrella${rating > 1 ? 's' : ''}`
            );
            onClose();
        } catch {
            window.showInAppNotification?.(
                'trip_cancelled', 'Error', 'No se pudo guardar la calificación'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const active = hovered || rating;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xl font-bold text-gray-900">¿Cómo fue tu viaje?</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {trip.driverName && (
                    <p className="text-sm text-gray-500 mb-6">
                        Califica tu experiencia con{' '}
                        <span className="font-semibold text-gray-700">{trip.driverName}</span>
                    </p>
                )}

                {/* Stars */}
                <div className="flex justify-center gap-2 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                        <button
                            key={star}
                            onMouseEnter={() => setHovered(star)}
                            onMouseLeave={() => setHovered(0)}
                            onClick={() => setRating(star)}
                            className="p-1 transition-transform active:scale-90"
                        >
                            <Star
                                size={44}
                                className={`transition-colors duration-100 ${
                                    star <= active
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-gray-200 fill-gray-200'
                                }`}
                            />
                        </button>
                    ))}
                </div>

                <p className={`text-center font-bold text-base mb-5 transition-opacity duration-200 ${rating > 0 ? 'text-gray-700 opacity-100' : 'opacity-0'}`}>
                    {LABELS[rating]}
                </p>

                {/* Comment */}
                <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Comentario opcional..."
                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-indigo-400 transition-colors"
                    rows={3}
                    maxLength={200}
                />

                {/* Actions */}
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        Omitir
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={rating === 0 || submitting}
                        className={`flex-[2] py-3 rounded-xl font-bold text-white transition-all ${
                            rating === 0
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-black hover:bg-gray-800 active:scale-95'
                        }`}
                    >
                        {submitting ? 'Enviando...' : 'Calificar viaje'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RatingModal;
