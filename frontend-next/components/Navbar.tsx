import React from 'react';
import Link from 'next/link';

const Navbar: React.FC = () => (
  <nav style={{ padding: 16, background: '#f5f5f5', marginBottom: 24 }}>
    <Link href="/" style={{ marginRight: 24, fontWeight: 'bold' }}>Início</Link>
    <Link href="/advanced" style={{ fontWeight: 'bold', color: '#0070f3' }}>RabbitMQ Avançado</Link>
  </nav>
);

export default Navbar;
