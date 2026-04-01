/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { 
  TrendingUp, Users, ShoppingBag, DollarSign, 
  Calendar, Filter, Search, ChevronDown, Download,
  CreditCard, Wallet, Banknote, Smartphone, Upload, FileText,
  User as UserIcon, LogOut, Settings, ShieldCheck, Mail, Lock, User as UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, parseISO, startOfDay, endOfDay, isWithinInterval,
  subDays, subMonths, startOfMonth, endOfMonth 
} from 'date-fns';
import Papa from 'papaparse';
import { Order, RAW_DATA, parseData, CITIES } from './data';
import { SalesMap } from './components/SalesMap';
import { ModernDatePicker } from './components/ModernDatePicker';
import { 
  auth, signInWithGoogle, logout, onAuthStateChanged, db, doc, onSnapshot, updateDoc,
  signUpWithEmail, loginWithEmail
} from './firebase';

const COLORS = ['#141414', '#5A5A40', '#F27D26', '#8E9299', '#7C3AED'];
const PAYMENT_COLORS: Record<string, string> = {
  'Credit Card': '#141414',
  'eWallet': '#F27D26',
  'Cash': '#5A5A40',
  'Debit Card': '#8E9299'
};

const StatCard = ({ title, value, icon: Icon, trend }: { title: string, value: string, icon: any, trend?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-[1rem] sm:p-[1.5rem] border border-[#141414]/10 rounded-[0.75rem] shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex justify-between items-start mb-[0.75rem] sm:mb-[1rem]">
      <div className="p-[0.4rem] sm:p-[0.5rem] bg-[#141414]/5 rounded-[0.5rem]">
        <Icon className="w-[1rem] h-[1rem] sm:w-[1.25rem] sm:h-[1.25rem] text-[#141414]" />
      </div>
      {trend && (
        <span className="text-[0.65rem] sm:text-[0.7rem] font-medium text-emerald-600 bg-emerald-50 px-[0.4rem] sm:px-[0.5rem] py-[0.2rem] sm:py-[0.25rem] rounded-full">
          {trend}
        </span>
      )}
    </div>
    <p className="text-[0.875rem] sm:text-[1rem] font-medium text-[#141414]/60 uppercase tracking-wider mb-[0.2rem] sm:mb-[0.25rem]">{title}</p>
    <h3 className="text-[1.5rem] sm:text-[1.75rem] font-bold text-[#141414] font-mono break-all">{value}</h3>
  </motion.div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  // Email Auth State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allOrders, setAllOrders] = useState<Order[]>(() => parseData(RAW_DATA));
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [datePreset, setDatePreset] = useState('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Profile Listener
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data);
        setNewName(data.displayName);
        setNewUsername(data.username || '');
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user || !newName.trim()) return;
    try {
      const updates: any = {
        displayName: newName.trim(),
        username: newUsername.trim()
      };
      if (newPhoto) {
        updates.photoURL = newPhoto;
      }
      await updateDoc(doc(db, 'users', user.uid), updates);
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 150000) { // Limit to ~150KB for base64 storage in Firestore
        alert('Image is too large. Please select an image under 150KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const products = useMemo(() => ['All', ...new Set(allOrders.map(o => o.product))], [allOrders]);
  const paymentMethods = useMemo(() => ['All', ...new Set(allOrders.map(o => o.paymentMethod))], [allOrders]);

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    let start = '';
    let end = '';

    switch (preset) {
      case 'Last 7 Days':
        start = format(subDays(now, 7), 'yyyy-MM-dd');
        end = format(now, 'yyyy-MM-dd');
        break;
      case 'This Month':
        start = format(startOfMonth(now), 'yyyy-MM-dd');
        end = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'Last Month':
        const lastMonth = subMonths(now, 1);
        start = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        end = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        break;
      case 'All':
        start = '';
        end = '';
        break;
      default:
        return;
    }
    setDateRange({ start, end });
  };

  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.product.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProduct = productFilter === 'All' || order.product === productFilter;
      const matchesPayment = paymentFilter === 'All' || order.paymentMethod === paymentFilter;
      
      let matchesDate = true;
      if (dateRange.start && dateRange.end) {
        try {
          const orderDate = parseISO(order.date);
          matchesDate = isWithinInterval(orderDate, {
            start: startOfDay(parseISO(dateRange.start)),
            end: endOfDay(parseISO(dateRange.end))
          });
        } catch (e) {
          matchesDate = true;
        }
      }

      return matchesSearch && matchesProduct && matchesPayment && matchesDate;
    });
  }, [allOrders, searchTerm, productFilter, paymentFilter, dateRange]);

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.price, 0);
    const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
    const uniqueProducts = new Set(filteredOrders.map(o => o.product)).size;
    
    return {
      revenue: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      orders: filteredOrders.length.toString(),
      avgValue: `$${avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      products: uniqueProducts.toString()
    };
  }, [filteredOrders]);

  const revenueByDate = useMemo(() => {
    const data: Record<string, number> = {};
    filteredOrders.forEach(o => {
      data[o.date] = (data[o.date] || 0) + o.price;
    });
    return Object.entries(data)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

  const salesByProduct = useMemo(() => {
    const data: Record<string, number> = {};
    filteredOrders.forEach(o => {
      data[o.product] = (data[o.product] || 0) + 1;
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredOrders]);

  const paymentDistribution = useMemo(() => {
    const data: Record<string, number> = {};
    filteredOrders.forEach(o => {
      data[o.paymentMethod] = (data[o.paymentMethod] || 0) + 1;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedData: Order[] = results.data.map((row: any, index: number) => {
            const cityData = CITIES[index % CITIES.length];
            return {
              orderNumber: row['Order Number'] || row['orderNumber'] || '',
              product: row['Product'] || row['product'] || '',
              price: parseFloat((row['Price'] || row['price'] || '0').toString().replace(/[$,]/g, '')),
              date: row['Date'] || row['date'] || '',
              paymentMethod: row['Payment Method'] || row['paymentMethod'] || '',
              lat: cityData.lat,
              lng: cityData.lng,
              city: cityData.name
            };
          }).filter((order: Order) => order.orderNumber && !isNaN(order.price));

          if (parsedData.length > 0) {
            setAllOrders(prev => [...prev, ...parsedData]);
            // Reset filters to show new data
            setSearchTerm('');
            setProductFilter('All');
            setPaymentFilter('All');
            setDateRange({ start: '', end: '' });
            setDatePreset('All');
          } else {
            alert('No valid sales data found in the CSV file.');
          }
        } catch (err) {
          console.error('CSV Parsing Error:', err);
          alert('Error parsing CSV file. Please ensure it follows the correct format.');
        }
        // Clear the input so the same file can be uploaded again
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (error) => {
        console.error('PapaParse Error:', error);
        alert('Error reading the CSV file.');
      }
    });
  };

  const handleDownload = () => {
    if (filteredOrders.length === 0) return;

    const headers = ['Order Number', 'Product', 'Price', 'Date', 'Payment Method'];
    const csvContent = [
      headers.join(','),
      ...filteredOrders.map(o => [
        o.orderNumber,
        `"${o.product}"`,
        `$${o.price.toFixed(2)}`,
        o.date,
        o.paymentMethod
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const result = await signInWithGoogle();
      if (!result) return;
    } catch (error: any) {
      setAuthError('Failed to sign in with Google. Please try again.');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);
    try {
      if (authMode === 'signup') {
        if (!displayName.trim()) throw new Error('Please enter your name.');
        if (!username.trim()) throw new Error('Please enter a username.');
        await signUpWithEmail(email, password, displayName, username);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (error: any) {
      let msg = 'Authentication failed.';
      if (error.code === 'auth/email-already-in-use') msg = 'This email is already in use. Try logging in instead.';
      if (error.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
      if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      if (error.code === 'auth/operation-not-allowed') msg = 'Email/Password sign-in is not enabled in Firebase Console.';
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-[2rem] h-[2rem] border-4 border-[#141414]/10 border-t-[#141414] rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-[1rem]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-[2rem] sm:p-[3rem] border border-[#141414]/10 rounded-[1.5rem] shadow-2xl max-w-[32rem] w-full"
        >
          <div className="text-center mb-[2rem]">
            <div className="bg-[#141414] w-[3.5rem] h-[3.5rem] rounded-[1rem] flex items-center justify-center mx-auto mb-[1rem]">
              <TrendingUp className="w-[1.75rem] h-[1.75rem] text-white" />
            </div>
            <h1 className="text-[1.75rem] font-bold mb-[0.25rem]">SalesPulse</h1>
            <p className="text-[#141414]/60 text-[0.875rem]">
              {authMode === 'login' ? 'Welcome back. Please log in.' : 'Create your account to get started.'}
            </p>
          </div>
          
          {authError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-[1.5rem] p-[0.75rem] bg-red-50 border border-red-100 rounded-[0.5rem] text-red-600 text-[0.8125rem] font-medium flex items-center gap-[0.5rem]"
            >
              <div className="w-[0.25rem] h-[0.25rem] bg-red-600 rounded-full" />
              {authError}
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-[1rem] mb-[1.5rem]">
            {authMode === 'signup' && (
              <>
                <div className="relative">
                  <UserCircle className="absolute left-[1rem] top-1/2 -translate-y-1/2 w-[1rem] h-[1rem] text-[#141414]/40" />
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    required
                    className="w-full pl-[2.75rem] pr-[1rem] py-[0.875rem] bg-[#141414]/5 border border-transparent rounded-[0.75rem] focus:ring-2 focus:ring-[#141414]/10 focus:outline-none font-medium text-[0.875rem] transition-all"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-[1rem] top-1/2 -translate-y-1/2 text-[0.875rem] font-bold text-[#141414]/40">@</span>
                  <input 
                    type="text" 
                    placeholder="Username" 
                    required
                    className="w-full pl-[2.75rem] pr-[1rem] py-[0.875rem] bg-[#141414]/5 border border-transparent rounded-[0.75rem] focus:ring-2 focus:ring-[#141414]/10 focus:outline-none font-medium text-[0.875rem] transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  />
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-[1rem] top-1/2 -translate-y-1/2 w-[1rem] h-[1rem] text-[#141414]/40" />
              <input 
                type="email" 
                placeholder="Email Address" 
                required
                className="w-full pl-[2.75rem] pr-[1rem] py-[0.875rem] bg-[#141414]/5 border border-transparent rounded-[0.75rem] focus:ring-2 focus:ring-[#141414]/10 focus:outline-none font-medium text-[0.875rem] transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-[1rem] top-1/2 -translate-y-1/2 w-[1rem] h-[1rem] text-[#141414]/40" />
              <input 
                type="password" 
                placeholder="Password" 
                required
                minLength={6}
                className="w-full pl-[2.75rem] pr-[1rem] py-[0.875rem] bg-[#141414]/5 border border-transparent rounded-[0.75rem] focus:ring-2 focus:ring-[#141414]/10 focus:outline-none font-medium text-[0.875rem] transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-[1rem] bg-[#141414] text-white rounded-[0.75rem] font-bold hover:opacity-90 transition-all active:scale-[0.98] shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : (authMode === 'login' ? 'Log In' : 'Create Account')}
            </button>
          </form>

          <div className="relative mb-[1.5rem]">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#141414]/10"></div>
            </div>
            <div className="relative flex justify-center text-[0.75rem] uppercase tracking-widest font-bold">
              <span className="bg-white px-[1rem] text-[#141414]/40">Or continue with</span>
            </div>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-[0.75rem] px-[1.5rem] py-[0.875rem] bg-white border border-[#141414]/10 text-[#141414] rounded-[0.75rem] font-bold hover:bg-[#141414]/5 transition-all active:scale-[0.98]"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-[1.25rem] h-[1.25rem]" alt="Google" />
            Google
          </button>
          
          <div className="mt-[2rem] text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError(null);
              }}
              className="text-[0.875rem] font-bold text-[#141414]/60 hover:text-[#141414] transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#F27D26] selection:text-white">
      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-[1rem]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white p-[2rem] border border-[#141414]/10 rounded-[1rem] shadow-2xl max-w-[24rem] w-full"
            >
              <h3 className="text-[1.25rem] font-bold mb-[1.5rem]">Profile Settings</h3>
              <div className="space-y-[1.5rem]">
                <div className="flex flex-col items-center gap-[1rem]">
                  <div className="relative group">
                    <div className="w-[5rem] h-[5rem] bg-[#F27D26] rounded-full flex items-center justify-center text-white font-bold text-[2rem] overflow-hidden border-2 border-[#141414]/5">
                      {(newPhoto || userProfile?.photoURL) ? (
                        <img src={newPhoto || userProfile?.photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        userProfile?.displayName?.charAt(0) || 'U'
                      )}
                    </div>
                    <button 
                      onClick={() => profilePhotoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-[0.4rem] bg-[#141414] text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <Upload className="w-[0.75rem] h-[0.75rem]" />
                    </button>
                    <input 
                      type="file" 
                      ref={profilePhotoInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  <p className="text-[0.7rem] text-[#141414]/40 font-medium">Click to upload new picture (max 150KB)</p>
                </div>

                <div>
                  <label className="block text-[0.7rem] font-bold uppercase tracking-widest text-[#141414]/40 mb-[0.5rem]">Display Name</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-[1rem] py-[0.75rem] bg-[#141414]/5 border border-transparent rounded-[0.5rem] focus:ring-2 focus:ring-[#141414]/10 focus:outline-none font-medium"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-[0.7rem] font-bold uppercase tracking-widest text-[#141414]/40 mb-[0.5rem]">Username</label>
                  <div className="relative">
                    <span className="absolute left-[1rem] top-1/2 -translate-y-1/2 text-[0.875rem] font-bold text-[#141414]/40">@</span>
                    <input 
                      type="text" 
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full pl-[2.25rem] pr-[1rem] py-[0.75rem] bg-[#141414]/5 border border-transparent rounded-[0.5rem] focus:ring-2 focus:ring-[#141414]/10 focus:outline-none font-medium"
                      placeholder="username"
                    />
                  </div>
                </div>
                <div className="pt-[0.5rem] flex gap-[0.75rem]">
                  <button 
                    onClick={handleUpdateProfile}
                    className="flex-1 px-[1rem] py-[0.75rem] bg-[#141414] text-white rounded-[0.5rem] font-bold hover:opacity-90 transition-all"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      setNewPhoto(null);
                    }}
                    className="px-[1rem] py-[0.75rem] bg-[#141414]/5 text-[#141414] rounded-[0.5rem] font-bold hover:bg-[#141414]/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".csv" 
        className="hidden" 
      />

      <main className="max-w-[80rem] mx-auto px-[1rem] sm:px-[1.5rem] lg:px-[2rem] py-[2rem]">
        {/* Logo & User Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-[1.5rem] mb-[3rem]">
          <div className="flex items-center gap-[0.75rem]">
            <div className="bg-[#141414] p-[0.5rem] rounded-[0.5rem]">
              <TrendingUp className="w-[1.25rem] h-[1.25rem] text-white" />
            </div>
            <h1 className="text-[1.25rem] font-bold tracking-tight">SalesPulse</h1>
          </div>
          
          <div className="flex items-center gap-[1rem] bg-white px-[1rem] py-[0.5rem] border border-[#141414]/10 rounded-full shadow-sm">
            <div className="flex items-center gap-[0.5rem] border-r border-[#141414]/10 pr-[1rem]">
              <div className="w-[2rem] h-[2rem] bg-[#F27D26] rounded-full flex items-center justify-center text-white font-bold text-[0.875rem] overflow-hidden">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userProfile?.displayName?.charAt(0) || 'U'
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[0.875rem] font-bold leading-tight">{userProfile?.displayName || 'User'}</span>
                {userProfile?.username && (
                  <span className="text-[0.65rem] font-bold text-[#141414]/40">@{userProfile.username}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-[0.5rem]">
              <button 
                onClick={() => setIsProfileModalOpen(true)}
                className="p-[0.5rem] hover:bg-[#141414]/5 rounded-full transition-colors group"
                title="Profile Settings"
              >
                <Settings className="w-[1.125rem] h-[1.125rem] text-[#141414]/40 group-hover:text-[#141414]" />
              </button>
              <button 
                onClick={logout}
                className="p-[0.5rem] hover:bg-red-50 rounded-full transition-colors group"
                title="Logout"
              >
                <LogOut className="w-[1.125rem] h-[1.125rem] text-[#141414]/40 group-hover:text-red-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="mb-[1.5rem] sm:mb-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-[1rem]">
          <div>
            <h2 className="text-[1.5rem] sm:text-[2.25rem] font-bold tracking-tight mb-[0.25rem] sm:mb-[0.5rem]">Dashboard Overview</h2>
            <p className="text-[#141414]/60 text-[0.875rem] sm:text-[1rem]">Welcome back. Here's what's happening with your sales today.</p>
          </div>
          <div className="flex items-center gap-[0.75rem] w-full sm:w-auto">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-[0.5rem] px-[1rem] py-[0.75rem] bg-white border border-[#141414]/10 rounded-[0.5rem] font-bold text-[0.875rem] hover:bg-[#141414]/5 transition-colors shadow-sm"
            >
              <Upload className="w-[1rem] h-[1rem]" />
              Upload CSV
            </button>
            <button 
              onClick={handleDownload}
              className="flex-1 sm:flex-none flex items-center justify-center gap-[0.5rem] px-[1rem] py-[0.75rem] bg-[#141414] text-white rounded-[0.5rem] font-bold text-[0.875rem] hover:opacity-80 active:scale-[0.98] transition-all shadow-sm"
            >
              <Download className="w-[1rem] h-[1rem]" />
              Export
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <section className="mb-[2rem] space-y-[1rem]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1rem]">
            <div className="relative">
              <select 
                className="w-full appearance-none pl-[1rem] pr-[2.5rem] py-[0.75rem] bg-white border-none rounded-[0.5rem] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/5 cursor-pointer text-[0.875rem]"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              >
                {products.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="absolute right-[0.75rem] top-1/2 -translate-y-1/2 w-[1rem] h-[1rem] pointer-events-none opacity-40" />
            </div>
            <div className="relative">
              <select 
                className="w-full appearance-none pl-[1rem] pr-[2.5rem] py-[0.75rem] bg-white border-none rounded-[0.5rem] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/5 cursor-pointer text-[0.875rem]"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-[0.75rem] top-1/2 -translate-y-1/2 w-[1rem] h-[1rem] pointer-events-none opacity-40" />
            </div>
            <div className="relative">
              <select 
                className="w-full appearance-none pl-[1rem] pr-[2.5rem] py-[0.75rem] bg-white border-none rounded-[0.5rem] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/5 cursor-pointer text-[0.875rem]"
                value={datePreset}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="All">All Time</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="This Month">This Month</option>
                <option value="Last Month">Last Month</option>
                <option value="Custom">Custom Range</option>
              </select>
              <ChevronDown className="absolute right-[0.75rem] top-1/2 -translate-y-1/2 w-[1rem] h-[1rem] pointer-events-none opacity-40" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1rem] w-full">
            <ModernDatePicker 
              label="From" 
              value={dateRange.start} 
              onChange={(date) => {
                setDateRange(prev => ({ ...prev, start: date }));
                setDatePreset('Custom');
              }} 
            />
            <ModernDatePicker 
              label="To" 
              value={dateRange.end} 
              onChange={(date) => {
                setDateRange(prev => ({ ...prev, end: date }));
                setDatePreset('Custom');
              }} 
            />
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1.5rem] mb-[2rem]">
          <StatCard title="Total Revenue" value={stats.revenue} icon={DollarSign} trend="+12.5%" />
          <StatCard title="Total Orders" value={stats.orders} icon={ShoppingBag} trend="+8.2%" />
          <StatCard title="Avg. Order Value" value={stats.avgValue} icon={TrendingUp} />
          <StatCard title="Active Products" value={stats.products} icon={Users} />
        </section>

        {/* Charts Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-[1.5rem] mb-[2rem]">
          {/* Revenue Over Time */}
          <div className="lg:col-span-2 bg-white p-[1.5rem] border border-[#141414]/10 rounded-[0.75rem] shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-[1rem] mb-[1.5rem]">
              <h3 className="font-bold text-[1.125rem]">Revenue Trends</h3>
              <div className="flex items-center gap-[0.5rem] text-[0.75rem] font-medium text-[#141414]/60">
                <div className="w-[0.75rem] h-[0.75rem] bg-[#141414] rounded-full" />
                Daily Revenue
              </div>
            </div>
            <div className="h-[25rem] sm:h-[30rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueByDate} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#14141460' }}
                    tickFormatter={(val) => {
                      try {
                        return format(parseISO(val), 'MMM d');
                      } catch (e) {
                        return val;
                      }
                    }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#14141460' }}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #14141410', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}
                    labelFormatter={(val) => {
                      try {
                        return format(parseISO(val as string), 'MMMM d, yyyy');
                      } catch (e) {
                        return val;
                      }
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#141414" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: '#141414' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Distribution */}
          <div className="bg-white p-[1.5rem] border border-[#141414]/10 rounded-[0.75rem] shadow-sm">
            <h3 className="font-bold text-[1.125rem] mb-[1.5rem]">Payment Methods</h3>
            <div className="h-[25rem] sm:h-[30rem] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius="80%"
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {paymentDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PAYMENT_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                        className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #14141410', fontFamily: 'Poppins, sans-serif', fontSize: '14px' }} />
                  <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontFamily: 'Poppins, sans-serif', fontSize: '12px', paddingTop: '20px' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sales by Product */}
          <div className="lg:col-span-3 bg-white p-[1rem] sm:p-[1.5rem] border border-[#141414]/10 rounded-[0.75rem] shadow-sm">
            <h3 className="font-bold text-[1.125rem] mb-[1.5rem]">Sales by Product</h3>
            <div className="h-[30rem] sm:h-[35rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByProduct} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#14141410" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#14141460' }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#141414', fontWeight: 500 }}
                    width={140}
                  />
                  <Tooltip 
                    cursor={{ fill: '#14141405' }}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #14141410', fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#141414" 
                    radius={[0, 4, 4, 0]} 
                    barSize={24}
                    activeBar={{ fill: '#F27D26' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Geographical Distribution */}
        <section className="mb-[2rem]">
          <div className="bg-white p-[1rem] sm:p-[1.5rem] border border-[#141414]/10 rounded-[0.75rem] shadow-sm">
            <h3 className="font-bold text-[1.125rem] mb-[1.5rem]">Geographical Distribution</h3>
            <div className="h-[25rem] sm:h-[30rem] w-full">
              <SalesMap orders={filteredOrders} />
            </div>
          </div>
        </section>

        {/* Data Table */}
        <section className="bg-white border border-[#141414]/10 rounded-[0.75rem] shadow-sm overflow-hidden">
          <div className="p-[1.5rem] border-b border-[#141414]/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-[1rem]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-[1rem] w-full lg:w-auto">
              <div className="flex items-center gap-[0.5rem] flex-shrink-0">
                <FileText className="w-[1.25rem] h-[1.25rem] text-[#141414]/40" />
                <h3 className="font-bold text-[1.125rem]">Recent Transactions</h3>
              </div>
              <div className="relative w-full sm:w-[20rem]">
                <Search className="absolute left-[0.75rem] top-1/2 -translate-y-1/2 w-[0.875rem] h-[0.875rem] text-[#141414]/40" />
                <input 
                  type="text" 
                  placeholder="Search products, IDs..." 
                  className="w-full pl-[2.25rem] pr-[0.75rem] py-[0.5rem] bg-[#141414]/5 border border-none rounded-[0.5rem] focus:outline-none focus:ring-2 focus:ring-[#141414]/5 transition-all text-[0.8125rem]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <span className="text-[0.7rem] font-medium text-[#141414]/40 uppercase tracking-widest whitespace-nowrap">
              Showing {filteredOrders.length} of {allOrders.length} orders
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[50rem]">
              <thead>
                <tr className="bg-[#141414]/5">
                  <th className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-wider text-[#141414]/40">Order ID</th>
                  <th className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-wider text-[#141414]/40">Product</th>
                  <th className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-wider text-[#141414]/40">City</th>
                  <th className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-wider text-[#141414]/40">Date</th>
                  <th className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-wider text-[#141414]/40">Payment</th>
                  <th className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-wider text-[#141414]/40 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/5">
                {filteredOrders.map((order) => (
                  <motion.tr 
                    key={`${order.orderNumber}-${order.product}-${order.date}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-[#141414]/5 transition-colors group cursor-default"
                  >
                    <td className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.8125rem] sm:text-[0.875rem] font-mono font-medium">{order.orderNumber}</td>
                    <td className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.8125rem] sm:text-[0.875rem] font-medium">{order.product}</td>
                    <td className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.8125rem] sm:text-[0.875rem] text-[#141414]/60">{order.city}</td>
                    <td className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.8125rem] sm:text-[0.875rem] text-[#141414]/60">
                      {(() => {
                        try {
                          return format(parseISO(order.date), 'MMM d, yyyy');
                        } catch (e) {
                          return order.date;
                        }
                      })()}
                    </td>
                    <td className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem]">
                      <div className="flex items-center gap-[0.5rem]">
                        {order.paymentMethod === 'Credit Card' && <CreditCard className="w-[1rem] h-[1rem] opacity-40" />}
                        {order.paymentMethod === 'eWallet' && <Smartphone className="w-[1rem] h-[1rem] opacity-40" />}
                        {order.paymentMethod === 'Cash' && <Banknote className="w-[1rem] h-[1rem] opacity-40" />}
                        {order.paymentMethod === 'Debit Card' && <Wallet className="w-[1rem] h-[1rem] opacity-40" />}
                        <span className="text-[0.8125rem] sm:text-[0.875rem] font-medium">{order.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] text-[0.8125rem] sm:text-[0.875rem] font-mono font-bold text-right">${order.price.toFixed(2)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredOrders.length === 0 && (
            <div className="py-[5rem] text-center">
              <div className="inline-flex items-center justify-center w-[3rem] h-[3rem] rounded-full bg-[#141414]/5 mb-[1rem]">
                <Filter className="w-[1.5rem] h-[1.5rem] opacity-20" />
              </div>
              <p className="text-[#141414]/40 font-medium">No orders found matching your filters.</p>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setProductFilter('All');
                  setPaymentFilter('All');
                  setDateRange({ start: '', end: '' });
                  setDatePreset('All');
                }}
                className="mt-[1rem] text-[0.875rem] font-bold underline decoration-[#141414]/20 hover:decoration-[#141414] transition-all"
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-[80rem] mx-auto px-[1rem] sm:px-[1.5rem] lg:px-[2rem] py-[3rem] border-t border-[#141414]/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-[2rem]">
          <div className="flex items-center gap-[0.75rem]">
            <div className="bg-[#141414] p-[0.4rem] rounded-[0.4rem]">
              <TrendingUp className="w-[1rem] h-[1rem] text-white" />
            </div>
            <span className="font-bold text-[1rem]">SalesPulse</span>
          </div>
          <p className="text-[0.875rem] text-[#141414]/40">© 2025 SalesPulse Analytics Engine. All rights reserved.</p>
          <div className="flex gap-[1.5rem] text-[0.7rem] font-bold uppercase tracking-widest text-[#141414]/60">
            <a href="#" className="hover:text-[#141414] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#141414] transition-colors">Terms</a>
            <a href="#" className="hover:text-[#141414] transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
