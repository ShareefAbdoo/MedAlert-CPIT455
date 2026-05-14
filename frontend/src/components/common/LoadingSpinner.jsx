import React from 'react';

export default function LoadingSpinner({ size = 'md', center = false }) {
  const px = size === 'lg' ? '3rem' : size === 'sm' ? '1.25rem' : '2rem';
  const style = {
    width: px, height: px,
    border: '3px solid #dbeafe',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  };
  if (center) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
        <div style={style} />
      </div>
    );
  }
  return <div style={style} />;
}
