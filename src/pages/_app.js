import '../styles/globals.css';
import { AuthProvider } from '../hook/useAuth';
import { ConnectionProvider } from '../hook/useConnection';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <ConnectionProvider>
        <Component {...pageProps} />
      </ConnectionProvider>
    </AuthProvider>
  )
}
