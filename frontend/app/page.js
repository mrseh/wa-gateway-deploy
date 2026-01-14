// Main Landing Page
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            WhatsApp Gateway SaaS
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Professional WhatsApp API untuk monitoring jaringan Anda
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/login"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Login
            </a>
            <a
              href="/register"
              className="px-6 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition"
            >
              Daftar Gratis
            </a>
          </div>
        </header>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-3xl mb-4">📱</div>
            <h3 className="text-xl font-bold mb-2">WhatsApp Gateway</h3>
            <p className="text-gray-600">
              Kirim notifikasi WhatsApp otomatis dengan Evolution API
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-3xl mb-4">🔌</div>
            <h3 className="text-xl font-bold mb-2">Monitoring OLT</h3>
            <p className="text-gray-600">
              Monitor PON PORT, ONU, dan optical power real-time
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2">Mikrotik Integration</h3>
            <p className="text-gray-600">
              Notifikasi PPPoE login/logout dan hotspot otomatis
            </p>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Harga Terjangkau</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Starter */}
            <div className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 transition">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <div className="text-3xl font-bold mb-4">
                Rp 25.000
                <span className="text-sm text-gray-500">/bulan</span>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>1 WhatsApp Instance</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>1000 Pesan/hari</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>1 OLT</span>
                </li>
              </ul>
              <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 transition">
                Pilih Paket
              </button>
            </div>

            {/* Pro */}
            <div className="border-2 border-blue-500 rounded-lg p-6 relative">
              <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg text-sm">
                Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4">
                Rp 75.000
                <span className="text-sm text-gray-500">/bulan</span>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>5 WhatsApp Instance</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>5000 Pesan/hari</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>5 OLT</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>PON PORT Monitoring</span>
                </li>
              </ul>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                Pilih Paket
              </button>
            </div>

            {/* Enterprise */}
            <div className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 transition">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <div className="text-3xl font-bold mb-4">
                Rp 200.000
                <span className="text-sm text-gray-500">/bulan</span>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Unlimited Instance</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>20000 Pesan/hari</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Unlimited OLT</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Priority Support</span>
                </li>
              </ul>
              <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 transition">
                Pilih Paket
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-16 text-gray-600">
          <p>&copy; 2026 WhatsApp Gateway SaaS. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <a href="/docs" className="hover:text-blue-600">Dokumentasi</a>
            <a href="/support" className="hover:text-blue-600">Support</a>
            <a href="/terms" className="hover:text-blue-600">Terms</a>
            <a href="/privacy" className="hover:text-blue-600">Privacy</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
