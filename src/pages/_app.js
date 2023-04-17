import '../styles/globals.css';
import { AuthProvider } from '../hook/useAuth';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  )
}
