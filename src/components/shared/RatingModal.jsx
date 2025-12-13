import React from 'react';

const RatingModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 10
            }}>
                <h2>Califica tu viaje</h2>
                <button onClick={onClose} style={{ marginTop: 10, padding: 10, background: 'black', color: 'white' }}>
                    Cerrar (Test)
                </button>
            </div>
        </div>
    );
};

export default RatingModal;
