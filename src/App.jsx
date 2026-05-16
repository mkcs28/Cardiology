import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CardioCalculator from './pages/CardioCalculator';
import ECGCalculator from './pages/ECGCalculator';
import About from './pages/About';
import Contact from './pages/Contact';
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cardio-calculator" element={<CardioCalculator />} />
        <Route path="/ecg-calculator" element={<ECGCalculator />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </BrowserRouter>
  );
}
