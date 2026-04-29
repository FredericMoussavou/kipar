export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-start">
      {children}
    </main>
  )
}
