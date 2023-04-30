import '../styles/globals.css';
import { AuthProvider } from '../hook/useAuth';
import { ConnectionProvider } from '../hook/useConnection';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <ConnectionProvider>
        <Component {...pageProps} />
        <ToastContainer />
      </ConnectionProvider>
    </AuthProvider>
  )
}
