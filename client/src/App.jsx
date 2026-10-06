import Controller from './pages/Controller.jsx';
import Display from './pages/Display.jsx';
import { roomFromUrl } from './lib/useSession.js';

export default function App() {
  const room = roomFromUrl();
  const isDisplay = location.pathname.replace(/\/+$/, '') === '/display';
  return isDisplay ? <Display room={room} /> : <Controller room={room} />;
}
