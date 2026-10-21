import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smart CNX',
  description: 'Sistema Centralizado de Controle de Estoque',
  icons: {
    // O parâmetro ?v=1 força o navegador a ignorar o cache antigo
    icon: '/Imagens/Logo.png?v=1',
    shortcut: '/Imagens/Logo.png?v=1',
    apple: '/Imagens/Logo.png?v=1',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}