/** Full-width shell for the kitchen dashboard (distinct from the mobile app). */
export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-zinc-100">{children}</div>;
}
