export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {children}
    </main>
  )
}