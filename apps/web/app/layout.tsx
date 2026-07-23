import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Employee Payroll Loan Portal',
    template: '%s · Employee Payroll Loan Portal',
  },
  description:
    'Richmond Finance Limited — apply, approve, and manage employer-scheme payroll loans for Zambian employees.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.richmond-afri.com'),
  icons: {
    icon: [{ url: '/richmond-logo.png', type: 'image/png' }],
    apple: '/richmond-logo.png',
  },
  openGraph: {
    title: 'Richmond Finance — Employee Payroll Loan Portal',
    description: 'Finance, Insurance & Advisory. Apply, approve, and manage employer-scheme payroll loans.',
    type: 'website',
    locale: 'en_ZM',
    images: [{ url: '/richmond-logo.png', width: 2048, height: 1447, alt: 'Richmond Finance' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
