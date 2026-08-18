"use client";
import { useState, useEffect } from 'react';
import { AlertTriangle, Boxes, Package, TrendingUp } from 'lucide-react';
import { erpService } from '@/services/erpService';
import { useMaterialUnit } from '@/lib/unitSettings';

const departmentMaterialMap: Record<string, string[]> = {
  Warehouse: ['Leather Sheet', 'Thread Reel', 'Glue Pack', 'Finished Runner'],
  PD: ['Leather Sheet', 'Thread Reel'],
  Lamination: ['Glue Pack', 'Leather Sheet'],
  Cutting: ['Thread Reel', 'Leather Sheet'],
  Skyving: ['Glue Pack', 'Thread Reel'],
  Printing: ['Glue Pack', 'Thread Reel'],
  Embossing: ['Leather Sheet', 'Thread Reel'],
  Preparation: ['Thread Reel', 'Glue Pack'],
  Sewing: ['Leather Sheet', 'Thread Reel'],
  Planning: ['Glue Pack', 'Thread Reel'],
  Lasting: ['Leather Sheet', 'Thread Reel'],
  DIP: ['Glue Pack', 'Thread Reel'],
  Packing: ['Finished Runner', 'Glue Pack'],
  'Goods Store': ['Finished Runner', 'Thread Reel'],
};

export function InventoryPage() {
  const materialUnit = useMaterialUnit();
  const [departments, setDepartments] = useState(() => erpService.getDepartments());
  const [warehouseStocks, setWarehouseStocks] = useState(() => erpService.getWarehouseStocks());

  useEffect(() => {
    function handleUpdate() {
      setDepartments(erpService.getDepartments());
      setWarehouseStocks(erpService.getWarehouseStocks());
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('erp:departmentsUpdated', handleUpdate);
      window.addEventListener('erp:warehouseStocksUpdated', handleUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('erp:departmentsUpdated', handleUpdate);
        window.removeEventListener('erp:warehouseStocksUpdated', handleUpdate);
      }
    };
  }, []);

  const inventoryByDepartment = departments.map((department) => {
    const assignedMaterials = warehouseStocks.filter((stock) =>
      (departmentMaterialMap[department.name] ?? []).includes(stock.item),
    );

    const totalQuantity = assignedMaterials.reduce((sum, stock) => sum + stock.quantity, 0);
    const lowStockCount = assignedMaterials.filter(
      (stock) => stock.quantity <= (stock.reorderLevel ?? 0),
    ).length;

    return {
      department,
      assignedMaterials,
      totalQuantity,
      lowStockCount,
      status: lowStockCount > 0 ? 'Needs attention' : 'Healthy',
    };
  });

  return (
    <div className="w-full space-y-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--ec-foreground)]">Department Inventory</h1>
        <p className="text-xs sm:text-sm text-[var(--ec-muted)]">Track how much material each department currently has available.</p>
      </div>

      <div className="mb-6 grid gap-4 rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 lg:grid-cols-3">
        <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--ec-muted)]">
            <Boxes className="h-4 w-4 text-cyan-400" />
            Total sections
          </div>
          <div className="mt-2 text-2xl font-semibold text-[var(--ec-foreground)]">{departments.length}</div>
        </div>
        <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--ec-muted)]">
            <Package className="h-4 w-4 text-cyan-400" />
            Materials tracked
          </div>
          <div className="mt-2 text-2xl font-semibold text-[var(--ec-foreground)]">{warehouseStocks.length}</div>
        </div>
        <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--ec-muted)]">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            Low stock alerts
          </div>
          <div className="mt-2 text-2xl font-semibold text-[var(--ec-foreground)]">
            {inventoryByDepartment.filter((item) => item.lowStockCount > 0).length}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {inventoryByDepartment.map((item) => (
          <div key={item.department.id} className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--ec-foreground)]">{item.department.name}</h2>
                <p className="text-sm text-[var(--ec-muted)]">Capacity {item.department.capacity ?? 0} · Eff {item.department.efficiency ?? 0}%</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.lowStockCount > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {item.lowStockCount > 0 ? 'Needs attention' : 'Healthy'}
              </span>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--ec-surface)] p-3">
                <p className="text-sm text-[var(--ec-muted)]">Total material units</p>
                <p className="mt-2 text-xl font-semibold text-[var(--ec-foreground)]">{item.totalQuantity}</p>
              </div>
              <div className="rounded-2xl bg-[var(--ec-surface)] p-3">
                <p className="text-sm text-[var(--ec-muted)]">Tracked items</p>
                <p className="mt-2 text-xl font-semibold text-[var(--ec-foreground)]">{item.assignedMaterials.length}</p>
              </div>
            </div>

            <div className="space-y-2">
              {item.assignedMaterials.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--ec-border)] p-3 text-sm text-[var(--ec-muted)]">
                  No materials assigned yet.
                </div>
              ) : (
                item.assignedMaterials.map((stock) => (
                  <div key={stock.id} className="flex items-center justify-between rounded-2xl bg-[var(--ec-surface)] px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium text-[var(--ec-foreground)]">{stock.item}</div>
                      <div className="text-xs text-[var(--ec-muted)]">{stock.category ?? 'Material'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[var(--ec-foreground)]">{stock.quantity} {stock.unit || materialUnit}</div>
                      {stock.quantity <= (stock.reorderLevel ?? 0) ? (
                        <div className="flex items-center justify-end gap-1 text-xs text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Low stock
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-400">Healthy</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default InventoryPage;
