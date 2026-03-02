import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Search,
  ShoppingBag,
  Compass,
  Home as HomeIcon,
  Navigation,
  ChevronDown,
  X,
  Clock,
  Star,
  Flame,
  Bike,
  Shield,
  User,
  Menu,
  Plus,
  Minus,
  ShoppingCart,
} from 'lucide-react';
import Map from './components/Map';
import DeliveryTracker from './components/DeliveryTracker';
import AdminDashboard from './components/AdminDashboard';
import RiderDashboard from './components/RiderDashboard';
import { cn } from './utils/cn';
import { MBALE_CENTER, DELIVERY_RADIUS, HUBS, SHOPS } from './constants';
import type { UserRole, DeliveryLocation, NominatimResult, CartItem, MenuItem, Restaurant } from './types';
import L from 'leaflet';

// ─── Static menu data ────────────────────────────────────────────────────────
const MENU_ITEMS: MenuItem[] = [
  { id: 1, name: 'Signature Dish', price: '18,000 UGX', description: 'Our most popular item, prepared fresh.', image: 'https://picsum.photos/seed/dish1/200/200' },
  { id: 2, name: 'Family Pack', price: '45,000 UGX', description: 'Perfect for sharing with friends and family.', image: 'https://picsum.photos/seed/dish2/200/200' },
  { id: 3, name: 'Side Combo', price: '12,000 UGX', description: 'A great addition to any meal.', image: 'https://picsum.photos/seed/dish3/200/200' },
  { id: 4, name: 'Refreshing Drink', price: '5,000 UGX', description: 'Ice cold and perfectly sweet.', image: 'https://picsum.photos/seed/dish4/200/200' },
];

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [tempLocation, setTempLocation] = useState<[number, number]>(MBALE_CENTER);
  const [tempAddress, setTempAddress] = useState('Mbale Town');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isOutsideZone, setIsOutsideZone] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('user');
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  // ─── Cart state ────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const addToCart = (dish: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === dish.id);
      if (existing) {
        return prev.map(i => i.id === dish.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...dish, qty: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === id);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const getItemQty = (id: number) => cart.find(i => i.id === id)?.qty ?? 0;

  // ─── Splash ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // ─── Geocoding ─────────────────────────────────────────────────────────────
  const fetchAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      return (data as { display_name?: string }).display_name ?? 'Unknown location';
    } catch {
      return 'Mbale, Uganda';
    }
  };

  const handleLocationChange = async (latlng: L.LatLng) => {
    const dist = L.latLng(MBALE_CENTER).distanceTo(latlng);
    const outside = dist > DELIVERY_RADIUS;
    setIsOutsideZone(outside);
    setTempLocation([latlng.lat, latlng.lng]);
    if (!outside) {
      const addr = await fetchAddress(latlng.lat, latlng.lng);
      setTempAddress(addr);
    } else {
      setTempAddress('Outside delivery zone');
    }
  };

  // ─── Search with 300 ms debounce ───────────────────────────────────────────
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 3) { setSuggestions([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, Mbale`
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data.slice(0, 5));
      } catch {
        // silently fail — user can keep typing
      }
    }, 300);
  };

  const selectSuggestion = (place: NominatimResult) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    setSuggestions([]);
    setSearchQuery('');
    handleLocationChange(L.latLng(lat, lng));
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      handleLocationChange(L.latLng(pos.coords.latitude, pos.coords.longitude));
    });
  };

  const confirmLocation = () => {
    if (isOutsideZone) {
      alert('Delivery is only available inside Mbale town.');
      return;
    }
    setLocation({ lat: tempLocation[0], lng: tempLocation[1], address: tempAddress });
    setShowAddressPicker(false);
  };

  const startTracking = () => {
    if (!location) { setShowAddressPicker(true); return; }
    setIsTracking(true);
  };

  // ─── Role switcher ─────────────────────────────────────────────────────────
  // Defined BEFORE early returns so it can be passed as prop without hoisting confusion
  function renderRoleSwitcher() {
    return (
      <div className="relative z-[10000]">
        <button
          aria-label="Switch role"
          onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
          className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 active:scale-90 transition-all"
        >
          {isRoleMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        <AnimatePresence>
          {isRoleMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -20 }}
              className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2"
            >
              {[
                { role: 'user' as UserRole, Icon: User, label: 'User View' },
                { role: 'driver' as UserRole, Icon: Bike, label: 'Driver View' },
                { role: 'admin' as UserRole, Icon: Shield, label: 'Admin View' },
              ].map(({ role, Icon, label }) => (
                <button
                  key={role}
                  aria-label={label}
                  onClick={() => { setCurrentRole(role); setIsRoleMenuOpen(false); }}
                  className={cn(
                    'p-3 rounded-xl transition-all',
                    currentRole === role ? 'bg-primary text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                  title={label}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Role-based early returns ──────────────────────────────────────────────
  if (currentRole === 'admin') return <AdminDashboard renderRoleSwitcher={renderRoleSwitcher} />;
  if (currentRole === 'driver') return <RiderDashboard renderRoleSwitcher={renderRoleSwitcher} />;

  // ─── Restaurant detail with working cart ───────────────────────────────────
  const renderRestaurantDetail = (restaurant: Restaurant) => (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[60] bg-white flex flex-col"
    >
      <div className="relative h-64 shrink-0">
        <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          aria-label="Close restaurant"
          onClick={() => setSelectedRestaurant(null)}
          className="absolute top-6 left-6 p-3 bg-white/20 backdrop-blur-md rounded-full text-white active:scale-90 transition-all"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <h2 className="text-3xl font-black mb-1">{restaurant.name}</h2>
          <div className="flex items-center gap-3 text-sm font-bold opacity-90">
            <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-current" /> {restaurant.rating}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {restaurant.time}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black">Menu</h3>
          <div className="flex gap-2">
            <button aria-label="Search menu" className="p-2 bg-slate-100 rounded-xl">
              <Search className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {MENU_ITEMS.map(dish => {
            const qty = getItemQty(dish.id);
            return (
              <motion.div
                key={dish.id}
                className="flex gap-4 p-4 bg-slate-50 rounded-[2rem] border border-slate-100"
              >
                <div className="flex-1">
                  <h4 className="font-black text-slate-800 mb-1">{dish.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-2">{dish.description}</p>
                  <p className="text-sm font-black text-primary">{dish.price}</p>
                </div>
                <div className="w-24 shrink-0 flex flex-col gap-2">
                  <div className="w-24 h-20 rounded-2xl overflow-hidden">
                    <img src={dish.image} alt={dish.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  {qty === 0 ? (
                    <button
                      aria-label={`Add ${dish.name} to cart`}
                      onClick={() => addToCart(dish)}
                      className="w-full py-1.5 bg-primary text-white rounded-xl text-xs font-black shadow-lg shadow-primary/20 active:scale-90 transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-primary rounded-xl overflow-hidden">
                      <button
                        aria-label="Remove one"
                        onClick={() => removeFromCart(dish.id)}
                        className="p-1.5 text-white active:scale-90 transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-white font-black text-sm">{qty}</span>
                      <button
                        aria-label="Add one more"
                        onClick={() => addToCart(dish)}
                        className="p-1.5 text-white active:scale-90 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="p-6 bg-white border-t border-slate-100">
        <button
          onClick={() => {
            if (cartCount === 0) return;
            setSelectedRestaurant(null);
            setShowCart(true);
          }}
          disabled={cartCount === 0}
          className={cn(
            'w-full py-5 rounded-[2rem] font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3',
            cartCount > 0
              ? 'bg-primary text-white shadow-primary/20 active:scale-95'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          <ShoppingBag className="w-6 h-6" />
          {cartCount > 0 ? `View Basket (${cartCount})` : 'Add items to basket'}
        </button>
      </div>
    </motion.div>
  );

  // ─── Cart sheet ────────────────────────────────────────────────────────────
  const renderCartSheet = () => (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[60] bg-white flex flex-col"
    >
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-2xl font-black">Your Basket</h2>
        <button aria-label="Close basket" onClick={() => setShowCart(false)} className="p-2 bg-slate-100 rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingCart className="w-16 h-16 text-slate-200 mb-4" />
            <p className="font-bold text-slate-400">Your basket is empty</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <img src={item.image} alt={item.name} className="w-14 h-14 rounded-xl object-cover" referrerPolicy="no-referrer" />
              <div className="flex-1">
                <p className="font-black text-sm">{item.name}</p>
                <p className="text-xs text-primary font-black">{item.price}</p>
              </div>
              <div className="flex items-center gap-2 bg-primary rounded-xl overflow-hidden">
                <button aria-label="Remove one" onClick={() => removeFromCart(item.id)} className="p-2 text-white"><Minus className="w-3 h-3" /></button>
                <span className="text-white font-black text-sm w-4 text-center">{item.qty}</span>
                <button aria-label="Add one more" onClick={() => addToCart(item)} className="p-2 text-white"><Plus className="w-3 h-3" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="p-6 bg-white border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between text-sm font-black text-slate-500">
            <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            <span className="text-slate-800 text-base">Checkout →</span>
          </div>
          <button
            onClick={() => { setShowCart(false); startTracking(); }}
            className="w-full bg-primary text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <ShoppingBag className="w-6 h-6" />
            Place Order
          </button>
        </div>
      )}
    </motion.div>
  );

  // ─── Main user UI ──────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-slate-50 font-sans overflow-x-hidden">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-primary flex flex-col items-center justify-center text-white"
          >
            <motion.div animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="mb-4">
              <img src="https://cdn-icons-png.flaticon.com/512/9561/9561688.png" alt="Delivery Bike" className="w-40 h-40 drop-shadow-2xl" referrerPolicy="no-referrer" />
            </motion.div>
            <motion.h1 animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-5xl font-black text-secondary tracking-tighter">
              KIRYA
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pb-24">
        {/* Header */}
        <header className="bg-white px-5 pt-6 pb-4 sticky top-0 z-40 border-b border-slate-100 flex items-center gap-3">
          <div className="shrink-0">{renderRoleSwitcher()}</div>
          <button
            onClick={() => setShowAddressPicker(true)}
            className="flex items-center gap-2 bg-accent/30 px-4 py-2 rounded-full flex-1 text-left transition-transform active:scale-95"
          >
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate flex-1">
              {location ? location.address : 'Set delivery address'}
            </span>
            <ChevronDown className="w-4 h-4 text-primary shrink-0" />
          </button>
          {/* Cart badge */}
          {cartCount > 0 && (
            <button
              aria-label={`View cart (${cartCount} items)`}
              onClick={() => setShowCart(true)}
              className="relative p-2 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 active:scale-90 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-white text-primary text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-primary/20">
                {cartCount}
              </span>
            </button>
          )}
        </header>

        {!location ? (
          /* Fixed empty state copy */
          <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
            <div className="w-32 h-32 bg-accent/20 rounded-full flex items-center justify-center mb-6">
              <HomeIcon className="w-16 h-16 text-primary/40" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Set your location to get started</h2>
            <p className="text-slate-500 mt-2">Tell us where to deliver and we'll show you what's available near you.</p>
            <button
              onClick={() => setShowAddressPicker(true)}
              className="mt-8 w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
            >
              Enter delivery address
            </button>
          </div>
        ) : (
          <div className="px-5 py-6 space-y-8">
            {/* Categories */}
            <section>
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-xl font-black tracking-tight">Categories</h3>
                <button className="text-primary text-sm font-black uppercase tracking-widest">See all</button>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5">
                {[
                  { name: 'Food', icon: '🍔', color: 'bg-orange-100 text-orange-600' },
                  { name: 'Grocery', icon: '🛒', color: 'bg-green-100 text-green-600' },
                  { name: 'Drinks', icon: '🥤', color: 'bg-blue-100 text-blue-600' },
                  { name: 'Pharmacy', icon: '💊', color: 'bg-red-100 text-red-600' },
                  { name: 'Packages', icon: '📦', color: 'bg-purple-100 text-purple-600' },
                ].map(cat => (
                  <motion.button
                    key={cat.name}
                    whileTap={{ scale: 0.95 }}
                    aria-label={`Browse ${cat.name}`}
                    className="flex flex-col items-center gap-3 min-w-[80px]"
                  >
                    <div className={cn('w-20 h-20 rounded-[2rem] flex items-center justify-center text-3xl shadow-sm transition-transform hover:scale-105', cat.color)}>
                      {cat.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{cat.name}</span>
                  </motion.button>
                ))}
              </div>
            </section>

            {/* Featured */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
                  <h3 className="text-xl font-black tracking-tight">Popular Near You</h3>
                </div>
                <button className="text-primary text-sm font-black uppercase tracking-widest">Filters</button>
              </div>
              <div className="space-y-6">
                {(
                  [
                    { name: 'Mbale Fried Chicken', rating: 4.8, time: '15-20 min', image: 'https://picsum.photos/seed/chicken/800/400', tags: ['Fast Food', 'Chicken'], priceRange: '$$' },
                    { name: 'The Coffee Hub', rating: 4.5, time: '10-15 min', image: 'https://picsum.photos/seed/coffee/800/400', tags: ['Cafe', 'Breakfast'], priceRange: '$$$' },
                    { name: 'Mama Africa Kitchen', rating: 4.9, time: '25-30 min', image: 'https://picsum.photos/seed/kitchen/800/400', tags: ['Local', 'Traditional'], priceRange: '$' },
                  ] satisfies Restaurant[]
                ).map(item => (
                  <motion.div
                    key={item.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedRestaurant(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setSelectedRestaurant(item)}
                    aria-label={`Open ${item.name}`}
                    className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-100 cursor-pointer group"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-2xl flex items-center gap-1 shadow-lg">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-black">{item.rating}</span>
                      </div>
                      <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur px-3 py-1.5 rounded-2xl text-white text-xs font-black uppercase tracking-widest">
                        {item.time}
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xl font-black text-slate-800">{item.name}</h4>
                        <span className="text-primary font-black">{item.priceRange}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        {item.tags.map((tag, idx) => (
                          <span key={tag} className="flex items-center gap-2">
                            {tag}
                            {idx < item.tags.length - 1 && <span className="w-1 h-1 bg-slate-200 rounded-full" />}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Bottom Navbar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex justify-around items-center z-40">
        {[
          { id: 'home', Icon: HomeIcon, label: 'Home' },
          { id: 'discover', Icon: Compass, label: 'Discover' },
          { id: 'orders', Icon: ShoppingBag, label: 'Orders' },
        ].map(({ id, Icon, label }) => (
          <button
            key={id}
            aria-label={label}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex flex-col items-center gap-1 transition-all duration-300 px-4 py-2 rounded-xl',
              activeTab === id ? 'bg-secondary text-slate-900' : 'text-slate-400'
            )}
          >
            <Icon className={cn('w-6 h-6', activeTab === id && 'fill-current')} />
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
          </button>
        ))}
      </nav>

      {/* Address Picker Modal */}
      <AnimatePresence>
        {showAddressPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddressPicker(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[60] h-[92vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 flex flex-col h-full">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-extrabold text-slate-800">Select Location</h2>
                  <button aria-label="Close picker" onClick={() => setShowAddressPicker(false)} className="p-2 bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search landmark, street, building..."
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-2xl mt-2 overflow-hidden z-20 border border-slate-100">
                      {suggestions.map(s => (
                        <button
                          key={s.place_id}
                          onClick={() => selectSuggestion(s)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-none text-sm font-medium text-slate-700"
                        >
                          {s.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Map */}
                <div className="flex-1 min-h-0 relative mb-4">
                  <Map
                    center={MBALE_CENTER}
                    radius={DELIVERY_RADIUS}
                    onLocationChange={handleLocationChange}
                    markerPos={tempLocation}
                    allHubs={HUBS}
                    allShops={SHOPS}
                  />
                  <button
                    aria-label="Detect my location"
                    onClick={detectLocation}
                    className="absolute bottom-4 right-4 z-10 p-4 bg-white rounded-2xl shadow-xl text-primary active:scale-95 transition-transform"
                  >
                    <Navigation className="w-6 h-6 fill-current" />
                  </button>
                </div>

                {/* Selected Info */}
                <div className={cn(
                  'p-5 rounded-3xl mb-6 transition-colors',
                  isOutsideZone ? 'bg-red-50 border border-red-100' : 'bg-accent/20 border border-accent/30'
                )}>
                  <div className="flex items-start gap-3">
                    <MapPin className={cn('w-5 h-5 mt-0.5', isOutsideZone ? 'text-red-500' : 'text-primary')} />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                        {isOutsideZone ? 'Out of zone' : 'Delivery to'}
                      </p>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{tempAddress}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={confirmLocation}
                  disabled={isOutsideZone}
                  className={cn(
                    'w-full py-5 rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95',
                    isOutsideZone
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-primary text-white shadow-primary/30'
                  )}
                >
                  Confirm Location
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Restaurant Detail */}
      <AnimatePresence>
        {selectedRestaurant && renderRestaurantDetail(selectedRestaurant)}
      </AnimatePresence>

      {/* Cart Sheet */}
      <AnimatePresence>
        {showCart && renderCartSheet()}
      </AnimatePresence>

      {/* Delivery Tracker */}
      <AnimatePresence>
        {isTracking && location && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[100]"
          >
            <DeliveryTracker
              deliveryLocation={[location.lat, location.lng]}
              onClose={() => { setIsTracking(false); setCart([]); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
