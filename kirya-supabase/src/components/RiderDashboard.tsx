import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Bike, Navigation, Power, MapPin, AlertCircle, Clock, CheckCircle2, Activity, Store, Package, Flag, Star, Wifi, WifiOff } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet'; import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { useRealtime, broadcast, CHANNELS } from '../hooks/useRealtime';
import type { RiderTaskStatus } from '../types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
const RIDER_ICON = L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/9561/9561688.png', iconSize: [40,40], iconAnchor:[20,40] });
const RIDER_ID = 'rider_1'; const RIDER_NAME = 'John Doe';
function MapUpdater({ center }: { center: [number,number] }) { const map = useMap(); useEffect(() => { map.setView(center, map.getZoom()); }, [center,map]); return null; }
const STATUS_STEPS: { from: RiderTaskStatus; to: RiderTaskStatus; label: string; style: string; Icon: React.ElementType }[] = [
  { from:'idle',        to:'to_shop',     label:'Start Pickup',    style:'bg-indigo-50 text-indigo-600 border border-indigo-100', Icon:Navigation   },
  { from:'to_shop',    to:'at_shop',     label:'Arrived at Shop', style:'bg-yellow-400 text-black',                              Icon:Store        },
  { from:'at_shop',    to:'to_delivery', label:'Start Delivery',  style:'bg-green-400 text-black',                               Icon:Package      },
  { from:'to_delivery',to:'delivered',   label:'Mark Delivered',  style:'bg-indigo-600 text-white',                              Icon:CheckCircle2 },
  { from:'delivered',  to:'idle',        label:'Task Complete ✓', style:'bg-slate-100 text-slate-600',                           Icon:Flag         },
];
const ALL_STATUSES: RiderTaskStatus[] = ['idle','to_shop','at_shop','to_delivery','delivered'];

export default function RiderDashboard({ renderRoleSwitcher }: { renderRoleSwitcher?: () => React.ReactNode }) {
  const { connected } = useRealtime(CHANNELS.RIDERS);
  const [isOnline, setIsOnline]         = useState(false);
  const [location, setLocation]         = useState<[number,number]>([1.0821,34.1750]);
  const [error, setError]               = useState<string|null>(null);
  const [taskStatus, setTaskStatus]     = useState<RiderTaskStatus>('idle');
  const [assignedOrder, setAssignedOrder] = useState<any>(null);
  const [stats]                         = useState({ deliveries:12, earnings:45000, rating:4.9 });
  const watchIdRef    = useRef<number|null>(null);
  const taskRef       = useRef<RiderTaskStatus>('idle');
  const locRef        = useRef<[number,number]>([1.0821,34.1750]);
  useEffect(() => { taskRef.current = taskStatus; }, [taskStatus]);
  useEffect(() => { locRef.current  = location;   }, [location]);

  // Listen for order assignments from admin via Supabase Broadcast
  useEffect(() => {
    const ch = supabase.channel(CHANNELS.ORDERS + ':rider');
    ch.on('broadcast', { event:'order_assigned' }, ({ payload }) => {
      if (payload.riderId === RIDER_ID) setAssignedOrder(payload);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const upsertRider = async (pos:[number,number], status:'online'|'offline', task:RiderTaskStatus) => {
    await supabase.from('riders').upsert({ id:RIDER_ID, name:RIDER_NAME, lat:pos[0], lng:pos[1], status, task_status:task, last_seen:new Date().toISOString() });
    broadcast(CHANNELS.RIDERS, 'rider_location', { id:RIDER_ID, name:RIDER_NAME, lat:pos[0], lng:pos[1], status, taskStatus:task });
  };

  useEffect(() => {
    if (isOnline) {
      broadcast(CHANNELS.RIDERS, 'rider_connect', { riderId:RIDER_ID, name:RIDER_NAME });
      if (!navigator.geolocation) { setError('Geolocation not supported.'); setIsOnline(false); return; }
      watchIdRef.current = navigator.geolocation.watchPosition(
        pos => { const p:[number,number]=[pos.coords.latitude,pos.coords.longitude]; setLocation(p); setError(null); upsertRider(p,'online',taskRef.current); },
        ()  => { setError('Please permit GPS access.'); setIsOnline(false); },
        { enableHighAccuracy:true }
      );
    } else {
      if (watchIdRef.current!==null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current=null; }
      upsertRider(locRef.current,'offline','idle');
      setTaskStatus('idle');
      broadcast(CHANNELS.RIDERS,'rider_status',{ riderId:RIDER_ID, status:'idle' });
    }
    return () => { if (watchIdRef.current!==null) navigator.geolocation.clearWatch(watchIdRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleStatusUpdate = async (s:RiderTaskStatus) => {
    setTaskStatus(s);
    await supabase.from('riders').update({ task_status:s, last_seen:new Date().toISOString() }).eq('id',RIDER_ID);
    broadcast(CHANNELS.RIDERS,'rider_status',{ riderId:RIDER_ID, status:s });
  };

  const currentStep = STATUS_STEPS.find(s=>s.from===taskStatus);
  const statusIdx   = ALL_STATUSES.indexOf(taskStatus);

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-20">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 bg-white p-4 rounded-[1.5rem] shadow-xl border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {renderRoleSwitcher?.()}
              <div className={`p-3 rounded-xl ${isOnline?'bg-green-100 text-green-600':'bg-slate-100 text-slate-400'}`}><Bike className="w-6 h-6"/></div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Rider Dashboard</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isOnline?'Active & Online':'Currently Offline'}</p>
                  <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${connected?'bg-green-100 text-green-600':'bg-amber-100 text-amber-600'}`}>
                    {connected?<Wifi className="w-2.5 h-2.5"/>:<WifiOff className="w-2.5 h-2.5"/>}
                    {connected?'Live':'Connecting…'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={()=>setIsOnline(v=>!v)} disabled={!connected}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isOnline?'bg-red-500 text-white shadow-lg shadow-red-500/20':'bg-green-500 text-white shadow-lg shadow-green-500/20'}`}>
              <Power className="w-4 h-4"/>{isOnline?'GO OFFLINE':'GO ONLINE'}
            </button>
          </div>
          {isOnline && currentStep && (
            <div className="pt-2 border-t border-slate-100">
              <button onClick={()=>handleStatusUpdate(currentStep.to)}
                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 ${currentStep.style}`}>
                <currentStep.Icon className="w-3 h-3"/>{currentStep.label}
              </button>
            </div>
          )}
          {isOnline && <div className="flex gap-1">{ALL_STATUSES.map((s,i)=><div key={s} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${i<=statusIdx?'bg-primary':'bg-slate-200'}`}/>)}</div>}
        </div>

        {error && <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-600"><AlertCircle className="w-5 h-5 shrink-0"/><p className="text-sm font-bold">{error}</p></motion.div>}
        {assignedOrder && <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-primary text-white p-5 rounded-[1.5rem] shadow-xl shadow-primary/30"><p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">🎉 New Order Assigned!</p><p className="font-black text-lg">Order #{assignedOrder.orderId}</p><p className="text-sm opacity-80 mt-1">{assignedOrder.items?.length??0} item(s) to pick up</p></motion.div>}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[{label:'Deliveries',value:stats.deliveries,Icon:CheckCircle2,color:'text-green-500'},{label:'Earnings (UGX)',value:stats.earnings.toLocaleString(),Icon:Clock,color:'text-blue-500'},{label:'Rating',value:stats.rating,Icon:Star,color:'text-yellow-500'}].map(({label,value,Icon,color})=>(
            <div key={label} className="bg-white p-4 rounded-[1.5rem] shadow-xl border border-white/20">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
              <div className="flex items-center justify-between"><h3 className="text-xl font-black">{value}</h3><Icon className={`w-6 h-6 ${color} opacity-20`}/></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Map */}
            <div className="bg-white p-3 rounded-[1.5rem] shadow-2xl border border-white/20 overflow-hidden h-[300px] relative">
              <MapContainer center={location} zoom={15} style={{height:'100%',width:'100%',borderRadius:'1.2rem'}} zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"/>
                <Marker position={location} icon={RIDER_ICON}><Popup><div className="p-2"><p className="font-black text-xs">You are here</p></div></Popup></Marker>
                <MapUpdater center={location}/>
              </MapContainer>
              {!isOnline && <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center rounded-[1.2rem] m-3"><div className="bg-white p-4 rounded-[1.5rem] text-center shadow-2xl"><Navigation className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-pulse"/><h3 className="text-sm font-black mb-1">Map Offline</h3><p className="text-[10px] text-slate-500 font-bold">Go online to share GPS</p></div></div>}
              {isOnline && <div className="absolute top-5 right-5 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-lg"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/><span className="text-[10px] font-black uppercase tracking-widest text-green-600">Streaming GPS</span></div>}
            </div>
            {isOnline && taskStatus!=='idle' && (
              <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="bg-indigo-600 text-white p-5 rounded-[1.5rem] shadow-2xl shadow-indigo-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Bike className="w-20 h-20"/></div>
                <div className="relative z-10">
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-[8px] font-black uppercase tracking-widest">{taskStatus.replace(/_/g,' ')}</span>
                  <div className="mt-4 space-y-3">
                    {[{Icon:MapPin,label:'Pickup',value:'Mbale Fried Chicken'},{Icon:Navigation,label:'Dropoff',value:'John M. — Naboa Road'}].map(({Icon,label,value})=>(
                      <div key={label} className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0"><Icon className="w-3 h-3"/></div><div><p className="text-[8px] font-black uppercase tracking-widest opacity-60">{label}</p><p className="text-xs font-black">{value}</p></div></div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          {/* Earnings */}
          <div className="bg-white p-4 rounded-[1.5rem] shadow-2xl border border-white/20 flex flex-col">
            <h3 className="text-sm font-black mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500"/>Recent Earnings</h3>
            <div className="space-y-3 flex-1">
              {[{date:'Today, 14:20',amount:'4,500'},{date:'Today, 12:45',amount:'6,000'},{date:'Yesterday, 19:10',amount:'5,500'}].map((e,i)=>(
                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"><div><p className="text-[10px] font-black">{e.date}</p><p className="text-[8px] font-bold text-green-500 uppercase tracking-widest">Completed</p></div><p className="text-xs font-black text-indigo-500">{e.amount} UGX</p></div>
              ))}
            </div>
            <button className="mt-4 w-full py-3 bg-slate-100 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-indigo-500 hover:text-white transition-all">View All</button>
          </div>
        </div>
      </div>
    </div>
  );
}
