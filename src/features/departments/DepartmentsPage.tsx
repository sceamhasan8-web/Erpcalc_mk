"use client";
import { useState, useMemo, useEffect } from 'react';
import { erpService } from '@/services/erpService';
import type { Department, ProductionFlow, Order } from '@/types';

export function DepartmentsPage() {
  const [departments, setDepartments] = useState(erpService.getDepartments());
  const [productionFlows, setProductionFlows] = useState(erpService.getProductionFlows());
  const orders = erpService.getOrders();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  useEffect(() => {
    function handleUpdate() {
      setDepartments(erpService.getDepartments());
      setProductionFlows(erpService.getProductionFlows());
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('erp:departmentsUpdated', handleUpdate);
      window.addEventListener('erp:productionFlowsUpdated', handleUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('erp:departmentsUpdated', handleUpdate);
        window.removeEventListener('erp:productionFlowsUpdated', handleUpdate);
      }
    };
  }, []);
  const [departmentForm, setDepartmentForm] = useState({
    manpower: '',
    workingHours: '',
    productionCapability: '',
    productionCapabilityPerHour: '',
  });
  const [lastEditedField, setLastEditedField] = useState<'productionCapability' | 'productionCapabilityPerHour' | null>(null);

  // Filter out warehouse and planning from the production department list
  const productionDepartments = departments.filter(
    (d) => !['warehouse', 'planning'].includes(d.name.toLowerCase()),
  );

  function handleDepartmentFormChange(key: keyof typeof departmentForm, value: string) {
    setDepartmentForm((prev) => {
      const next = { ...prev, [key]: value };
      const hours = Number(next.workingHours);
      const validHours = !Number.isNaN(hours) && hours > 0;

      if (key === 'productionCapability') {
        setLastEditedField('productionCapability');
        if (validHours) {
          const hourly = Number(value) / hours;
          return { ...next, productionCapabilityPerHour: Number.isNaN(hourly) ? '' : Math.round(hourly).toString() };
        }
      }

      if (key === 'productionCapabilityPerHour') {
        setLastEditedField('productionCapabilityPerHour');
        if (validHours) {
          const total = Number(value) * hours;
          return { ...next, productionCapability: Number.isNaN(total) ? '' : Math.round(total).toString() };
        }
      }

      if (key === 'workingHours') {
        if (!validHours) {
          return { ...next, productionCapabilityPerHour: '', productionCapability: prev.productionCapability };
        }

        if (lastEditedField === 'productionCapability' && prev.productionCapability !== '') {
          const hourly = Number(prev.productionCapability) / hours;
          return { ...next, productionCapabilityPerHour: Number.isNaN(hourly) ? '' : Math.round(hourly).toString() };
        }

        if (lastEditedField === 'productionCapabilityPerHour' && prev.productionCapabilityPerHour !== '') {
          const total = Number(prev.productionCapabilityPerHour) * hours;
          return { ...next, productionCapability: Number.isNaN(total) ? '' : Math.round(total).toString() };
        }
      }

      return next;
    });
  }

  function handleDepartmentToggle(department: Department) {
    if (selectedDepartment?.id === department.id) {
      setSelectedDepartment(null);
      setDepartmentForm({ manpower: '', workingHours: '', productionCapability: '', productionCapabilityPerHour: '' });
      setLastEditedField(null);
      return;
    }

    setSelectedDepartment(department);
    setLastEditedField(null);
    setDepartmentForm({
      manpower: department.manpower?.toString() ?? '',
      workingHours: department.workingHours?.toString() ?? '',
      productionCapability: department.productionCapability?.toString() ?? '',
      productionCapabilityPerHour: department.productionCapabilityPerHour?.toString() ?? '',
    });
  }

  // Get production report for selected department
  const departmentProductionReport = useMemo(() => {
    if (!selectedDepartment) return [];

    const flows = productionFlows.filter((f) => f.department === selectedDepartment.name);

    return flows.map((flow) => {
      const order = orders.find((o) => o.id === flow.orderId);
      return {
        flow,
        orderNumber: order?.orderNumber || 'N/A',
        style: order?.style || 'N/A',
        completed: flow.completed,
        pending: flow.pending,
        rejected: flow.rejected,
        total: flow.completed + flow.pending + flow.rejected,
        updatedAt: flow.updatedAt,
      };
    });
  }, [selectedDepartment, productionFlows, orders]);

  function handleDepartmentSave() {
    if (!selectedDepartment) return;

    const updates: Partial<Department> = {};
    if (departmentForm.manpower !== '') {
      updates.manpower = Number(departmentForm.manpower);
    }
    if (departmentForm.workingHours !== '') {
      updates.workingHours = Number(departmentForm.workingHours);
    }
    if (departmentForm.productionCapability !== '') {
      updates.productionCapability = Number(departmentForm.productionCapability);
    }
    if (departmentForm.productionCapabilityPerHour !== '') {
      updates.productionCapabilityPerHour = Number(departmentForm.productionCapabilityPerHour);
    }

    const updated = erpService.updateDepartment(selectedDepartment.id, updates);
    if (updated) {
      setSelectedDepartment(updated);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--ec-foreground)]">Factory Departments</h1>
        <p className="text-xs sm:text-sm text-[var(--ec-muted)]">Overview and capacity of all production departments</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5">
            <h2 className="text-lg font-semibold text-[var(--ec-foreground)]">Production Departments</h2>
            <p className="mt-2 text-sm text-[var(--ec-muted)]">
              Select a department to review capacity, manpower and production metrics.
            </p>
          </div>

          {productionDepartments.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => handleDepartmentToggle(d)}
              className={`w-full rounded-3xl border p-4 text-left transition-all ${
                selectedDepartment?.id === d.id
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                  : 'border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] hover:border-cyan-400'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-base font-semibold">{d.name}</div>
                  <div className="mt-1 text-sm text-[var(--ec-muted)]">
                    Eff {d.efficiency}% · Cap {d.capacity}
                  </div>
                </div>
                <div className="text-right text-xs text-[var(--ec-muted)]">
                  {d.manpower ?? 0} workers
                  <div>{d.workingHours ?? 0}h · {d.productionCapabilityPerHour ?? 0} u/h</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {selectedDepartment ? (
            <>
              <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--ec-foreground)]">{selectedDepartment.name}</h2>
                      <p className="text-sm text-[var(--ec-muted)]">Department summary</p>
                    </div>
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">
                      Efficiency {selectedDepartment.efficiency}%
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Capacity</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{selectedDepartment.capacity}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Per Hour Output</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{selectedDepartment.productionCapabilityPerHour ?? 0} u/h</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Active Orders</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{selectedDepartment.activeOrders ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Completed Today</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{selectedDepartment.completedToday ?? 0}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Manpower</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{selectedDepartment.manpower ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Working Hours</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{selectedDepartment.workingHours ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Notes</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{selectedDepartment.notes || '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
                  <h2 className="mb-4 text-lg font-semibold text-[var(--ec-foreground)]">Edit department</h2>
                  <div className="space-y-4">
                    <label className="block text-sm text-[var(--ec-muted)]">
                      Manpower
                      <input
                        type="number"
                        value={departmentForm.manpower}
                        onChange={(event) => handleDepartmentFormChange('manpower', event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                        min={0}
                      />
                    </label>

                    <label className="block text-sm text-[var(--ec-muted)]">
                      Working Hours
                      <input
                        type="number"
                        value={departmentForm.workingHours}
                        onChange={(event) => handleDepartmentFormChange('workingHours', event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                        min={0}
                      />
                    </label>

                    <label className="block text-sm text-[var(--ec-muted)]">
                      Production Capability
                      <input
                        type="number"
                        value={departmentForm.productionCapability}
                        onChange={(event) => handleDepartmentFormChange('productionCapability', event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                        min={0}
                      />
                    </label>

                    <label className="block text-sm text-[var(--ec-muted)]">
                      Production Capability Per Hour
                      <input
                        type="number"
                        value={departmentForm.productionCapabilityPerHour}
                        onChange={(event) => handleDepartmentFormChange('productionCapabilityPerHour', event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                        min={0}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleDepartmentSave}
                      className="mt-2 inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400"
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--ec-foreground)]">Production Report</h2>

                {departmentProductionReport.length === 0 ? (
                  <div className="text-sm text-[var(--ec-muted)] py-8 text-center">No production entries for this department</div>
                ) : (
                  <div className="space-y-3">
                    {departmentProductionReport.map((item, idx) => (
                      <div key={idx} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4">
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-[var(--ec-foreground)]">{item.orderNumber}</p>
                            <p className="text-sm text-[var(--ec-muted)]">{item.style}</p>
                          </div>
                          <div className="text-right">
                            {item.updatedAt && (
                              <p className="text-xs text-[var(--ec-muted)]">
                                {new Date(item.updatedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div className="rounded bg-green-900/30 p-2 text-center">
                            <p className="text-xs text-[var(--ec-muted)]">Completed</p>
                            <p className="mt-1 font-semibold text-green-400">{item.completed}</p>
                          </div>
                          <div className="rounded bg-yellow-900/30 p-2 text-center">
                            <p className="text-xs text-[var(--ec-muted)]">Pending</p>
                            <p className="mt-1 font-semibold text-yellow-400">{item.pending}</p>
                          </div>
                          <div className="rounded bg-red-900/30 p-2 text-center">
                            <p className="text-xs text-[var(--ec-muted)]">Rejected</p>
                            <p className="mt-1 font-semibold text-red-400">{item.rejected}</p>
                          </div>
                          <div className="rounded bg-cyan-900/30 p-2 text-center">
                            <p className="text-xs text-[var(--ec-muted)]">Total</p>
                            <p className="mt-1 font-semibold text-cyan-400">{item.total}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {departmentProductionReport.length > 0 && (
                  <div className="mt-6 border-t border-[var(--ec-border)] pt-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-2xl bg-green-900/20 p-3 text-center">
                        <p className="text-xs text-[var(--ec-muted)]">Total Completed</p>
                        <p className="mt-1 text-lg font-bold text-green-400">
                          {departmentProductionReport.reduce((sum, item) => sum + item.completed, 0)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-yellow-900/20 p-3 text-center">
                        <p className="text-xs text-[var(--ec-muted)]">Total Pending</p>
                        <p className="mt-1 text-lg font-bold text-yellow-400">
                          {departmentProductionReport.reduce((sum, item) => sum + item.pending, 0)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-red-900/20 p-3 text-center">
                        <p className="text-xs text-[var(--ec-muted)]">Total Rejected</p>
                        <p className="mt-1 text-lg font-bold text-red-400">
                          {departmentProductionReport.reduce((sum, item) => sum + item.rejected, 0)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-cyan-900/20 p-3 text-center">
                        <p className="text-xs text-[var(--ec-muted)]">Total All</p>
                        <p className="mt-1 text-lg font-bold text-cyan-400">
                          {departmentProductionReport.reduce((sum, item) => sum + item.total, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-10 text-center">
              <p className="text-[var(--ec-muted)]">Select a department to view details and production report.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DepartmentsPage;
