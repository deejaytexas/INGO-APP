import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Users, 
  Bike, 
  Activity, 
  Map as MapIcon,
  AlertCircle,
  RefreshCcw,
  CheckCircle2,
  Store,
  UtensilsCrossed,
  Package,
  UsersRound,
  Briefcase,
  Plus,
  LayoutDashboard,
  Edit,
  Trash2,
  Globe,
  MapPin,
  ClipboardList,
  UserPlus
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import type { RiderLocation } from '../types';
import { supabase } from '../lib/supabase';
import { useRealtime, broadcast, CHANNELS } from '../hooks/useRealtime';
import { Wifi, WifiOff } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const RIDER_ICON = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/9561/9561688.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const SHOP_ICON = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/606/606363.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const HUB_ICON = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2776/2776067.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

type AdminView = 'dashboard' | 'shops' | 'dishes' | 'items' | 'staff' | 'partners' | 'tasks' | 'hubs';

export default function AdminDashboard({ renderRoleSwitcher }: { renderRoleSwitcher?: () => any }) {
  const { connected } = useRealtime(CHANNELS.RIDERS);
  const [activeRiders, setActiveRiders] = useState<RiderLocation[]>([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [isAddingShop, setIsAddingShop] = useState(false);
  const [shops, setShops] = useState([
    { id: 'SHP-001', name: "Mbale Fried Chicken", location: "Republic St", status: "Active", photo: "https://picsum.photos/seed/shop1/100/100", lat: 1.0821, lng: 34.1750 },
    { id: 'SHP-002', name: "The Coffee Hub", location: "Naboa Rd", status: "Active", photo: "https://picsum.photos/seed/shop2/100/100", lat: 1.0850, lng: 34.1780 },
    { id: 'SHP-003', name: "Mama Africa Kitchen", location: "Pallisa Rd", status: "Inactive", photo: "https://picsum.photos/seed/shop3/100/100", lat: 1.0800, lng: 34.1720 },
  ]);
  const [hubs, setHubs] = useState([
    { id: 'HUB-001', name: "Main Stage Hub", location: "Clock Tower", status: "Active", lat: 1.0835, lng: 34.1765 },
    { id: 'HUB-002', name: "North Mbale Hub", location: "Bungokho", status: "Active", lat: 1.0900, lng: 34.1800 },
  ]);
  const [isMapEditMode, setIsMapEditMode] = useState(false);
  const [mapClickPos, setMapClickPos] = useState<[number, number] | null>(null);
  const [newEntity, setNewEntity] = useState<{ type: 'shop' | 'hub', name: '', location: '' }>({ type: 'shop', name: '', location: '' });
  const [newShop, setNewShop] = useState({ name: '', location: '', status: 'Active', photo: '' });
  const [tasks, setTasks] = useState([
    { id: 'TSK-101', customer: 'John Doe', shop: 'Mbale Fried Chicken', riderId: null, status: 'Pending', amount: '25,000 UGX', time: '10:30 AM' },
    { id: 'TSK-102', customer: 'Sarah Smith', shop: 'The Coffee Hub', riderId: 'rider_1', status: 'In Progress', amount: '12,000 UGX', time: '11:15 AM' },
    { id: 'TSK-103', customer: 'Mike Johnson', shop: 'Mama Africa Kitchen', riderId: 'rider_2', status: 'Delivered', amount: '45,000 UGX', time: '09:45 AM' },
  ]);
  const [isAssigningTask, setIsAssigningTask] = useState<string | null>(null);

  const getRiderName = (riderId: string | null) => {
    if (!riderId) return 'Unassigned';
    const rider = activeRiders.find(r => r.id === riderId);
    return rider ? (rider.name || `Rider ${riderId.split('_')[1]}`) : 'Offline Rider';
  };

  const assignTask = (taskId: string, riderId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, riderId, status: 'In Progress' } : t));
    // Broadcast assignment to rider via Supabase
    broadcast(CHANNELS.ORDERS, 'order_assigned', { orderId: taskId, riderId, items: [] });
    setIsAssigningTask(null);
  };

  function MapEvents() {
    useMapEvents({
      click(e) {
        if (isMapEditMode) {
          setMapClickPos([e.latlng.lat, e.latlng.lng]);
        }
      },
    });
    return null;
  }

  const handleAddEntity = () => {
    if (!mapClickPos) return;
    
    if (newEntity.type === 'shop') {
      const id = `SHP-00${shops.length + 1}`;
      setShops([...shops, { 
        id, 
        name: newEntity.name || 'New Shop', 
        location: newEntity.location || 'Unknown', 
        status: 'Active', 
        photo: `https://picsum.photos/seed/${id}/100/100`,
        lat: mapClickPos[0],
        lng: mapClickPos[1]
      }]);
    } else {
      const id = `HUB-00${hubs.length + 1}`;
      setHubs([...hubs, { 
        id, 
        name: newEntity.name || 'New Hub', 
        location: newEntity.location || 'Unknown', 
        status: 'Active',
        lat: mapClickPos[0],
        lng: mapClickPos[1]
      }]);
    }
    setMapClickPos(null);
    setNewEntity({ type: 'shop', name: '', location: '' });
  };

  const fetchRiders = () => {
    // Manual refresh — reload riders from DB
    supabase.from('riders').select('*').then(({ data }) => { if (data) setActiveRiders((data as RiderLocation[]).filter(r => r.status === 'online')); });
    setLastUpdate(Date.now());
  };

  useEffect(() => {
    // Subscribe to live rider location broadcasts

    // Live rider location broadcasts
    const adminCh = supabase.channel(CHANNELS.RIDERS + ':admin');
    adminCh
      .on('broadcast', { event: 'rider_location' }, ({ payload }) => {
        setActiveRiders(prev => {
          const others = prev.filter(r => r.id !== payload.id);
          if (payload.status === 'offline') return others;
          return [...others, payload as RiderLocation];
        });
        setLastUpdate(Date.now());
      })
      .on('broadcast', { event: 'rider_status' }, ({ payload }) => {
        const { riderId, status } = payload as { riderId: string; status: string };
        setTasks(prev => prev.map(t => {
          if (t.riderId !== riderId) return t;
          const adminStatus = status === 'delivered' || status === 'idle' ? 'Delivered' : 'In Progress';
          return { ...t, status: adminStatus };
        }));
        // Mark rider offline if idle
        if (status === 'idle') {
          setActiveRiders(prev => prev.filter(r => r.id !== riderId));
        }
      })
      .on('broadcast', { event: 'rider_connect' }, ({ payload }) => {
        setLastUpdate(Date.now());
      })
      .subscribe();

    // Also load initial riders from DB
    supabase.from('riders').select('*').then(({ data }) => {
      if (data) setActiveRiders((data as RiderLocation[]).filter(r => r.status === 'online'));
    });

    return () => { supabase.removeChannel(adminCh); };
  }, []);

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
    { id: 'tasks', icon: ClipboardList, label: 'Tasks' },
    { id: 'shops', icon: Store, label: 'Shops' },
    { id: 'hubs', icon: MapPin, label: 'Hubs' },
    { id: 'dishes', icon: UtensilsCrossed, label: 'Dishes' },
    { id: 'items', icon: Package, label: 'Items' },
    { id: 'staff', icon: UsersRound, label: 'Staff' },
    { id: 'partners', icon: Briefcase, label: 'Partners' },
  ];

  const mockData = {
    shops: shops,
    dishes: [
      { id: 1, name: "2pc Chicken & Chips", price: "15,000 UGX", shop: "Mbale Fried Chicken" },
      { id: 2, name: "Cappuccino", price: "8,000 UGX", shop: "The Coffee Hub" },
      { id: 3, name: "Luwombo", price: "25,000 UGX", shop: "Mama Africa Kitchen" },
    ],
    items: [
      { id: 1, name: "Cooking Oil (5L)", stock: 45, category: "Grocery" },
      { id: 2, name: "Panadol Extra", stock: 120, category: "Pharmacy" },
      { id: 3, name: "Soda (500ml)", stock: 300, category: "Drinks" },
    ],
    staff: [
      { id: 1, name: "Sarah Nabirye", role: "Manager", status: "Online" },
      { id: 2, name: "Peter Okello", role: "Dispatcher", status: "Offline" },
      { id: 3, name: "Grace Akello", role: "Support", status: "Online" },
    ],
    partners: [
      { id: 1, name: "Coca-Cola Uganda", type: "Supplier", contact: "+256 700 123456" },
      { id: 2, name: "TotalEnergies", type: "Fuel Partner", contact: "+256 755 987654" },
      { id: 3, name: "Stanbic Bank", type: "Financial", contact: "+256 414 111222" },
    ]
  };

  const handleAddShop = () => {
    const shopId = `SHP-00${shops.length + 1}`;
    setShops([...shops, { ...newShop, id: shopId, photo: newShop.photo || `https://picsum.photos/seed/${shopId}/100/100` }]);
    setIsAddingShop(false);
    setNewShop({ name: '', location: '', status: 'Active', photo: '' });
  };

  const renderManagementView = () => {
    const activeItem = navItems.find(i => i.id === currentView);
    if (!activeItem) return null;
    
    const Icon = activeItem.icon;
    const data = currentView === 'shops' ? shops : ((mockData as any)[currentView] || []);

    if (currentView === 'tasks') {
      return (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800">
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Task ID</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shop</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rider</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {tasks.map((task) => (
                    <tr key={task.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-6 text-sm font-black text-indigo-500">{task.id}</td>
                      <td className="p-6 text-sm font-black">{task.customer}</td>
                      <td className="p-6 text-sm font-bold text-slate-500">{task.shop}</td>
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-black">{getRiderName(task.riderId)}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{task.time}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          task.status === 'Delivered' ? 'bg-green-100 text-green-600' : 
                          task.status === 'In Progress' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="p-6 text-sm font-black">{task.amount}</td>
                      <td className="p-6">
                        <div className="flex items-center justify-center gap-2">
                          {task.riderId === null ? (
                            <button 
                              onClick={() => setIsAssigningTask(task.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                            >
                              <UserPlus className="w-3 h-3" />
                              Assign
                            </button>
                          ) : (
                            <button 
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                              disabled
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assigning Modal/Overlay */}
          <AnimatePresence>
            {isAssigningTask && (
              <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsAssigningTask(null)}
                  className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 p-8"
                >
                  <h3 className="text-xl font-black mb-6 uppercase tracking-widest">Assign Rider to {isAssigningTask}</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {activeRiders.length > 0 ? (
                      activeRiders.map((rider) => (
                        <button
                          key={rider.id}
                          onClick={() => assignTask(isAssigningTask, rider.id)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-indigo-500 hover:text-white transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 group-hover:bg-white/20">
                              <Bike className="w-5 h-5 text-indigo-500 group-hover:text-white" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm">{rider.name || `Rider ${rider.id.split('_')[1]}`}</p>
                              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{rider.status}</p>
                            </div>
                          </div>
                          <Plus className="w-4 h-4" />
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-400 font-bold">No active riders online</p>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setIsAssigningTask(null)}
                    className="w-full mt-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    if (currentView === 'hubs') {
      return (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800">
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hub ID</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coordinates</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {hubs.map((hub) => (
                    <tr key={hub.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-6 text-sm font-black text-emerald-500">{hub.id}</td>
                      <td className="p-6 text-sm font-black">{hub.name}</td>
                      <td className="p-6 text-sm font-bold text-slate-500">{hub.location}</td>
                      <td className="p-6 text-[10px] font-mono font-bold text-slate-400">
                        {hub.lat.toFixed(4)}, {hub.lng.toFixed(4)}
                      </td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          hub.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {hub.status}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"
                            title="Edit Hub"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setHubs(hubs.filter(h => h.id !== hub.id))}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            title="Delete Hub"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:border-indigo-500 transition-all"
               onClick={() => { setCurrentView('dashboard'); setIsMapEditMode(true); }}>
            <div className="p-4 rounded-full bg-white dark:bg-slate-900 shadow-lg group-hover:scale-110 transition-transform">
              <Plus className="w-8 h-8 text-indigo-500" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500">Add New Hub via Map</span>
          </div>
        </div>
      );
    }

    if (currentView === 'shops') {
      return (
        <div className="space-y-6">
          {isAddingShop && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-indigo-500/50"
            >
              <h3 className="text-lg font-black mb-4 uppercase tracking-widest">Add New Shop</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shop Name</label>
                  <input 
                    type="text" 
                    value={newShop.name}
                    onChange={(e) => setNewShop({...newShop, name: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Enter shop name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                  <input 
                    type="text" 
                    value={newShop.location}
                    onChange={(e) => setNewShop({...newShop, location: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Enter location"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Photo URL (Optional)</label>
                  <input 
                    type="text" 
                    value={newShop.photo}
                    onChange={(e) => setNewShop({...newShop, photo: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                  <select 
                    value={newShop.status}
                    onChange={(e) => setNewShop({...newShop, status: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleAddShop}
                  className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Save Shop
                </button>
                <button 
                  onClick={() => setIsAddingShop(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800">
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Photo</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shop ID</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {shops.map((shop) => (
                    <tr key={shop.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-6">
                        <img src={shop.photo} alt={shop.name} className="w-12 h-12 rounded-2xl object-cover shadow-lg" referrerPolicy="no-referrer" />
                      </td>
                      <td className="p-6 text-sm font-black text-indigo-500">{shop.id}</td>
                      <td className="p-6 text-sm font-black">{shop.name}</td>
                      <td className="p-6 text-sm font-bold text-slate-500">{shop.location}</td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          shop.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {shop.status}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"
                            title="Edit Shop"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
                            title="Add to Google"
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"
                            title="Manage Delivery Location"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setShops(shops.filter(s => s.id !== shop.id))}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            title="Delete Shop"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((item: any) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-white/20 hover:scale-[1.02] transition-transform cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  item.status === 'Active' || item.status === 'Online' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {item.status || item.type || item.category}
                </div>
              </div>
              <h4 className="text-lg font-black mb-1">{item.name}</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {item.location || item.shop || `Stock: ${item.stock}` || item.role || item.contact}
              </p>
              {item.price && <p className="mt-2 text-indigo-500 font-black">{item.price}</p>}
              <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex gap-2">
                <button className="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all">Edit</button>
                <button className="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Remove</button>
              </div>
            </div>
          ))}
          
          {/* Add New Placeholder */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:border-indigo-500 transition-all">
            <div className="p-4 rounded-full bg-white dark:bg-slate-900 shadow-lg group-hover:scale-110 transition-transform">
              <Plus className="w-8 h-8 text-indigo-500" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500">Add New {activeItem.label.slice(0, -1)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col pt-20 pb-6 transition-all">
        <div className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as AdminView)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                currentView === item.id 
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block font-black text-sm uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 pt-20 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Admin Header */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-white/20">
            <div className="flex items-center gap-4">
              {renderRoleSwitcher && renderRoleSwitcher()}
              <div className="p-4 rounded-2xl bg-indigo-100 text-indigo-600">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">
                  {navItems.find(i => i.id === currentView)?.label}
                </h2>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                  System Management • Mbale Operations
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {currentView !== 'dashboard' && (
                <button 
                  onClick={() => currentView === 'shops' ? setIsAddingShop(true) : null}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add New
                </button>
              )}
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Update</p>
                <p className="text-xs font-bold">{new Date(lastUpdate).toLocaleTimeString()}</p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${connected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {connected ? 'Live' : 'Reconnecting'}
              </div>
              <button 
                onClick={fetchRiders}
                className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-all active:scale-90"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {currentView === 'dashboard' ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-white/20">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Riders</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-3xl font-black">{activeRiders.length}</h3>
                    <Bike className="w-8 h-8 text-indigo-500 opacity-20" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-white/20">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Users</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-3xl font-black">1,284</h3>
                    <Users className="w-8 h-8 text-blue-500 opacity-20" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-white/20">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pending Tasks</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-3xl font-black">{tasks.filter(t => t.status === 'Pending').length}</h3>
                    <ClipboardList className="w-8 h-8 text-yellow-500 opacity-20" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-white/20">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Daily Orders</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-3xl font-black">{tasks.length}</h3>
                    <Activity className="w-8 h-8 text-green-500 opacity-20" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-white/20">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System Status</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-green-500">HEALTHY</h3>
                    <CheckCircle2 className="w-8 h-8 text-green-500 opacity-20" />
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Map View */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-2xl border border-white/20 h-[400px] relative overflow-hidden">
                    <div className="absolute top-8 left-8 z-[1000] flex flex-col gap-2">
                      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3">
                        <MapIcon className="w-5 h-5 text-indigo-500" />
                        <span className="text-sm font-black uppercase tracking-widest">Live Fleet Map</span>
                      </div>
                      <button 
                        onClick={() => setIsMapEditMode(!isMapEditMode)}
                        className={`p-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3 transition-all ${
                          isMapEditMode 
                            ? 'bg-indigo-500 text-white' 
                            : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {isMapEditMode ? 'Exit Map Edit' : 'Manage Map'}
                        </span>
                      </button>
                    </div>
                    
                    <MapContainer 
                      center={[1.0821, 34.1750]} 
                      zoom={14} 
                      style={{ height: '100%', width: '100%', borderRadius: '2rem' }}
                      zoomControl={false}
                    >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                      <MapEvents />
                      
                      {/* Riders */}
                      {activeRiders.map(rider => (
                        <Marker key={rider.id} position={[rider.lat, rider.lng]} icon={RIDER_ICON}>
                          <Popup>
                            <div className="p-2">
                              <p className="font-black">{rider.name}</p>
                              <p className="text-xs text-slate-500">Status: {rider.status}</p>
                              {rider.taskStatus && (
                                <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mt-1">
                                  {rider.taskStatus.replace('_', ' ')}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1">Last seen: {new Date(rider.lastSeen).toLocaleTimeString()}</p>
                            </div>
                          </Popup>
                        </Marker>
                      ))}

                      {/* Shops */}
                      {shops.map(shop => (
                        <Marker key={shop.id} position={[shop.lat, shop.lng]} icon={SHOP_ICON}>
                          <Popup>
                            <div className="p-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Store className="w-3 h-3 text-indigo-500" />
                                <p className="font-black text-sm">{shop.name}</p>
                              </div>
                              <p className="text-[10px] text-slate-500 mb-2">{shop.location}</p>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => setShops(shops.filter(s => s.id !== shop.id))}
                                  className="px-2 py-1 bg-red-50 text-red-500 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      ))}

                      {/* Hubs */}
                      {hubs.map(hub => (
                        <Marker key={hub.id} position={[hub.lat, hub.lng]} icon={HUB_ICON}>
                          <Popup>
                            <div className="p-2">
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-3 h-3 text-emerald-500" />
                                <p className="font-black text-sm">{hub.name}</p>
                              </div>
                              <p className="text-[10px] text-slate-500 mb-2">{hub.location}</p>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => setHubs(hubs.filter(h => h.id !== hub.id))}
                                  className="px-2 py-1 bg-red-50 text-red-500 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>

                    {/* Map Add Modal */}
                    <AnimatePresence>
                      {mapClickPos && (
                        <div className="absolute inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/20 backdrop-blur-[2px]">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-2xl border border-white/20 w-full max-w-xs"
                          >
                            <h4 className="text-sm font-black uppercase tracking-widest mb-4">Add to Map</h4>
                            <div className="space-y-3">
                              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <button 
                                  onClick={() => setNewEntity({...newEntity, type: 'shop'})}
                                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${newEntity.type === 'shop' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-50'}`}
                                >
                                  Shop
                                </button>
                                <button 
                                  onClick={() => setNewEntity({...newEntity, type: 'hub'})}
                                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${newEntity.type === 'hub' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-50'}`}
                                >
                                  Hub
                                </button>
                              </div>
                              <input 
                                type="text" 
                                placeholder="Name"
                                value={newEntity.name}
                                onChange={(e) => setNewEntity({...newEntity, name: e.target.value as any})}
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-bold"
                              />
                              <input 
                                type="text" 
                                placeholder="Location Description"
                                value={newEntity.location}
                                onChange={(e) => setNewEntity({...newEntity, location: e.target.value as any})}
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-bold"
                              />
                              <div className="flex gap-2 pt-2">
                                <button 
                                  onClick={handleAddEntity}
                                  className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                                >
                                  Add
                                </button>
                                <button 
                                  onClick={() => setMapClickPos(null)}
                                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Recent Tasks Table */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-black flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-indigo-500" />
                        Recent Tasks
                      </h3>
                      <button 
                        onClick={() => setCurrentView('tasks')}
                        className="text-indigo-500 text-xs font-black uppercase tracking-widest"
                      >
                        View All
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-50 dark:border-slate-800">
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Task ID</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shop</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {tasks.slice(0, 5).map((task) => (
                            <tr key={task.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-4 text-sm font-black text-indigo-500">{task.id}</td>
                              <td className="py-4 text-sm font-bold text-slate-600 dark:text-slate-400">{task.customer}</td>
                              <td className="py-4 text-sm font-bold">{task.shop}</td>
                              <td className="py-4 text-sm font-black text-indigo-500">{task.amount}</td>
                              <td className="py-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                  task.status === 'Delivered' ? 'bg-green-100 text-green-600' :
                                  task.status === 'In Progress' ? 'bg-blue-100 text-blue-600' :
                                  'bg-yellow-100 text-yellow-600'
                                }`}>
                                  {task.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Sidebar: Rider List */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col h-full">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    Rider Fleet
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {activeRiders.length === 0 ? (
                      <div className="text-center py-12 opacity-50">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-sm font-bold">No active riders online</p>
                      </div>
                    ) : (
                      activeRiders.map(rider => (
                        <div key={rider.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">
                              {rider.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-sm">{rider.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Online</p>
                                {rider.taskStatus && (
                                  <span className="text-[9px] px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-black uppercase tracking-widest">
                                    {rider.taskStatus.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</p>
                            <p className="text-xs font-bold">{rider.lat.toFixed(4)}, {rider.lng.toFixed(4)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            renderManagementView()
          )}
        </div>
      </main>
    </div>
  );
}
