"use client";

import { useEffect, useMemo, useState } from 'react';
import { erpService } from '@/services/erpService';
import type { Department, ProductionFlow, BuyerOrder } from '@/types';

const STANDARD_WORKING_HOURS = 8;

interface SimOrder {
  id: string;
  orderNumber: string;
  quantity: number;
  rate: number;
  style: string;
}

interface SimAlloc {
  orderId: string;
  orderNumber: string;
  type: 'regular' | 'overtime';
  hours: number;
}

interface SimDay {
  dayNumber: number;
  allocs: SimAlloc[];
  regularTotal: number;
  overtimeTotal: number;
}

interface SimOrderResult {
  id: string;
  orderNumber: string;
  quantity: number;
  rate: number;
  reqHours: number;
  regularHours: number;
  overtimeHours: number;
  startDay: number;
  startHour: number;
  endDay: number;
  endHour: number;
}

interface SimulationResult {
  orders: SimOrderResult[];
  days: SimDay[];
  totalDays: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
}

function runSimulation(ordersList: SimOrder[], regHoursPerDay = 8, maxHoursPerDay = 12): SimulationResult {
  const orderResults: SimOrderResult[] = [];
  const days: SimDay[] = [];
  
  let currentDay = 1;
  let currentHour = 0; // cumulative hours worked today, 0 to maxHoursPerDay
  
  ordersList.forEach((order) => {
    const reqHours = order.quantity / (order.rate || 1);
    let remaining = reqHours;
    
    let allocatedReg = 0;
    let allocatedOt = 0;
    
    const startDay = currentDay;
    const startHour = currentHour;
    
    while (remaining > 0.001) {
      let dayObj = days.find(d => d.dayNumber === currentDay);
      if (!dayObj) {
        dayObj = { dayNumber: currentDay, allocs: [], regularTotal: 0, overtimeTotal: 0 };
        days.push(dayObj);
      }
      
      const spaceInDay = maxHoursPerDay - currentHour;
      if (spaceInDay <= 0.001) {
        currentDay++;
        currentHour = 0;
        continue;
      }
      
      if (currentHour < regHoursPerDay) {
        const regSpace = regHoursPerDay - currentHour;
        const fill = Math.min(remaining, regSpace);
        
        dayObj.allocs.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: 'regular',
          hours: fill
        });
        dayObj.regularTotal += fill;
        
        allocatedReg += fill;
        remaining -= fill;
        currentHour += fill;
      } else {
        const fill = Math.min(remaining, spaceInDay);
        
        dayObj.allocs.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: 'overtime',
          hours: fill
        });
        dayObj.overtimeTotal += fill;
        
        allocatedOt += fill;
        remaining -= fill;
        currentHour += fill;
      }
    }
    
    orderResults.push({
      id: order.id,
      orderNumber: order.orderNumber,
      quantity: order.quantity,
      rate: order.rate,
      reqHours: reqHours,
      regularHours: allocatedReg,
      overtimeHours: allocatedOt,
      startDay,
      startHour,
      endDay: currentDay,
      endHour: currentHour
    });
  });
  
  // Clean up float rounding for display
  days.forEach(d => {
    d.regularTotal = Number(d.regularTotal.toFixed(2));
    d.overtimeTotal = Number(d.overtimeTotal.toFixed(2));
    d.allocs.forEach(a => {
      a.hours = Number(a.hours.toFixed(2));
    });
  });
  
  orderResults.forEach(o => {
    o.reqHours = Number(o.reqHours.toFixed(2));
    o.regularHours = Number(o.regularHours.toFixed(2));
    o.overtimeHours = Number(o.overtimeHours.toFixed(2));
    o.startHour = Number(o.startHour.toFixed(2));
    o.endHour = Number(o.endHour.toFixed(2));
  });

  const totalRegularHours = orderResults.reduce((sum, o) => sum + o.regularHours, 0);
  const totalOvertimeHours = orderResults.reduce((sum, o) => sum + o.overtimeHours, 0);
  const totalDays = days.length;

  return {
    orders: orderResults,
    days,
    totalDays,
    totalRegularHours: Number(totalRegularHours.toFixed(2)),
    totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
    totalHours: Number((totalRegularHours + totalOvertimeHours).toFixed(2))
  };
}

export default function Page() {
  const [departmentVersion, setDepartmentVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'standard' | 'multi-order'>('standard');
  const [simTargetDeadline, setSimTargetDeadline] = useState<number>(2); // in days
  const [simOrders, setSimOrders] = useState<SimOrder[]>([
    { id: 'sim-1', orderNumber: 'ORD-001', quantity: 2000, rate: 200, style: 'Classic Runner' },
    { id: 'sim-2', orderNumber: 'ORD-002', quantity: 300, rate: 30, style: 'Urban Flex' },
    { id: 'sim-3', orderNumber: 'ORD-003', quantity: 1500, rate: 150, style: 'Elite Comfort' },
  ]);
  const [productionFlows, setProductionFlows] = useState<ProductionFlow[]>(erpService.getProductionFlows());
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>(erpService.getBuyerOrders());
  const [newSimOrder, setNewSimOrder] = useState({ orderId: '', customNo: '', customQty: '1000', customRate: '100', customStyle: 'Sport Max' });
  const departments = useMemo(() => erpService.getDepartments(), [departmentVersion]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderPlans, setOrderPlans] = useState<Record<string, { date: string; days: string; hoursPerDay: string; manpower: string; hourlyProduction?: string }>>({});
  const [customization, setCustomization] = useState({
    workingHours: 8,
    workers: 12,
    machines: 6,
    overtimeHours: 0,
    shiftCount: 1,
    capacityMultiplier: 1,
  });
  const [selectedDepartmentName, setSelectedDepartmentName] = useState('Sewing');
  const [activeOrderPlanDepartment, setActiveOrderPlanDepartment] = useState<string>('');
  const [importedCapacities, setImportedCapacities] = useState<Record<string, number>>({});
  const [importMessage, setImportMessage] = useState('Capacity data is ready to import from Department Management.');

  useEffect(() => {
    const handleDepartmentsUpdated = () => setDepartmentVersion((value) => value + 1);
    const handleDataUpdated = () => {
      setProductionFlows(erpService.getProductionFlows());
      setBuyerOrders(erpService.getBuyerOrders());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('erp:departmentsUpdated', handleDepartmentsUpdated);
      window.addEventListener('erp:buyerOrdersUpdated', handleDataUpdated);
      window.addEventListener('erp:productionFlowsUpdated', handleDataUpdated);
      return () => {
        window.removeEventListener('erp:departmentsUpdated', handleDepartmentsUpdated);
        window.removeEventListener('erp:buyerOrdersUpdated', handleDataUpdated);
        window.removeEventListener('erp:productionFlowsUpdated', handleDataUpdated);
      };
    }
  }, []);

  useEffect(() => {
    const nextImported = Object.fromEntries(
      departments.map((department) => {
        const fallbackHourly = department.productionCapabilityPerHour ?? (department.productionCapability && department.workingHours ? Math.round(department.productionCapability / department.workingHours) : 0);
        return [department.name, fallbackHourly || 0];
      }),
    ) as Record<string, number>;

    setImportedCapacities((prev) => {
      const same = JSON.stringify(prev) === JSON.stringify(nextImported);
      return same ? prev : nextImported;
    });
  }, [departments]);

  const departmentOrderLoad = useMemo(() => {
    const load: Record<string, { quantity: number; orders: number }> = {};

    buyerOrders.forEach((order) => {
      order.requiredDepartments?.forEach((departmentName) => {
        const current = load[departmentName] ?? { quantity: 0, orders: 0 };
        load[departmentName] = {
          quantity: current.quantity + order.quantity,
          orders: current.orders + 1,
        };
      });
    });

    return load;
  }, [buyerOrders]);

  const selectedOrder = useMemo(
    () => buyerOrders.find((order) => order.id === selectedOrderId) ?? null,
    [buyerOrders, selectedOrderId],
  );

  useEffect(() => {
    const sel = buyerOrders.find((order) => order.id === selectedOrderId) ?? null;
    if (!sel) {
      setOrderPlans((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setActiveOrderPlanDepartment('');
      return;
    }

    const next: Record<string, { date: string; days: string; hoursPerDay: string; manpower: string; hourlyProduction?: string }> = {};
    sel.requiredDepartments?.forEach((departmentName) => {
      const department = departments.find((item) => item.name === departmentName);
      const defaultHourly = department?.productionCapabilityPerHour ?? (department?.productionCapability && department?.workingHours ? department.productionCapability / department.workingHours : 0);
      next[departmentName] = {
        date: sel.deliveryDate ? new Date(sel.deliveryDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        days: '1',
        hoursPerDay: String(department?.workingHours ?? STANDARD_WORKING_HOURS),
        manpower: String(department?.manpower ?? 0),
        hourlyProduction: String(defaultHourly ?? 0),
      };
    });

    setOrderPlans((prev) => {
      try {
        const a = JSON.stringify(prev || {});
        const b = JSON.stringify(next || {});
        if (a === b) return prev;
      } catch (e) {
        // fallback to always set if stringify fails
      }
      return next;
    });

    const requiredDepartments = sel.requiredDepartments ?? [];
    if (requiredDepartments.length > 0 && !requiredDepartments.includes(selectedDepartmentName)) {
      setSelectedDepartmentName(requiredDepartments[0]);
    }
  }, [selectedOrderId, departments, buyerOrders, selectedDepartmentName]);

  useEffect(() => {
    if (!selectedOrder) {
      setActiveOrderPlanDepartment('');
      return;
    }

    const requiredDepartments = selectedOrder.requiredDepartments ?? [];
    if (requiredDepartments.length === 0) {
      setActiveOrderPlanDepartment('');
      return;
    }

    const preferredDepartment = requiredDepartments.find((departmentName) => departmentName === selectedDepartmentName) ?? requiredDepartments[0];
    setActiveOrderPlanDepartment(preferredDepartment);

    const department = departments.find((item) => item.name === preferredDepartment);
    if (!department) return;

    const defaultHourly = department.productionCapabilityPerHour ?? (department.productionCapability && department.workingHours ? department.productionCapability / department.workingHours : 0);
    setOrderPlans((prev) => ({
      ...prev,
      [preferredDepartment]: {
        ...(prev[preferredDepartment] || {}),
        date: prev[preferredDepartment]?.date || (selectedOrder?.deliveryDate ? new Date(selectedOrder.deliveryDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
        days: prev[preferredDepartment]?.days || '1',
        hoursPerDay: prev[preferredDepartment]?.hoursPerDay || String(department.workingHours ?? STANDARD_WORKING_HOURS),
        manpower: prev[preferredDepartment]?.manpower || String(department.manpower ?? 0),
        hourlyProduction: prev[preferredDepartment]?.hourlyProduction || String(defaultHourly ?? 0),
      },
    }));
  }, [selectedOrder, selectedDepartmentName, departments]);

  const [departmentPlans, setDepartmentPlans] = useState(
    () =>
      Object.fromEntries(
        departments.map((department) => [
          department.id,
          {
            plannedHours: String(department.workingHours ?? STANDARD_WORKING_HOURS),
            plannedManpower: String(department.manpower ?? 0),
          },
        ]),
      ) as Record<string, { plannedHours: string; plannedManpower: string }>,
  );

  useEffect(() => {
    const targetDepartment = departments.find((department) => department.name === selectedDepartmentName);
    if (!targetDepartment) return;

    setCustomization((prev) => ({
      ...prev,
      workingHours: targetDepartment.workingHours ?? prev.workingHours,
      workers: targetDepartment.manpower ?? prev.workers,
      machines: Math.max(1, Math.round((targetDepartment.manpower ?? prev.workers ?? 12) / 2)),
    }));

    setDepartmentPlans((prev) => ({
      ...prev,
      [targetDepartment.id]: {
        plannedHours: String(targetDepartment.workingHours ?? STANDARD_WORKING_HOURS),
        plannedManpower: String(targetDepartment.manpower ?? 0),
      },
    }));
  }, [departments, selectedDepartmentName]);

  const upcomingDeadline = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 7);
    return cutoff;
  }, []);

  const planningRows = useMemo(() => {
    const cutoff = upcomingDeadline.getTime();

    return departments.map((department) => {
      const departmentFlows = productionFlows.filter((flow) => flow.department === department.name);
      const backlog = departmentFlows.reduce((sum, flow) => sum + flow.pending, 0);
      const activeOrderCount = buyerOrders.filter((order) => order.requiredDepartments?.includes(department.name) && order.status !== 'Completed').length;
      const urgentOrders = buyerOrders.filter((order) => {
        if (!order.deliveryDate) return false;
        if (!order.requiredDepartments?.includes(department.name)) return false;
        if (order.status === 'Completed') return false;
        const deliveryTime = new Date(order.deliveryDate).getTime();
        return deliveryTime <= cutoff;
      }).length;

      const workingHours = department.workingHours ?? STANDARD_WORKING_HOURS;
      const currentHourly =
        department.productionCapabilityPerHour ??
        (department.productionCapability && workingHours ? department.productionCapability / workingHours : 0);
      const standardOutput = Math.round(currentHourly * workingHours);
      const planned = departmentPlans[department.id] || {
        plannedHours: String(workingHours),
        plannedManpower: String(department.manpower ?? 0),
      };
      const plannedHours = Number(planned.plannedHours) || workingHours;
      const plannedManpower = Number(planned.plannedManpower) || department.manpower || 0;
      const plannedOutput = Math.round(currentHourly * plannedHours);
      const extraHoursNeeded = currentHourly > 0 ? Math.max(0, backlog / currentHourly - workingHours) : 0;
      const workPressure = urgentOrders > 0 || backlog > standardOutput ? 'High' : backlog > 0 ? 'Medium' : 'Low';
      const orderLoad = departmentOrderLoad[department.name] ?? { quantity: 0, orders: 0 };

      return {
        department,
        backlog,
        activeOrderCount,
        urgentOrders,
        workingHours,
        currentHourly,
        standardOutput,
        plannedHours,
        plannedManpower,
        plannedOutput,
        extraHoursNeeded,
        workPressure,
        orderLoadQuantity: orderLoad.quantity,
        orderLoadCount: orderLoad.orders,
      };
    });
  }, [buyerOrders, departmentPlans, departments, productionFlows, upcomingDeadline]);

  const companySummary = useMemo(() => {
    const totalManpower = departments.reduce((sum, dept) => sum + (dept.manpower ?? 0), 0);
    const totalCapacity = departments.reduce((sum, dept) => sum + (dept.productionCapability ?? 0), 0);
    const avgEfficiency = departments.length ? Math.round(departments.reduce((sum, dept) => sum + (dept.efficiency ?? 0), 0) / departments.length) : 0;
    const urgentOrders = buyerOrders.filter((order) => {
      if (!order.deliveryDate) return false;
      if (order.status === 'Completed') return false;
      const deliveryTime = new Date(order.deliveryDate).getTime();
      return deliveryTime <= upcomingDeadline.getTime();
    }).length;
    const totalBacklog = productionFlows.reduce((sum, flow) => sum + flow.pending, 0);

    return {
      totalDepartments: departments.length,
      totalManpower,
      totalCapacity,
      avgEfficiency,
      urgentOrders,
      totalBacklog,
    };
  }, [buyerOrders, departments, productionFlows, upcomingDeadline]);

  const selectedDepartment = useMemo(() => {
    return departments.find((department) => department.name === selectedDepartmentName) ?? departments.find((department) => department.name === 'Sewing') ?? departments[0] ?? null;
  }, [departments, selectedDepartmentName]);

  const selectedOrderQuantity = selectedOrder?.quantity ?? 20000;
  const importedHourlyCapacity = selectedDepartment ? importedCapacities[selectedDepartment.name] ?? selectedDepartment.productionCapabilityPerHour ?? 0 : 0;
  const baseWorkers = selectedDepartment?.manpower ?? 12;
  const baseMachines = Math.max(1, Math.round((selectedDepartment?.manpower ?? 12) / 2));
  const workerMultiplier = Math.max(0.5, customization.workers / Math.max(1, baseWorkers));
  const machineMultiplier = Math.max(0.5, customization.machines / Math.max(1, baseMachines));
  const overtimeMultiplier = 1 + customization.overtimeHours / Math.max(1, customization.workingHours);
  const shiftMultiplier = Math.max(1, customization.shiftCount);
  const adjustedHourlyCapacity = Math.round(importedHourlyCapacity * workerMultiplier * machineMultiplier * customization.capacityMultiplier * overtimeMultiplier * shiftMultiplier);
  const adjustedDailyCapacity = Math.round(adjustedHourlyCapacity * customization.workingHours);
  const pendingPairs = Math.max(0, selectedOrderQuantity - adjustedDailyCapacity);
  const completionPercentage = selectedOrderQuantity > 0 ? Math.min(100, Math.round((adjustedDailyCapacity / selectedOrderQuantity) * 100)) : 0;
  const estimatedDays = adjustedDailyCapacity > 0 ? Math.max(1, Math.ceil(selectedOrderQuantity / adjustedDailyCapacity)) : 0;
  const completionStatus = completionPercentage >= 100 ? 'On Time' : completionPercentage >= 80 ? 'Watch' : 'Delay Risk';
  const shipmentStatus = completionPercentage >= 100 ? 'On Time' : 'At Risk';

  const scenarioComparison = useMemo(() => {
    const hoursList = [8, 10, 12];
    return hoursList.map((hours, index) => {
      const capacity = Math.round(
        importedHourlyCapacity * workerMultiplier * machineMultiplier * customization.capacityMultiplier * (1 + customization.overtimeHours / Math.max(1, hours)) * shiftMultiplier * hours,
      );
      const completion = selectedOrderQuantity > 0 ? Math.min(100, Math.round((capacity / selectedOrderQuantity) * 100)) : 0;
      const status = completion >= 100 ? 'Safe' : completion >= 80 ? 'Watch' : 'Delay Risk';
      return {
        name: ['Scenario A', 'Scenario B', 'Scenario C'][index],
        hours,
        capacity,
        completion,
        extraCapacity: Math.max(0, capacity - adjustedDailyCapacity),
        status,
      };
    });
  }, [adjustedDailyCapacity, customization.capacityMultiplier, customization.overtimeHours, customization.shiftCount, importedHourlyCapacity, machineMultiplier, selectedOrderQuantity, shiftMultiplier, workerMultiplier]);

  const recommendationOptions = useMemo(() => {
    const extraWorkingHoursImpact = Math.max(0, 10000 - adjustedDailyCapacity);
    const workerImpact = Math.max(2000, Math.round(adjustedHourlyCapacity * 2));
    const overtimeImpact = Math.max(1800, Math.round(adjustedHourlyCapacity * 2));
    const shiftImpact = Math.max(2500, Math.round(adjustedHourlyCapacity * 1.5));
    const outsourceImpact = 3000;

    return [
      { title: 'Increase Working Hours to 10', detail: 'Raise the daily schedule to absorb more demand without adding permanent headcount.', impact: extraWorkingHoursImpact, cost: 1 },
      { title: `Add 5 Workers in ${selectedDepartment?.name ?? 'Sewing'}`, detail: 'Improve bottleneck throughput in the most constrained department.', impact: workerImpact, cost: 2 },
      { title: 'Run 2 Hours Overtime', detail: 'Use short-term overtime to recover urgent load with minimal setup change.', impact: overtimeImpact, cost: 2 },
      { title: 'Add 1 Extra Shift', detail: 'Spread the workload across an additional shift to protect delivery dates.', impact: shiftImpact, cost: 3 },
      { title: 'Outsource 3,000 Pairs', detail: 'Bridge the gap quickly while internal capacity catches up.', impact: outsourceImpact, cost: 4 },
    ];
  }, [adjustedDailyCapacity, adjustedHourlyCapacity, selectedDepartment?.name]);

  const bestRecommendation = useMemo(() => {
    return recommendationOptions.reduce((best, current) => {
      const bestRatio = best.impact / Math.max(1, best.cost);
      const currentRatio = current.impact / Math.max(1, current.cost);
      return currentRatio > bestRatio ? current : best;
    }, recommendationOptions[0]);
  }, [recommendationOptions]);

  function handlePlanChange(departmentId: string, key: 'plannedHours' | 'plannedManpower', value: string) {
    setDepartmentPlans((prev) => ({
      ...prev,
      [departmentId]: {
        ...prev[departmentId],
        [key]: value,
      },
    }));
  }

  function handleOrderPlanChange(
    departmentName: string,
    key: 'date' | 'days' | 'hoursPerDay' | 'manpower' | 'hourlyProduction',
    value: string,
  ) {
    // allow empty string so users can clear inputs (avoid forced 0)
    setOrderPlans((prev) => ({
      ...prev,
      [departmentName]: {
        ...(prev[departmentName] || {}),
        [key]: value,
      },
    }));
  }

  function handleCustomizationChange(key: keyof typeof customization, value: string | number) {
    setCustomization((prev) => ({ ...prev, [key]: value }));
  }

  function handleImportDepartmentCapacity() {
    const nextImported = Object.fromEntries(
      departments.map((department) => {
        const fallbackHourly = department.productionCapabilityPerHour ?? (department.productionCapability && department.workingHours ? Math.round(department.productionCapability / department.workingHours) : 0);
        return [department.name, fallbackHourly || 0];
      }),
    ) as Record<string, number>;

    setImportedCapacities(nextImported);
    setImportMessage(`Imported ${departments.length} department capacities from Department Management.`);
  }

  const selectedOrderPlanRows = useMemo(() => {
    if (!selectedOrder) return [];

    return (selectedOrder.requiredDepartments ?? []).map((departmentName, index) => {
      const department = departments.find((item) => item.name === departmentName);
      const plan = orderPlans[departmentName] ?? {
        days: '0',
        hoursPerDay: String(department?.workingHours ?? STANDARD_WORKING_HOURS),
        manpower: String(department?.manpower ?? 0),
        hourlyProduction: String(
          department?.productionCapabilityPerHour ?? (department?.productionCapability && department?.workingHours ? department.productionCapability / department.workingHours : 0),
        ),
      };
      const days = Number(plan.days) || 0;
      const hoursPerDay = Number(plan.hoursPerDay) || 0;
      const totalHours = days * hoursPerDay;
      const defaultHourly = department?.productionCapabilityPerHour ?? (department?.productionCapability && department?.workingHours ? department.productionCapability / department.workingHours : 0);
      const hourlyProduction = Number(plan.hourlyProduction ?? String(defaultHourly)) || defaultHourly || 0;
      const currentHourly = department?.productionCapabilityPerHour ?? (department?.productionCapability && department?.workingHours ? department.productionCapability / department.workingHours : 0);
      const projectedOutput = Math.round(hourlyProduction * totalHours);
      const outputPerDay = Math.round(hourlyProduction * hoursPerDay);
      const departmentFlows = productionFlows.filter(
        (flow) => flow.orderId === selectedOrder.id && flow.department === departmentName,
      );
      const actualCompleted = departmentFlows.reduce((sum, flow) => sum + flow.completed, 0);
      const actualRemaining = Math.max(0, selectedOrder.quantity - actualCompleted);

      const isActivePlan = departmentName === activeOrderPlanDepartment;

      return {
        departmentName,
        department,
        plan,
        index: index + 1,
        isActivePlan,
        days,
        hoursPerDay,
        totalHours,
        currentHourly,
        projectedOutput,
        outputPerDay,
        requiredQuantity: selectedOrder.quantity,
        actualCompleted,
        actualRemaining,
        remaining: selectedOrder.quantity - projectedOutput,
      };
    });
  }, [selectedOrder, orderPlans, departments, activeOrderPlanDepartment]);

  const simResultA = useMemo(() => runSimulation(simOrders, 8, 8), [simOrders]);
  const simResultB = useMemo(() => runSimulation(simOrders, 8, 10), [simOrders]);
  const simResultC = useMemo(() => runSimulation(simOrders, 8, 12), [simOrders]);

  function handleUpdateSimOrderRate(id: string, rate: number) {
    setSimOrders(prev => prev.map(o => o.id === id ? { ...o, rate: Math.max(1, rate) } : o));
  }

  function handleUpdateSimOrderQty(id: string, qty: number) {
    setSimOrders(prev => prev.map(o => o.id === id ? { ...o, quantity: Math.max(0, qty) } : o));
  }

  function handleUpdateSimOrderField(id: string, key: 'orderNumber' | 'style', value: string) {
    setSimOrders(prev => prev.map(o => o.id === id ? { ...o, [key]: value } : o));
  }

  function handleDeleteSimOrder(id: string) {
    setSimOrders(prev => prev.filter(o => o.id !== id));
  }

  function handleResetSimOrders() {
    setSimOrders([
      { id: 'sim-1', orderNumber: 'ORD-001', quantity: 2000, rate: 200, style: 'Classic Runner' },
      { id: 'sim-2', orderNumber: 'ORD-002', quantity: 300, rate: 30, style: 'Urban Flex' },
      { id: 'sim-3', orderNumber: 'ORD-003', quantity: 1500, rate: 150, style: 'Elite Comfort' },
    ]);
  }

  function handleAddCustomSimOrder() {
    const id = `sim-${Date.now()}`;
    const orderNo = newSimOrder.customNo.trim() || `ORD-SIM-${simOrders.length + 1}`;
    const qty = Number(newSimOrder.customQty) || 1000;
    const rate = Number(newSimOrder.customRate) || 100;
    const style = newSimOrder.customStyle.trim() || 'Custom Style';
    setSimOrders(prev => [...prev, { id, orderNumber: orderNo, quantity: qty, rate, style }]);
    setNewSimOrder(prev => ({ ...prev, customNo: '', customQty: '1000', customRate: '100' }));
  }

  function handleAddSystemSimOrder() {
    const orderId = newSimOrder.orderId;
    if (!orderId) return;
    const systemOrder = buyerOrders.find(o => o.id === orderId);
    if (!systemOrder) return;
    
    const id = `sim-sys-${orderId}`;
    setSimOrders(prev => {
      if (prev.some(o => o.id === id)) return prev;
      return [...prev, {
        id,
        orderNumber: systemOrder.orderNumber,
        quantity: systemOrder.quantity,
        rate: 100,
        style: systemOrder.articleName || 'Standard'
      }];
    });
    setNewSimOrder(prev => ({ ...prev, orderId: '' }));
  }

  return (
    <div className="w-full space-y-6 text-[var(--ec-foreground)]">
      <div className="rounded-2xl sm:rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--ec-foreground)]">Company Planning</h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-[var(--ec-muted)]">
              Monitor department workload, estimate overtime hours, and manage manpower to meet delivery dates.
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4 text-sm text-[var(--ec-foreground)]">
            <p className="font-semibold">Standard working hours</p>
            <p className="mt-1 text-[var(--ec-muted)]">{STANDARD_WORKING_HOURS} hours per day</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <p className="text-sm text-[var(--ec-muted)]">Departments</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--ec-foreground)]">{companySummary.totalDepartments}</p>
          </div>
          <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <p className="text-sm text-[var(--ec-muted)]">Total Manpower</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--ec-foreground)]">{companySummary.totalManpower}</p>
          </div>
          <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <p className="text-sm text-[var(--ec-muted)]">Urgent orders (7d)</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--ec-foreground)]">{companySummary.urgentOrders}</p>
          </div>
          <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <p className="text-sm text-[var(--ec-muted)]">Current Order</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--ec-foreground)]">{selectedOrder?.orderNumber ?? 'None'}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 flex border-b border-[var(--ec-border)]">
          <button
            type="button"
            onClick={() => setActiveTab('standard')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'standard'
                ? 'border-[var(--ec-primary)] text-[var(--ec-primary)] font-bold'
                : 'border-transparent text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
            }`}
          >
            Standard Capacity Planning
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('multi-order')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'multi-order'
                ? 'border-[var(--ec-primary)] text-[var(--ec-primary)] font-bold'
                : 'border-transparent text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
            }`}
          >
            Multi-Order Overtime Simulator
          </button>
        </div>

        {activeTab === 'standard' ? (
          <>
            <div className="mt-8 rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">Advanced customization panel</h2>
                  <p className="mt-2 text-sm text-[var(--ec-muted)]">
                    Adjust working hours, headcount, machines, overtime and shift count to simulate production capacity instantly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleImportDepartmentCapacity}
                  className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                >
                  ⚙️ Import Department Capacity
                </button>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm text-[var(--ec-muted)]">
                      Department
                      <select
                        value={selectedDepartmentName}
                        onChange={(event) => setSelectedDepartmentName(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                      >
                        {departments.map((department) => (
                          <option key={department.id} value={department.name}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-[var(--ec-muted)]">
                      Working Hours / Day
                      <input
                        type="number"
                        min={1}
                        value={customization.workingHours}
                        onChange={(event) => handleCustomizationChange('workingHours', Number(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                      />
                    </label>

                    <label className="text-sm text-[var(--ec-muted)]">
                      Workers
                      <input
                        type="number"
                        min={1}
                        value={customization.workers}
                        onChange={(event) => handleCustomizationChange('workers', Number(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                      />
                    </label>

                    <label className="text-sm text-[var(--ec-muted)]">
                      Machines
                      <input
                        type="number"
                        min={1}
                        value={customization.machines}
                        onChange={(event) => handleCustomizationChange('machines', Number(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                      />
                    </label>

                    <label className="text-sm text-[var(--ec-muted)]">
                      Overtime Hours
                      <input
                        type="number"
                        min={0}
                        value={customization.overtimeHours}
                        onChange={(event) => handleCustomizationChange('overtimeHours', Number(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                      />
                    </label>

                    <label className="text-sm text-[var(--ec-muted)]">
                      Shift Count
                      <input
                        type="number"
                        min={1}
                        value={customization.shiftCount}
                        onChange={(event) => handleCustomizationChange('shiftCount', Number(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none focus:border-cyan-400"
                      />
                    </label>
                  </div>

                  <label className="block text-sm text-[var(--ec-muted)]">
                    Department Capacity Multiplier
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={customization.capacityMultiplier}
                      onChange={(event) => handleCustomizationChange('capacityMultiplier', Number(event.target.value))}
                      className="mt-3 w-full accent-cyan-500"
                    />
                    <span className="mt-2 inline-block text-xs text-cyan-300">Multiplier {customization.capacityMultiplier.toFixed(1)}x</span>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-3">
                      <p className="text-xs text-[var(--ec-muted)]">Imported hourly capacity</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{importedHourlyCapacity.toLocaleString()} pairs/h</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-3">
                      <p className="text-xs text-[var(--ec-muted)]">Adjusted hourly output</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{adjustedHourlyCapacity.toLocaleString()} pairs/h</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-surface)] p-3">
                      <p className="text-xs text-[var(--ec-muted)]">Daily capacity</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{adjustedDailyCapacity.toLocaleString()} pairs</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--ec-foreground)]">Order completion simulation</h3>
                  <p className="mt-2 text-sm text-[var(--ec-muted)]">{importMessage}</p>
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl bg-[var(--ec-card)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Selected order quantity</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--ec-foreground)]">{selectedOrderQuantity.toLocaleString()} pairs</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-card)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Remaining after current plan</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--ec-foreground)]">{pendingPairs.toLocaleString()} pairs</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ec-card)] p-4">
                      <p className="text-sm text-[var(--ec-muted)]">Completion</p>
                      <p className="mt-2 text-2xl font-semibold text-cyan-300">{completionPercentage}%</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[var(--ec-card)] p-4">
                        <p className="text-sm text-[var(--ec-muted)]">Estimated completion</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{estimatedDays <= 1 ? 'Within 1 day' : `Within ${estimatedDays} days`}</p>
                      </div>
                      <div className="rounded-2xl bg-[var(--ec-card)] p-4">
                        <p className="text-sm text-[var(--ec-muted)]">Shipment status</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{completionStatus} · {shipmentStatus}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--ec-foreground)]">Scenario comparison</h3>
                  <div className="mt-4 space-y-3">
                    {scenarioComparison.map((scenario) => (
                      <div key={scenario.name} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--ec-foreground)]">{scenario.name}</p>
                            <p className="text-xs text-[var(--ec-muted)]">{scenario.hours} hours / day</p>
                          </div>
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">{scenario.status}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[var(--ec-muted)] sm:grid-cols-3">
                          <div>
                            <p>Capacity</p>
                            <p className="font-semibold text-[var(--ec-foreground)]">{scenario.capacity.toLocaleString()}</p>
                          </div>
                          <div>
                            <p>Completion</p>
                            <p className="font-semibold text-[var(--ec-foreground)]">{scenario.completion}%</p>
                          </div>
                          <div>
                            <p>Extra capacity</p>
                            <p className="font-semibold text-[var(--ec-foreground)]">{scenario.extraCapacity.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--ec-foreground)]">Smart recommendations</h3>
                  <p className="mt-2 text-sm text-[var(--ec-muted)]">The system recommends the most cost-efficient option to close the gap quickly.</p>
                  <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                    <p className="text-sm font-semibold text-cyan-300">Best option</p>
                    <p className="mt-2 text-base font-semibold text-[var(--ec-foreground)]">{bestRecommendation.title}</p>
                    <p className="mt-2 text-sm text-[var(--ec-muted)]">{bestRecommendation.detail}</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {recommendationOptions.map((recommendation) => (
                      <div key={recommendation.title} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--ec-foreground)]">{recommendation.title}</p>
                            <p className="mt-1 text-xs text-[var(--ec-muted)]">{recommendation.detail}</p>
                          </div>
                          <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs text-yellow-300">{recommendation.impact.toLocaleString()} pairs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                  <thead>
                    <tr className="text-left text-[var(--ec-muted)]">
                      <th className="pb-3">Section</th>
                      <th className="pb-3">Efficiency</th>
                      <th className="pb-3">Manpower</th>
                      <th className="pb-3">Work Hours</th>
                      <th className="pb-3">Output / h</th>
                      <th className="pb-3">Daily Cap.</th>
                      <th className="pb-3">Order Load</th>
                      <th className="pb-3">Backlog</th>
                      <th className="pb-3">Urgent</th>
                      <th className="pb-3">Planned Hours</th>
                      <th className="pb-3">Planned Manpower</th>
                      <th className="pb-3">Projected Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planningRows.map((row) => (
                      <tr key={row.department.id} className="bg-[var(--ec-card)] rounded-3xl border border-[var(--ec-border)] align-top">
                        <td className="px-4 py-3 font-semibold text-[var(--ec-foreground)]">{row.department.name}</td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.department.efficiency ?? 0}%</td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.department.manpower ?? 0}</td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.workingHours}h</td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.currentHourly.toFixed(1)}</td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.standardOutput}</td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.orderLoadQuantity} / {row.orderLoadCount} orders</td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.backlog}</td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.urgentOrders}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            value={row.plannedHours}
                            onChange={(e) => handlePlanChange(row.department.id, 'plannedHours', e.target.value)}
                            className="w-20 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            value={row.plannedManpower}
                            onChange={(e) => handlePlanChange(row.department.id, 'plannedManpower', e.target.value)}
                            className="w-20 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                          />
                        </td>
                        <td className="px-4 py-3 text-[var(--ec-muted)]">{row.plannedOutput}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
                <h2 className="text-lg font-semibold text-[var(--ec-foreground)]">Order-specific planning</h2>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm text-[var(--ec-muted)]">
                    Select order
                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                    >
                      <option value="">Choose an order</option>
                      {buyerOrders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.orderNumber} • {order.articleName} • {order.quantity} {order.unit}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedOrder ? (
                    <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 text-sm">
                      <p className="font-semibold text-[var(--ec-foreground)]">{selectedOrder.orderNumber}</p>
                      <p className="text-[var(--ec-muted)]">{selectedOrder.articleName} • {selectedOrder.color} • {selectedOrder.quantity} {selectedOrder.unit}</p>
                      <p className="mt-3 text-sm text-[var(--ec-muted)]">Delivery date: {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString() : 'Not set'}</p>

                      <div className="mt-4 space-y-3">
                        {selectedOrderPlanRows.map((row) => (
                          <div key={row.departmentName} className={`rounded-2xl border p-3 ${row.isActivePlan ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-[var(--ec-border)] bg-[var(--ec-surface)]'}`}>
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="font-semibold text-[var(--ec-foreground)]">{row.departmentName}</p>
                                <p className="text-xs text-[var(--ec-muted)]">Required quantity: {row.requiredQuantity}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[var(--ec-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ec-muted)]">
                                  Plan {row.index}
                                </span>
                                {row.isActivePlan && (
                                  <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
                                    Auto-selected
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="text-sm text-[var(--ec-muted)]">
                                Plan date
                                <input
                                  type="date"
                                  value={row.plan.date}
                                  onChange={(e) => handleOrderPlanChange(row.departmentName, 'date', e.target.value)}
                                  className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                                />
                              </label>
                              <label className="text-sm text-[var(--ec-muted)]">
                                Days
                                <input
                                  type="number"
                                  min={0}
                                  value={row.plan.days}
                                  onChange={(e) => handleOrderPlanChange(row.departmentName, 'days', e.target.value)}
                                  className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                                />
                              </label>
                              <label className="text-sm text-[var(--ec-muted)]">
                                Hours/day
                                <input
                                  type="number"
                                  min={0}
                                  value={row.plan.hoursPerDay}
                                  onChange={(e) => handleOrderPlanChange(row.departmentName, 'hoursPerDay', e.target.value)}
                                  className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                                />
                              </label>
                              <label className="text-sm text-[var(--ec-muted)]">
                                Hourly (u/h)
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  value={row.plan.hourlyProduction ?? ''}
                                  onChange={(e) => handleOrderPlanChange(row.departmentName, 'hourlyProduction', e.target.value)}
                                  className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                                />
                              </label>
                              <label className="text-sm text-[var(--ec-muted)]">
                                Manpower
                                <input
                                  type="number"
                                  min={0}
                                  value={row.plan.manpower}
                                  onChange={(e) => handleOrderPlanChange(row.departmentName, 'manpower', e.target.value)}
                                  className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                                />
                              </label>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm text-[var(--ec-muted)]">
                              <div>
                                <p>Total hours</p>
                                <p className="font-semibold text-[var(--ec-foreground)]">{row.totalHours}</p>
                              </div>
                              <div>
                                <p>Output / day</p>
                                <p className="font-semibold text-[var(--ec-foreground)]">{row.outputPerDay}</p>
                              </div>
                              <div>
                                <p>Projected output</p>
                                <p className="font-semibold text-[var(--ec-foreground)]">{row.projectedOutput}</p>
                              </div>
                              <div>
                                <p>Completed</p>
                                <p className="font-semibold text-[var(--ec-foreground)]">{row.actualCompleted}</p>
                              </div>
                              <div>
                                <p>Remaining</p>
                                <p className="font-semibold text-[var(--ec-foreground)]">{row.actualRemaining}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 text-sm text-[var(--ec-muted)]">
                      Select an order to create day-by-day, hour-by-hour planning for each department.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-6">
                <h2 className="text-lg font-semibold text-[var(--ec-foreground)]">Action recommendations</h2>
                <p className="mt-3 text-sm text-[var(--ec-muted)]">
                  Review departments with a high backlog or urgent orders first. Increase planned working hours or manpower in those sections if delivery dates must be met.
                </p>
                <div className="mt-4 space-y-3">
                  {planningRows.filter((row) => row.urgentOrders > 0 || row.backlog > row.standardOutput).slice(0, 3).map((row) => (
                    <div key={row.department.id} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--ec-foreground)]">{row.department.name}</p>
                          <p className="text-xs text-[var(--ec-muted)]">{row.workPressure} pressure</p>
                        </div>
                        <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-300">{row.urgentOrders} urgent</span>
                      </div>
                      <p className="mt-3 text-sm text-[var(--ec-muted)]">
                        Backlog {row.backlog} units and {row.urgentOrders} orders due soon. Consider adding {Math.ceil(row.extraHoursNeeded)} extra hours or more manpower for on-time delivery.
                      </p>
                    </div>
                  ))}
                  {planningRows.filter((row) => row.urgentOrders > 0 || row.backlog > row.standardOutput).length === 0 && (
                    <p className="text-sm text-[var(--ec-muted)]">All departments are operating within standard capacity for current backlog.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-6">
                <h2 className="text-lg font-semibold text-[var(--ec-foreground)]">Company planning note</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ec-muted)]">
                  This planning section gathers data from every department, including manpower, standard hours, hourly output and order urgency. Use the editable plan fields to set extra working hours or manpower for departments that need a temporary boost.
                </p>
                <div className="mt-4 rounded-2xl bg-[var(--ec-card)] p-4">
                  <p className="text-sm text-[var(--ec-muted)]">Total backlog</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--ec-foreground)]">{companySummary.totalBacklog} units</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8 space-y-8">
            {/* 1. Global System Parameters Display */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-cyan-500/40 bg-cyan-500/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--ec-foreground)]">Standard Working Hours</p>
                  <span className="rounded-full bg-cyan-600 px-2.5 py-0.5 text-[10px] font-bold text-white">FIXED</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-[var(--ec-foreground)]">8 Hours / Day</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ec-muted)]">Standard shift duration limit</p>
              </div>
              <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--ec-foreground)]">Max Allowable Overtime</p>
                  <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[10px] font-bold text-white">FIXED</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-[var(--ec-foreground)]">4 Hours / Day</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ec-muted)]">Maximum 12 hours shift length limit</p>
              </div>
              <div className="rounded-3xl border border-purple-500/40 bg-purple-500/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--ec-foreground)]">Workers & Machines Capacity</p>
                  <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-bold text-white">FIXED</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-[var(--ec-foreground)]">100% Limit</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ec-muted)]">Headcount & setups cannot be increased</p>
              </div>
            </div>

            {/* 2. Interactive Selection & Rates Table */}
            <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ec-border)] pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">Batch Simulator (Multi-Order Select)</h2>
                  <p className="mt-1 text-sm text-[var(--ec-muted)]">
                    Select multiple orders and manually assign the "Production Per Hour" for each based on style difficulty.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetSimOrders}
                  className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                >
                  🔄 Reset Example Batch
                </button>
              </div>

              {/* Add Order Controls */}
              <div className="mt-6 grid gap-4 rounded-2xl bg-[var(--ec-surface)] p-4 sm:grid-cols-[2fr_1.5fr_1fr_1.2fr_auto] items-end">
                <label className="text-xs font-semibold text-[var(--ec-muted)] flex flex-col gap-1.5">
                  Load Live Order
                  <select
                    value={newSimOrder.orderId}
                    onChange={(e) => setNewSimOrder(prev => ({ ...prev, orderId: e.target.value }))}
                    className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none"
                  >
                    <option value="">Select an order...</option>
                    {buyerOrders
                      .filter(bo => !simOrders.some(so => so.id === `sim-sys-${bo.id}`))
                      .map(bo => (
                        <option key={bo.id} value={bo.id}>
                          {bo.orderNumber} • {bo.articleName} ({bo.quantity} pairs)
                        </option>
                      ))
                    }
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleAddSystemSimOrder}
                  disabled={!newSimOrder.orderId}
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                >
                  ➕ Add Live Order
                </button>
                <div className="hidden sm:block border-l border-[var(--ec-border)] h-8 self-center mx-auto"></div>
                <div className="col-span-full grid gap-4 sm:col-span-2 sm:grid-cols-4 items-end">
                  <label className="text-xs font-semibold text-[var(--ec-muted)] flex flex-col gap-1.5 col-span-2">
                    Custom Style / No.
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="No."
                        value={newSimOrder.customNo}
                        onChange={(e) => setNewSimOrder(prev => ({ ...prev, customNo: e.target.value }))}
                        className="w-1/3 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-2 py-2 text-sm text-[var(--ec-foreground)] outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Style name"
                        value={newSimOrder.customStyle}
                        onChange={(e) => setNewSimOrder(prev => ({ ...prev, customStyle: e.target.value }))}
                        className="w-2/3 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-2 py-2 text-sm text-[var(--ec-foreground)] outline-none"
                      />
                    </div>
                  </label>
                  <label className="text-xs font-semibold text-[var(--ec-muted)] flex flex-col gap-1.5">
                    Qty / Rate
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={newSimOrder.customQty}
                        onChange={(e) => setNewSimOrder(prev => ({ ...prev, customQty: e.target.value }))}
                        className="w-1/2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-1.5 py-2 text-sm text-[var(--ec-foreground)] outline-none text-center"
                      />
                      <input
                        type="number"
                        placeholder="Rate"
                        value={newSimOrder.customRate}
                        onChange={(e) => setNewSimOrder(prev => ({ ...prev, customRate: e.target.value }))}
                        className="w-1/2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-1.5 py-2 text-sm text-[var(--ec-foreground)] outline-none text-center"
                      />
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCustomSimOrder}
                    className="rounded-xl border border-dashed border-cyan-500 text-cyan-400 bg-cyan-500/5 px-3 py-2 text-sm font-semibold transition hover:bg-cyan-500/10"
                  >
                    ➕ Add Custom
                  </button>
                </div>
              </div>

              {/* Sim Orders List Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--ec-border)] text-[var(--ec-muted)]">
                      <th className="pb-3 font-semibold">Order ID</th>
                      <th className="pb-3 font-semibold">Style/Article</th>
                      <th className="pb-3 font-semibold text-right">Total Qty (Pairs)</th>
                      <th className="pb-3 font-semibold text-right">User Defined Rate (Pairs/Hour)</th>
                      <th className="pb-3 font-semibold text-right">Required Hours</th>
                      <th className="pb-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--ec-muted)]">
                          No orders added to simulation batch. Add orders above or reset to the example dataset.
                        </td>
                      </tr>
                    ) : (
                      simOrders.map((o) => (
                        <tr key={o.id} className="border-b border-[var(--ec-border)] hover:bg-[var(--ec-surface)]/20">
                          <td className="py-4 font-medium text-[var(--ec-foreground)]">
                            <input
                              type="text"
                              value={o.orderNumber}
                              onChange={(e) => handleUpdateSimOrderField(o.id, 'orderNumber', e.target.value)}
                              className="w-24 bg-transparent border-b border-transparent hover:border-[var(--ec-border)] focus:border-cyan-500 focus:border-b outline-none text-[var(--ec-foreground)] py-0.5"
                            />
                          </td>
                          <td className="py-4 text-[var(--ec-muted)]">
                            <input
                              type="text"
                              value={o.style}
                              onChange={(e) => handleUpdateSimOrderField(o.id, 'style', e.target.value)}
                              className="w-36 bg-transparent border-b border-transparent hover:border-[var(--ec-border)] focus:border-cyan-500 focus:border-b outline-none text-[var(--ec-muted)] py-0.5"
                            />
                          </td>
                          <td className="py-4 text-right font-semibold">
                            <input
                              type="number"
                              value={o.quantity}
                              onChange={(e) => handleUpdateSimOrderQty(o.id, Number(e.target.value))}
                              className="w-24 text-right bg-[var(--ec-surface)] border border-[var(--ec-border)] rounded-xl px-2.5 py-1 focus:border-cyan-500 outline-none text-[var(--ec-foreground)]"
                            />
                          </td>
                          <td className="py-4 text-right font-semibold">
                            <input
                              type="number"
                              value={o.rate}
                              onChange={(e) => handleUpdateSimOrderRate(o.id, Number(e.target.value))}
                              className="w-24 text-right bg-[var(--ec-surface)] border border-[var(--ec-border)] rounded-xl px-2.5 py-1 focus:border-cyan-500 outline-none text-[var(--ec-foreground)]"
                            />
                          </td>
                          <td className="py-4 text-right font-semibold text-[var(--ec-foreground)]">
                            {(o.quantity / (o.rate || 1)).toFixed(1)} hrs
                          </td>
                          <td className="py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteSimOrder(o.id)}
                              className="text-red-400 hover:text-red-300 font-semibold p-1"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Batch Overtime Scenarios Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">3 Overtime Simulation Scenarios</h2>
              <div className="grid gap-6 md:grid-cols-3">
                {/* Scenario A */}
                <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[var(--ec-foreground)]">Scenario A (No OT)</h3>
                      <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">Delay Risk</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[var(--ec-muted)]">Strict limit to standard 8-hour shift. No overtime allowed.</p>
                    
                    <div className="mt-6 space-y-3 border-t border-red-500/20 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Total Days:</span>
                        <span className="font-bold text-[var(--ec-foreground)]">{simResultA.totalDays} Days</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Shift Length:</span>
                        <span className="font-semibold text-[var(--ec-foreground)]">8h Max / day</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Overtime Hours:</span>
                        <span className="font-semibold text-[var(--ec-foreground)]">0h</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl bg-red-500/15 p-3 text-xs font-semibold text-[var(--ec-foreground)] leading-relaxed border border-red-500/30">
                    ⚠️ Batch takes {simResultA.totalDays} days. High delivery delay risk due to strict 8h limitation.
                  </div>
                </div>

                {/* Scenario B */}
                <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[var(--ec-foreground)]">Scenario B (Med OT)</h3>
                      <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-xs font-semibold text-white">Moderate</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[var(--ec-muted)]">Allow up to 2 hours of overtime per worker daily (10h max shift).</p>
                    
                    <div className="mt-6 space-y-3 border-t border-amber-500/20 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Total Days:</span>
                        <span className="font-bold text-[var(--ec-foreground)]">{simResultB.totalDays} Days</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Shift Length:</span>
                        <span className="font-semibold text-[var(--ec-foreground)]">10h Max / day</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Overtime Hours:</span>
                        <span className="font-semibold text-[var(--ec-foreground)]">{simResultB.totalOvertimeHours}h</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl bg-amber-500/15 p-3 text-xs font-semibold text-[var(--ec-foreground)] leading-relaxed border border-amber-500/30">
                    💡 Saves days compared to Scenario A. Overtime required is {simResultB.totalOvertimeHours} hours.
                  </div>
                </div>

                {/* Scenario C */}
                <div className="rounded-3xl border border-cyan-500/40 bg-cyan-500/10 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[var(--ec-foreground)]">Scenario C (Max OT)</h3>
                      <span className="rounded-full bg-cyan-600 px-2.5 py-0.5 text-xs font-semibold text-white">Safe / Fast</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[var(--ec-muted)]">Allow max allowable overtime of 4 hours daily (12h max shift).</p>
                    
                    <div className="mt-6 space-y-3 border-t border-cyan-500/20 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Total Days:</span>
                        <span className="font-bold text-[var(--ec-foreground)]">{simResultC.totalDays} Days</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Shift Length:</span>
                        <span className="font-semibold text-[var(--ec-foreground)]">12h Max / day</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-[var(--ec-muted)]">Overtime Hours:</span>
                        <span className="font-semibold text-[var(--ec-foreground)]">{simResultC.totalOvertimeHours}h</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl bg-cyan-500/15 p-3 text-xs font-semibold text-[var(--ec-foreground)] leading-relaxed border border-cyan-500/30">
                    🚀 Fast-track path. Achieves minimum schedule length of {simResultC.totalDays} days with {simResultC.totalOvertimeHours}h OT.
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Timeline Visual Panel */}
            <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ec-border)] pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">Batch Timeline & OT Priority (Scenario C)</h2>
                  <p className="mt-1 text-sm text-[var(--ec-muted)]">
                    Sequential back-to-back scheduling of orders. Max OT (4h/day) utilized sequentially to complete batch on time.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-sm font-semibold text-[var(--ec-muted)] flex items-center gap-2">
                    Deadline:
                    <input
                      type="range"
                      min="1"
                      max="7"
                      value={simTargetDeadline}
                      onChange={(e) => setSimTargetDeadline(Number(e.target.value))}
                      className="accent-cyan-500 w-28"
                    />
                    <span className="text-[var(--ec-primary)] font-bold">{simTargetDeadline} Days</span>
                  </label>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-4">
                <div className="rounded-2xl bg-[var(--ec-surface)] p-4 text-center">
                  <p className="text-xs text-[var(--ec-muted)]">Total Batch Duration</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--ec-foreground)]">{simResultC.totalDays} Days</p>
                </div>
                <div className="rounded-2xl bg-[var(--ec-surface)] p-4 text-center">
                  <p className="text-xs text-[var(--ec-muted)]">Total Required Hours</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--ec-foreground)]">{simResultC.totalHours} hrs</p>
                </div>
                <div className="rounded-2xl bg-[var(--ec-surface)] p-4 text-center">
                  <p className="text-xs text-[var(--ec-muted)]">Regular Hours Spent</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--ec-foreground)]">{simResultC.totalRegularHours} hrs</p>
                </div>
                <div className="rounded-2xl bg-[var(--ec-surface)] p-4 text-center">
                  <p className="text-xs text-[var(--ec-muted)]">Overtime Hours Spent</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--ec-foreground)]">{simResultC.totalOvertimeHours} hrs</p>
                </div>
              </div>

              {/* Day-by-Day Horizontal Timeline Visual */}
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between text-xs text-[var(--ec-muted)] pb-1">
                  <span>Day Timeline Visualization (12 hours capacity per day)</span>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/40"></span> Regular Shift (0-8h)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40"></span> Overtime Shift (8-12h)</span>
                  </div>
                </div>

                {simResultC.days.map((day) => (
                  <div key={day.dayNumber} className="relative">
                    <div className="flex items-center gap-3">
                      <span className="w-16 text-xs font-semibold text-[var(--ec-muted)]">Day {day.dayNumber}</span>
                      
                      {/* Progress bar container */}
                      <div className="flex-1 h-10 rounded-xl bg-[var(--ec-surface)] overflow-hidden flex border border-[var(--ec-border)] relative">
                        
                        {/* 8 Hours regular shift dividing line */}
                        <div className="absolute top-0 bottom-0 left-[66.67%] border-l border-dashed border-[var(--ec-border)] z-10"></div>
                        
                        {day.allocs.map((alloc, idx) => {
                          const widthPercent = (alloc.hours / 12) * 100;
                          const isRegular = alloc.type === 'regular';
                          const bgClass = isRegular 
                            ? 'bg-cyan-500/25 hover:bg-cyan-500/35 text-[var(--ec-foreground)] border-r border-[var(--ec-border)]' 
                            : 'bg-amber-500/25 hover:bg-amber-500/35 text-[var(--ec-foreground)] border-r border-[var(--ec-border)]';
                          
                          return (
                            <div
                              key={idx}
                              style={{ width: `${widthPercent}%` }}
                              className={`h-full flex flex-col justify-center px-2 text-[10px] truncate leading-tight font-medium transition-all ${bgClass}`}
                              title={`${alloc.orderNumber} - ${alloc.hours} hrs (${alloc.type})`}
                            >
                              <span className="font-bold truncate">{alloc.orderNumber}</span>
                              <span className="opacity-75">{alloc.hours}h ({alloc.type})</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      <span className="w-20 text-right text-xs font-medium text-[var(--ec-muted)]">
                        {Number(day.regularTotal + day.overtimeTotal).toFixed(1)} / 12h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Per-Order Summary Details */}
            <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
              <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">Per-Order Simulation Summary (Scenario C)</h2>
              <p className="mt-1 text-sm text-[var(--ec-muted)]">
                Estimated completion timeline and specific overtime hours allocated per order.
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--ec-border)] text-[var(--ec-muted)]">
                      <th className="pb-3 font-semibold">Order</th>
                      <th className="pb-3 font-semibold text-right">Qty</th>
                      <th className="pb-3 font-semibold text-right">Production Rate</th>
                      <th className="pb-3 font-semibold text-right">Total Hours</th>
                      <th className="pb-3 font-semibold text-right">Regular Hours</th>
                      <th className="pb-3 font-semibold text-right text-[var(--ec-foreground)]">Overtime Hours</th>
                      <th className="pb-3 font-semibold text-right">Completion Time</th>
                      <th className="pb-3 text-center">Shipment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simResultC.orders.map((o) => {
                      const isOnTime = o.endDay <= simTargetDeadline;
                      return (
                        <tr key={o.id} className="border-b border-[var(--ec-border)] hover:bg-[var(--ec-surface)]/20">
                          <td className="py-4">
                            <p className="font-semibold text-[var(--ec-foreground)]">{o.orderNumber}</p>
                            <p className="text-xs text-[var(--ec-muted)]">{simOrders.find(so => so.id === o.id)?.style || 'Standard'}</p>
                          </td>
                          <td className="py-4 text-right text-[var(--ec-muted)]">{o.quantity.toLocaleString()} pairs</td>
                          <td className="py-4 text-right text-[var(--ec-muted)]">{o.rate} / hr</td>
                          <td className="py-4 text-right font-medium text-[var(--ec-foreground)]">{o.reqHours}h</td>
                          <td className="py-4 text-right text-[var(--ec-muted)]">{o.regularHours}h</td>
                          <td className="py-4 text-right text-[var(--ec-foreground)] font-semibold">{o.overtimeHours}h</td>
                          <td className="py-4 text-right">
                            <span className="font-semibold text-[var(--ec-foreground)]">Day {o.endDay}</span>
                            <span className="text-xs text-[var(--ec-muted)]"> (Hour {o.endHour})</span>
                          </td>
                          <td className="py-4 text-center">
                            {isOnTime ? (
                              <span className="rounded-full bg-cyan-500/20 border border-cyan-500/50 px-2.5 py-0.5 text-xs font-bold text-[var(--ec-foreground)]">
                                ✓ On Time
                              </span>
                            ) : (
                              <span className="rounded-full bg-red-500/20 border border-red-500/50 px-2.5 py-0.5 text-xs font-bold text-[var(--ec-foreground)]">
                                ⚠ Delay Risk
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
