import Header from '@/react-app/components/Header';
import Footer from '@/react-app/components/Footer';
import AdminDashboard from '@/react-app/components/AdminDashboard';

export default function AdminPage() {
  return (
    <div className="min-h-screen text-white">
      <Header />
      <AdminDashboard />
      <Footer />
    </div>
  );
}
