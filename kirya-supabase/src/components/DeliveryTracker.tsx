import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  MapPin, 
  Phone, 
  MessageSquare, 
  ChevronRight,
  CheckCircle2,
  Navigation,
  Star,
  Bike,
  Sun,
  CloudRain,
  Moon,
  LayoutGrid,
  Send,
  X,
  Store
} from 'lucide-react';
import Map from './Map';
import { getRoute, RouteData } from '../services/routingService';
import L from 'leaflet';
import { HUBS, SHOPS } from '../constants';
import type { ChatMessage, RiderLocation, TaskStatusPayload } from '../types';
import { supabase } from '../lib/supabase';
import { useRealtime, broadcast, CHANNELS } from '../hooks/useRealtime';
import confetti from 'canvas-confetti';

interface DeliveryTrackerProps {
  deliveryLocation: [number, number];
  onClose: () => void;
}

type DeliveryStage = 'to_shop' | 'to_delivery' | 'completed';

const HUB_POS = HUBS[0];
const SHOP_POS = SHOPS[0];

function calculateBearing(start: [number, number], end: [number, number]) {
  const lat1 = start[0] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const dLon = (end[1] - start[1]) * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return (brng * 180 / Math.PI + 360) % 360;
}

export default function DeliveryTracker({ deliveryLocation, onClose }: DeliveryTrackerProps) {
  const [stage, setStage] = useState<DeliveryStage>('to_shop');
  const [riderPos, setRiderPos] = useState<[number, number]>(HUB_POS);
  const [riderRotation, setRiderRotation] = useState(0);
  const [smoothRotation, setSmoothRotation] = useState(0);
  const [riderData, setRiderData] = useState<RiderLocation | null>(null);
  
  // New States for Bento Features
  const [mapTheme, setMapTheme] = useState<'light' | 'dark' | 'minimal'>('light');
  const [weather, setWeather] = useState<'clear' | 'rain'>('clear');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'rider', text: "I'm heading to the shop now! 🏍️" }
  ]);
  const [newMessage, setNewMessage] = useState('');

  // Receive incoming chat from rider via Supabase Broadcast
  useEffect(() => {
    const ch = supabase.channel(CHANNELS.CHAT + ':tracker');
    ch.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      const msg = payload as ChatMessage & { orderId: string };
      if (msg.role !== 'rider') return;
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.text === msg.text && last?.role === msg.role) return prev;
        return [...prev, { role: msg.role, text: msg.text }];
      });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  
  const { channel: ridersCh } = useRealtime(CHANNELS.RIDERS);
  const { channel: chatCh } = useRealtime(CHANNELS.CHAT);
  const audioContext = useRef<AudioContext | null>(null);

  const playSound = (frequency: number, type: OscillatorType = 'sine') => {
    if (!audioContext.current) audioContext.current = new AudioContext();
    const osc = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioContext.current.currentTime);
    gain.gain.setValueAtTime(0.1, audioContext.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + 0.5);
  };

  // Smooth rotation transition
  useEffect(() => {
    const diff = ((riderRotation - smoothRotation + 180) % 360) - 180;
    const step = diff * 0.15; // Smoothing factor
    if (Math.abs(diff) > 0.1) {
      const timer = setTimeout(() => setSmoothRotation(prev => (prev + step + 360) % 360), 20);
      return () => clearTimeout(timer);
    }
  }, [riderRotation, smoothRotation]);
  
  // ── Real-time rider tracking via WebSocket ────────────────────────────────
  useEffect(() => {
    // Subscribe to live rider position via Supabase Broadcast
    const trackerCh = supabase.channel(CHANNELS.RIDERS + ':tracker');
    trackerCh
      .on('broadcast', { event: 'rider_location' }, ({ payload }) => {
        if (payload.id !== 'rider_1') return;
        setRiderData(payload as RiderLocation);
        // Uncomment to use real GPS: setRiderPos([payload.lat, payload.lng]);
      })
      .on('broadcast', { event: 'rider_status' }, ({ payload }) => {
        if (payload.riderId !== 'rider_1') return;
        switch (payload.status) {
          case 'to_shop':     setStage('to_shop');     break;
          case 'at_shop':     setStage('to_shop');     break;
          case 'to_delivery': setStage('to_delivery'); break;
          case 'delivered':   setStage('completed');   break;
          case 'idle':        setStage('to_shop');     break;
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(trackerCh); };
  }, []);

  const [hubToShopRoute, setHubToShopRoute] = useState<RouteData | null>(null);
  const [shopToDeliveryRoute, setShopToDeliveryRoute] = useState<RouteData | null>(null);
  
  const [progress, setProgress] = useState(0); // 0 to 1 for current stage
  const [remainingTime, setRemainingTime] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState(0);

  // Fetch all routes at once
  useEffect(() => {
    async function fetchRoutes() {
      const route1 = await getRoute(HUB_POS, SHOP_POS);
      const route2 = await getRoute(SHOP_POS, deliveryLocation);
      
      setHubToShopRoute(route1);
      setShopToDeliveryRoute(route2);
      
      // Initial metrics
      setRemainingDistance(route1.distance + route2.distance);
      setRemainingTime(route1.duration + route2.duration);
    }
    fetchRoutes();
  }, [deliveryLocation]);

  // Animation Loop
  useEffect(() => {
    if (stage === 'completed') return;
    
    const currentRoute = stage === 'to_shop' ? hubToShopRoute : shopToDeliveryRoute;
    if (!currentRoute) return;

    const totalSteps = 600; // Much smoother animation
    const intervalTime = 40; // Faster updates for real-time feel
    
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (1 / totalSteps);
        if (next >= 1) {
          clearInterval(timer);
          if (stage === 'to_shop') {
            playSound(440);
            const pickupMsg: ChatMessage = { role: 'rider', text: "Just picked up your order! On my way. 🍔" };
            setChatMessages(prev => [...prev, pickupMsg]);
            broadcast(CHANNELS.CHAT, 'chat_message', { orderId: 'demo-order', ...pickupMsg });
            setTimeout(() => {
              setStage('to_delivery');
              setProgress(0);
            }, 1500);
          } else {
            playSound(880); // Delivered
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#FF7A00', '#3B82F6', '#10B981']
            });
            setTimeout(() => setStage('completed'), 1000);
          }
          return 1;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [stage, hubToShopRoute, shopToDeliveryRoute]);

  // Update position and rotation
  useEffect(() => {
    const currentRoute = stage === 'to_shop' ? hubToShopRoute : shopToDeliveryRoute;
    if (!currentRoute || progress === 0) return;

    const coords = currentRoute.coordinates;
    const index = Math.floor(progress * (coords.length - 1));
    const nextIndex = Math.min(index + 1, coords.length - 1);
    
    const currentPoint = coords[index];
    const nextPoint = coords[nextIndex];
    
    // Smoothly interpolate position between points for "riding on line" effect
    const segmentProgress = (progress * (coords.length - 1)) % 1;
    const interpolatedLat = currentPoint[0] + (nextPoint[0] - currentPoint[0]) * segmentProgress;
    const interpolatedLng = currentPoint[1] + (nextPoint[1] - currentPoint[1]) * segmentProgress;
    
    setRiderPos([interpolatedLat, interpolatedLng]);
    
    if (index < coords.length - 1) {
      const bearing = calculateBearing(currentPoint, nextPoint);
      setRiderRotation(bearing);
    }

    // Metrics
    let dist = currentRoute.distance * (1 - progress);
    let time = currentRoute.duration * (1 - progress);
    
    if (stage === 'to_shop' && shopToDeliveryRoute) {
      dist += shopToDeliveryRoute.distance;
      time += shopToDeliveryRoute.duration;
    }
    
    setRemainingDistance(dist);
    setRemainingTime(time);
  }, [progress, stage, hubToShopRoute, shopToDeliveryRoute]);

  const stageInfo = {
    to_shop: {
      title: 'Heading to Shop',
      subtitle: 'Rider is picking up your order',
      icon: <img src="https://cdn-icons-png.flaticon.com/512/9561/9561688.png" className="w-12 h-12" referrerPolicy="no-referrer" />,
      color: 'bg-blue-50'
    },
    at_shop: {
      title: 'At Shop',
      subtitle: 'Rider has arrived and is picking up food',
      icon: <Store className="w-6 h-6 text-indigo-500" />,
      color: 'bg-yellow-50'
    },
    to_delivery: {
      title: 'Heading to You',
      subtitle: 'Rider is on the way with your food',
      icon: <img src="https://cdn-icons-png.flaticon.com/512/9561/9561688.png" className="w-12 h-12" referrerPolicy="no-referrer" />,
      color: 'bg-orange-50'
    },
    completed: {
      title: 'Delivered',
      subtitle: 'Enjoy your meal!',
      icon: <CheckCircle2 className="w-6 h-6 text-green-500" />,
      color: 'bg-green-50'
    }
  }[stage === 'to_shop' && riderData?.taskStatus === 'at_shop' ? 'at_shop' : stage];

  return (
    <div className={`fixed inset-0 z-[100] ${mapTheme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex flex-col overflow-hidden transition-colors duration-500`}>
      {/* Header */}
      <header className={`px-5 py-4 flex items-center justify-between border-b ${mapTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'} z-50 bg-inherit`}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className={`p-2 ${mapTheme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} rounded-full transition-colors`}>
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <div>
            <h2 className="font-black text-lg tracking-tight">Track Order</h2>
            <p className={`text-[10px] uppercase tracking-widest font-bold ${mapTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Order #KY-2941</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setWeather(prev => prev === 'clear' ? 'rain' : 'clear')}
            className={`p-2.5 rounded-xl transition-all active:scale-90 ${weather === 'rain' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : (mapTheme === 'dark' ? 'bg-slate-800' : 'bg-white shadow-sm')}`}
          >
            {weather === 'rain' ? <CloudRain className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setMapTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className={`p-2.5 rounded-xl transition-all active:scale-90 ${mapTheme === 'dark' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white shadow-sm'}`}
          >
            {mapTheme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Bento Grid Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min">
          
          {/* Map Card - Large */}
          <div className={`md:col-span-2 md:row-span-2 h-[400px] md:h-auto min-h-[400px] relative rounded-[2.5rem] overflow-hidden shadow-2xl border ${mapTheme === 'dark' ? 'border-slate-800' : 'border-white'}`}>
            <Map 
              center={riderPos}
              allHubs={HUBS}
              allShops={SHOPS}
              theme={mapTheme}
              weather={weather}
              trackingData={{
                riderPos,
                riderRotation: smoothRotation,
                hubPos: HUB_POS,
                shopPos: SHOP_POS,
                deliveryPos: deliveryLocation,
                hubToShopPath: hubToShopRoute?.coordinates || [],
                shopToDeliveryPath: shopToDeliveryRoute?.coordinates || [],
                currentStage: stage,
                progress: progress
              }}
            />
            
            {/* Overlay Status Badge */}
            <div className="absolute top-6 left-6 z-10">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-xl border border-white/20 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${stage === 'completed' ? 'bg-green-500' : 'bg-orange-500'}`} />
                <span className="text-xs font-black uppercase tracking-widest">{stageInfo.title}</span>
              </div>
            </div>
          </div>

          {/* Live Metrics Card */}
          <div className={`p-3 rounded-[1.5rem] backdrop-blur-xl border transition-all ${mapTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white/80 border-white shadow-xl'}`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${mapTheme === 'dark' ? 'bg-slate-800' : 'bg-orange-50 text-orange-500'}`}>
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tabular-nums tracking-tighter">
                    {Math.floor(remainingTime / 60)}:{String(Math.floor(remainingTime % 60)).padStart(2, '0')}
                  </h3>
                  <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[11px] font-black text-primary uppercase tracking-widest">
                    {remainingDistance > 1000 
                      ? `${(remainingDistance / 1000).toFixed(1)}km` 
                      : `${Math.round(remainingDistance)}m`}
                  </span>
                </div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Live ETA</p>
              </div>
            </div>
          </div>

          {/* Rider Profile Card */}
          <div className={`p-2.5 rounded-[1.5rem] backdrop-blur-xl border transition-all ${mapTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white/80 border-white shadow-xl'}`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${mapTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <img src="https://cdn-icons-png.flaticon.com/512/9561/9561688.png" className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h4 className="font-black text-xs truncate">John Doe</h4>
                    <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                    <p className="text-[10px] font-bold text-slate-500 truncate">Honda CG125 • UBK 412X</p>
                  </div>
                  <div className="flex items-center gap-0.5 text-yellow-500 shrink-0">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-[10px] font-black">4.9</span>
                  </div>
                </div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Your Rider</p>
              </div>
            </div>
          </div>

          {/* Chat Card / Button Card */}
          <div className={`md:col-span-1 p-3 rounded-[1.5rem] backdrop-blur-xl border transition-all flex flex-col justify-between ${mapTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white/80 border-white shadow-xl'}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-black text-[9px] uppercase tracking-widest text-slate-400">Messages</h4>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="p-1.5 bg-primary text-white rounded-lg shadow-lg shadow-primary/20 active:scale-90 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
                <button className={`p-1.5 rounded-lg active:scale-90 transition-all ${mapTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Phone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className={`p-2.5 rounded-xl italic text-[10px] line-clamp-2 ${mapTheme === 'dark' ? 'text-slate-400 bg-slate-800/30' : 'text-slate-500 bg-slate-50'}`}>
              "{chatMessages[chatMessages.length - 1].text}"
            </div>
          </div>

          {/* Progress Card */}
          <div className={`md:col-span-2 p-3 rounded-[1.5rem] backdrop-blur-xl border transition-all ${mapTheme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white/80 border-white shadow-xl'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg ${stage === 'completed' ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                  {stage === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
                </div>
                <h4 className="font-black text-xs tracking-tight">{stageInfo.title}</h4>
              </div>
              <span className="text-[10px] font-black text-primary">{Math.round(progress * 100)}%</span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden p-0.5 ${mapTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(255,122,0,0.5)]"
              />
            </div>
          </div>

        </div>
      </main>

      {/* Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 100, scale: 0.9 }}
              className={`w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl ${mapTheme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="https://picsum.photos/seed/rider/100/100" className="w-10 h-10 rounded-2xl object-cover" />
                  <div>
                    <h4 className="font-black">John Doe</h4>
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Online</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="h-80 overflow-y-auto p-6 flex flex-col gap-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-medium ${
                      msg.role === 'user' 
                        ? 'bg-primary text-white rounded-tr-none' 
                        : (mapTheme === 'dark' ? 'bg-slate-800 text-white rounded-tl-none' : 'bg-slate-100 text-slate-800 rounded-tl-none')
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className={`flex-1 px-6 py-3 rounded-2xl text-sm font-medium outline-none transition-all ${
                    mapTheme === 'dark' ? 'bg-slate-800 focus:bg-slate-700' : 'bg-slate-100 focus:bg-slate-200'
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMessage) {
                      const msg: ChatMessage = { role: 'user', text: newMessage };
                      setChatMessages(prev => [...prev, msg]);
                      broadcast(CHANNELS.CHAT, 'chat_message', { orderId: 'demo-order', ...msg });
                      setNewMessage('');
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (!newMessage) return;
                    const msg: ChatMessage = { role: 'user', text: newMessage };
                    setChatMessages(prev => [...prev, msg]);
                    broadcast(CHANNELS.CHAT, 'chat_message', { orderId: 'demo-order', ...msg });
                    setNewMessage('');
                  }}
                  className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 active:scale-90 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Action Bar */}
      {stage === 'completed' && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className={`p-6 border-t ${mapTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
        >
          <button 
            onClick={onClose}
            className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-5 rounded-[2rem] font-black text-lg active:scale-95 transition-all shadow-xl"
          >
            Back to Home
          </button>
        </motion.div>
      )}
    </div>
  );
}
