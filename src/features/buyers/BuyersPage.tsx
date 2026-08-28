"use client";
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { mockRepository } from '@/repositories/mockRepository';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit } from '@/lib/unitSettings';
import type { Buyer, BuyerOrder } from '@/types';
import { Star, Mail, Phone, MapPin, Building, Plus, Trash2, Package } from 'lucide-react';

export function BuyersPage() {
  const productionUnit = useProductionUnit();
  const { showAlert, showConfirm, toast } = useModal();
  const [buyers, setBuyers] = useState<Buyer[]>(() => mockRepository.getBuyers());
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>(() => mockRepository.getBuyerOrders());
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    region: '',
    tier: 'Standard' as 'Standard' | 'Premium' | 'Strategic',
    rating: 4.5,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    // Live Real-Time Subscription
    const unsubBuyers = firebaseService.subscribeBuyers((liveBuyers) => {
      setBuyers(liveBuyers);
    });
    const unsubOrders = firebaseService.subscribeOrders((liveOrders) => {
      setBuyerOrders(liveOrders);
    });

    return () => {
      unsubBuyers();
      unsubOrders();
    };
  }, []);

  const filtered = buyers
    .filter((b) => (searchFilter ? b.name.toLowerCase().includes(searchFilter.toLowerCase()) || b.company?.toLowerCase().includes(searchFilter.toLowerCase()) : true))
    .filter((b) => (tierFilter ? b.tier === tierFilter : true));

  const handleAddBuyer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    if (!formData.name) {
      showAlert({ title: 'Missing Name', message: 'Please enter a buyer name.', type: 'warning' });
      return;
    }
    if (!formData.company) {
      showAlert({ title: 'Missing Company', message: 'Please enter a company name.', type: 'warning' });
      return;
    }
    if (!formData.email) {
      showAlert({ title: 'Missing Email', message: 'Please enter a valid email address.', type: 'warning' });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const newBuyer = await apiService.createBuyer({
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        region: formData.region,
        tier: formData.tier,
        rating: formData.rating,
      });
      setBuyers((prev) => [newBuyer, ...prev]);
      setFormData({ name: '', company: '', email: '', phone: '', region: '', tier: 'Standard', rating: 4.5 });
      setShowForm(false);
      toast.success('Buyer added successfully!');
    } catch (error) {
      console.error('Failed to create buyer', error);
      showAlert({ title: 'Save Failed', message: 'Unable to save buyer. Please try again.', type: 'error' });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeleteBuyer = async (buyerId: string) => {
    const targetBuyer = buyers.find((b) => b.id === buyerId);
    const confirmed = await showConfirm({
      title: 'Delete Buyer Profile',
      message: `Are you sure you want to delete "${targetBuyer?.name || 'this buyer'}"? Associated buyer data will be affected.`,
      type: 'danger',
      confirmText: 'Delete Buyer',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteBuyer(buyerId);
      setBuyers((prev) => prev.filter((b) => b.id !== buyerId));
      setDeleteConfirm(null);
      toast.success('Buyer deleted successfully.');
    } catch (error) {
      console.error('Failed to delete buyer', error);
      showAlert({ title: 'Delete Failed', message: 'Unable to delete buyer. Please try again.', type: 'error' });
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'Strategic':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700';
      case 'Premium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700';
    }
  };

  const getRatingStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
          ))}
        </div>
        <span className="text-xs text-[var(--ec-muted)]">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 text-[var(--ec-foreground)]">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">Buyers Management</p>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--ec-foreground)]">Buyer Directory</h1>
          <p className="text-xs sm:text-sm text-[var(--ec-muted)] mt-1">Manage and view all buyer accounts and orders</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or company..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-4 py-2 text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)]"
            />
          </div>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-4 py-2 text-sm text-[var(--ec-foreground)]"
          >
            <option value="">All Tiers</option>
            <option value="Strategic">Strategic</option>
            <option value="Premium">Premium</option>
            <option value="Standard">Standard</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Buyer
          </button>
        </div>

        {/* Add Buyer Form */}
        {showForm && (
          <div className="mb-6 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
            <h3 className="text-lg font-semibold mb-4 text-[var(--ec-foreground)]">Add New Buyer</h3>
            <form onSubmit={handleAddBuyer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-500 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Buyer name"
                  className="w-full rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-500 mb-2">Company *</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Company name"
                  className="w-full rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-500 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@company.com"
                  className="w-full rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-500 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+880171234567"
                  className="w-full rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-500 mb-2">Region</label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="Dhaka"
                  className="w-full rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-500 mb-2">Tier</label>
                <select
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                  className="w-full rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                >
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                  <option value="Strategic">Strategic</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-500 mb-2">Rating</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                  className="w-full rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)]"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating Buyer...' : 'Create Buyer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Buyers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-8 text-center text-[var(--ec-muted)]">
              No buyers found
            </div>
          ) : (
            filtered.map((buyer) => (
              <div key={buyer.id} className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 hover:border-cyan-500/50 hover:shadow-lg transition-all h-full flex flex-col">
                <div className="mb-4 flex items-start justify-between gap-2">
                  <Link href={`/buyers/${buyer.id}`} className="flex-1">
                    <div className="group cursor-pointer">
                      <h3 className="font-bold text-[var(--ec-foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{buyer.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 font-medium">
                        <Building className="h-3.5 w-3.5" />
                        {buyer.company || 'N/A'}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-start gap-2">
                    {buyer.tier && <span className={`px-2 py-0.5 text-xs font-semibold rounded border whitespace-nowrap ${getTierColor(buyer.tier)}`}>{buyer.tier}</span>}
                    {deleteConfirm === buyer.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDeleteBuyer(buyer.id)}
                          className="rounded px-2 py-1 bg-red-600 hover:bg-red-700 text-xs font-medium text-white transition-colors"
                        >
                          Yes
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="rounded px-2 py-1 bg-gray-600 hover:bg-gray-700 text-xs font-medium text-white transition-colors">
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(buyer.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded p-1 transition-colors"
                        title="Delete buyer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Rating */}
                {buyer.rating && <div className="mb-3">{getRatingStars(buyer.rating)}</div>}

                {/* Contact Info */}
                <div className="space-y-2 mb-4 text-xs text-slate-600 dark:text-slate-300">
                  {buyer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{buyer.email}</span>
                    </div>
                  )}
                  {buyer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span>{buyer.phone}</span>
                    </div>
                  )}
                  {buyer.region && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span>{buyer.region}</span>
                    </div>
                  )}
                </div>

                {/* Buyer Orders & Tracking */}
                {(() => {
                  const ordersForBuyer = buyerOrders.filter((o) => o.buyerId === buyer.id);
                  return (
                    <div className="mb-4 pt-3 border-t border-[var(--ec-border)] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--ec-foreground)] flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-cyan-400" />
                          Orders ({ordersForBuyer.length})
                        </span>
                        {ordersForBuyer.length > 0 && (
                          <span className="text-[11px] font-extrabold text-cyan-400">
                            Total: {ordersForBuyer.reduce((sum, o) => sum + o.quantity, 0)} {ordersForBuyer[0]?.unit || productionUnit}
                          </span>
                        )}
                      </div>

                      {ordersForBuyer.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {ordersForBuyer.map((ord) => (
                            <Link
                              key={ord.id}
                              href={`/buyers/${buyer.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/20 transition"
                              title={`Track Order ${ord.orderNumber} - ${ord.quantity} ${ord.unit || productionUnit}`}
                            >
                              <span>{ord.orderNumber}</span>
                              <span className="text-[9px] font-normal text-[var(--ec-muted)] font-sans">({ord.quantity})</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[var(--ec-muted)] italic">No orders placed yet</p>
                      )}
                    </div>
                  );
                })()}

                {/* View Details Button */}
                <div className="mt-auto pt-3 border-t border-[var(--ec-border)]">
                  <Link href={`/buyers/${buyer.id}`} className="block w-full text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors text-center py-1 rounded-lg hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20">
                    View Buyer & Track Orders →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
            <p className="text-xs uppercase tracking-wider text-cyan-500 mb-2">Total Buyers</p>
            <p className="text-2xl font-semibold">{buyers.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
            <p className="text-xs uppercase tracking-wider text-cyan-500 mb-2">Strategic</p>
            <p className="text-2xl font-semibold">{buyers.filter((b) => b.tier === 'Strategic').length}</p>
          </div>
          <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
            <p className="text-xs uppercase tracking-wider text-cyan-500 mb-2">Premium</p>
            <p className="text-2xl font-semibold">{buyers.filter((b) => b.tier === 'Premium').length}</p>
          </div>
          <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
            <p className="text-xs uppercase tracking-wider text-cyan-500 mb-2">Standard</p>
            <p className="text-2xl font-semibold">{buyers.filter((b) => b.tier === 'Standard').length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
