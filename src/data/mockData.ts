import type { Buyer, CostTracking, Department, FinishedGoods, Notification, Order, ProductionFlow, Report, User, WarehouseStock, MaterialReceival, Article, BuyerOrder } from '@/types';

export const buyers: Buyer[] = [
  { id: 'b1', name: 'Aisha Rahman', company: 'Northstar Imports', email: 'aisha@northstar.com', phone: '+8801712345678', region: 'Dhaka', tier: 'Premium', rating: 4.9 },
  { id: 'b2', name: 'Daniel Kim', company: 'Blue Harbor Co.', email: 'daniel@blueharbor.com', phone: '+8801712345679', region: 'Chattogram', tier: 'Strategic', rating: 4.8 },
  { id: 'b3', name: 'Nadia Yusuf', company: 'Crown Apparel Ltd.', email: 'nadia@crownapparel.com', phone: '+8801712345680', region: 'Khulna', tier: 'Standard', rating: 4.6 },
];

export const departments: Department[] = [
  { id: 'd1', name: 'Warehouse', efficiency: 92, capacity: 340, manpower: 24, workingHours: 8, productionCapability: 20000, productionCapabilityPerHour: 2500, activeOrders: 8, completedToday: 120 },
  { id: 'd2', name: 'PD', efficiency: 88, capacity: 220, manpower: 16, workingHours: 8, productionCapability: 18400, productionCapabilityPerHour: 2300, activeOrders: 5, completedToday: 95 },
  { id: 'd3', name: 'Lamination', efficiency: 84, capacity: 180, manpower: 14, workingHours: 8, productionCapability: 17600, productionCapabilityPerHour: 2200, activeOrders: 4, completedToday: 65 },
  { id: 'd4', name: 'Cutting', efficiency: 90, capacity: 260, manpower: 18, workingHours: 8, productionCapability: 16000, productionCapabilityPerHour: 2000, activeOrders: 6, completedToday: 110 },
  { id: 'd5', name: 'Skyving', efficiency: 87, capacity: 210, manpower: 12, workingHours: 8, productionCapability: 15600, productionCapabilityPerHour: 1950, activeOrders: 5, completedToday: 76 },
  { id: 'd6', name: 'Printing', efficiency: 91, capacity: 240, manpower: 20, workingHours: 8, productionCapability: 16800, productionCapabilityPerHour: 2100, activeOrders: 7, completedToday: 82 },
  { id: 'd7', name: 'Embossing', efficiency: 85, capacity: 160, manpower: 10, workingHours: 8, productionCapability: 16400, productionCapabilityPerHour: 2050, activeOrders: 3, completedToday: 54 },
  { id: 'd8', name: 'Preparation', efficiency: 89, capacity: 190, manpower: 12, workingHours: 8, productionCapability: 15200, productionCapabilityPerHour: 1900, activeOrders: 4, completedToday: 73 },
  { id: 'd9', name: 'Sewing', efficiency: 86, capacity: 280, manpower: 22, workingHours: 8, productionCapability: 14400, productionCapabilityPerHour: 1800, activeOrders: 9, completedToday: 102 },
  { id: 'd10', name: 'Planning', efficiency: 93, capacity: 200, manpower: 10, workingHours: 8, productionCapability: 16000, productionCapabilityPerHour: 2000, activeOrders: 4, completedToday: 88 },
  { id: 'd11', name: 'Lasting', efficiency: 85, capacity: 180, manpower: 14, workingHours: 8, productionCapability: 16000, productionCapabilityPerHour: 2000, activeOrders: 5, completedToday: 60 },
  { id: 'd14', name: 'DIP', efficiency: 83, capacity: 170, manpower: 12, workingHours: 8, productionCapability: 16000, productionCapabilityPerHour: 2000, activeOrders: 4, completedToday: 55 },
  { id: 'd12', name: 'Packing', efficiency: 94, capacity: 230, manpower: 18, workingHours: 8, productionCapability: 17600, productionCapabilityPerHour: 2200, activeOrders: 6, completedToday: 98 },
  { id: 'd13', name: 'Goods Store', efficiency: 96, capacity: 300, manpower: 16, workingHours: 8, productionCapability: 20000, productionCapabilityPerHour: 2500, activeOrders: 3, completedToday: 112 },
];

export const orders: Order[] = [
  { id: 'o1', buyerId: 'b1', orderNumber: 'ORD-1001', style: 'Classic Runner', quantity: 5000, completedQuantity: 3200, pendingQuantity: 1200, rejectedQuantity: 100, currentDepartment: 'Printing', status: 'In Progress', priority: 'High', startDate: '2026-06-01', eta: '2026-06-28', productionPercentage: 64, cost: 42000, revenue: 76000 },
  { id: 'o2', buyerId: 'b2', orderNumber: 'ORD-1002', style: 'Urban Flex', quantity: 3600, completedQuantity: 2500, pendingQuantity: 1000, rejectedQuantity: 50, currentDepartment: 'Sewing', status: 'In Progress', priority: 'Medium', startDate: '2026-06-05', eta: '2026-06-27', productionPercentage: 69, cost: 31000, revenue: 59000 },
  { id: 'o3', buyerId: 'b3', orderNumber: 'ORD-1003', style: 'Elite Comfort', quantity: 2800, completedQuantity: 2800, pendingQuantity: 0, rejectedQuantity: 0, currentDepartment: 'Goods Store', status: 'Completed', priority: 'Low', startDate: '2026-05-20', eta: '2026-06-15', productionPercentage: 100, cost: 24000, revenue: 43000 },
  { id: 'o4', buyerId: 'b1', orderNumber: 'ORD-1004', style: 'Premium Lite', quantity: 4100, completedQuantity: 1800, pendingQuantity: 2200, rejectedQuantity: 100, currentDepartment: 'Lasting', status: 'Delayed', priority: 'High', startDate: '2026-06-08', eta: '2026-07-03', productionPercentage: 44, cost: 36000, revenue: 67000 },
];

export const productionFlows: ProductionFlow[] = [
  { id: 'pf1', orderId: 'bo1', department: 'Warehouse', completed: 5000, pending: 0, rejected: 0, updatedAt: '2026-06-25T10:00:00.000Z' },
  { id: 'pf2', orderId: 'bo1', department: 'Printing', completed: 4200, pending: 800, rejected: 0, updatedAt: '2026-06-25T11:00:00.000Z' },
  { id: 'pf3', orderId: 'bo2', department: 'Sewing', completed: 2500, pending: 1100, rejected: 0, updatedAt: '2026-06-24T09:00:00.000Z' },
  { id: 'pf4', orderId: 'bo2', department: 'Warehouse', completed: 3600, pending: 0, rejected: 0, updatedAt: '2026-06-24T08:00:00.000Z' },
];

export const warehouseStocks: WarehouseStock[] = [
  { id: 'ws1', sku: 'MAT-001', item: 'Leather Sheet', quantity: 240, reorderLevel: 80, location: 'A-01', category: 'Material' },
  { id: 'ws2', sku: 'MAT-002', item: 'Thread Reel', quantity: 520, reorderLevel: 120, location: 'B-05', category: 'Material' },
  { id: 'ws3', sku: 'MAT-003', item: 'Glue Pack', quantity: 90, reorderLevel: 50, location: 'C-03', category: 'Material' },
  { id: 'ws4', sku: 'FG-001', item: 'Finished Runner', quantity: 380, reorderLevel: 100, location: 'G-12', category: 'Finished Goods' },
];

export const materialReceivals: MaterialReceival[] = [
  { id: 'mr1', sku: 'MAT-001', item: 'Leather Sheet', quantity: 100, unit: 'kg', source: 'Buyer', buyerId: 'b1', buyerName: 'Aisha Rahman', location: 'A-01', category: 'Material', receivedAt: '2026-06-25', notes: 'Premium quality leather from Northstar Imports' },
  { id: 'mr2', sku: 'MAT-002', item: 'Thread Reel', quantity: 250, unit: 'pcs', source: 'Own Purchase', location: 'B-05', category: 'Material', receivedAt: '2026-06-24', notes: 'From local supplier' },
];

export const articles: Article[] = [
  { id: 'art1', name: 'Classic Runner', code: 'CR-001', colors: ['Black', 'Navy', 'Gray', 'White', 'Red'] },
  { id: 'art2', name: 'Urban Flex', code: 'UF-002', colors: ['Blue', 'Black', 'Gray', 'Green', 'Burgundy'] },
  { id: 'art3', name: 'Elite Comfort', code: 'EC-003', colors: ['White', 'Beige', 'Black', 'Brown', 'Navy'] },
  { id: 'art4', name: 'Premium Lite', code: 'PL-004', colors: ['Red', 'Blue', 'Black', 'White', 'Gold'] },
  { id: 'art5', name: 'Sport Max', code: 'SM-005', colors: ['Black', 'Navy', 'Green', 'Red', 'Yellow'] },
];

export const buyerOrders: BuyerOrder[] = [
  { id: 'bo1', orderNumber: 'BO-2001', buyerId: 'b1', buyerName: 'Aisha Rahman', articleId: 'art1', articleName: 'Classic Runner', color: 'Black', quantity: 5000, unit: 'pcs', deliveryDate: '2026-06-28', createdAt: '2026-06-01', priority: 'High', status: 'In Production', requiredDepartments: ['Warehouse', 'Printing'] },
  { id: 'bo2', orderNumber: 'BO-2002', buyerId: 'b2', buyerName: 'Daniel Kim', articleId: 'art2', articleName: 'Urban Flex', color: 'Blue', quantity: 3600, unit: 'pcs', deliveryDate: '2026-06-27', createdAt: '2026-06-05', priority: 'Medium', status: 'In Production', requiredDepartments: ['Warehouse', 'Sewing'] },
  { id: 'bo3', orderNumber: 'BO-2003', buyerId: 'b3', buyerName: 'Nadia Yusuf', articleId: 'art3', articleName: 'Elite Comfort', color: 'White', quantity: 2800, unit: 'pcs', deliveryDate: '2026-06-15', createdAt: '2026-05-20', priority: 'Low', status: 'Completed', requiredDepartments: ['Warehouse'] },
];

export const finishedGoods: FinishedGoods[] = [
  { id: 'fg1', sku: 'FG-BO-2003', item: 'Elite Comfort (White)', quantity: 2800, status: 'Ready', orderId: 'bo3' },
];

export const costTracking: CostTracking[] = [
  { id: 'ct1', month: 'Jan', materialCost: 180000, laborCost: 120000, overheadCost: 90000, packagingCost: 30000 },
  { id: 'ct2', month: 'Feb', materialCost: 192000, laborCost: 126000, overheadCost: 94000, packagingCost: 32000 },
  { id: 'ct3', month: 'Mar', materialCost: 205000, laborCost: 134000, overheadCost: 98000, packagingCost: 34000 },
  { id: 'ct4', month: 'Apr', materialCost: 214000, laborCost: 141000, overheadCost: 101000, packagingCost: 37000 },
  { id: 'ct5', month: 'May', materialCost: 228000, laborCost: 149000, overheadCost: 106000, packagingCost: 39000 },
  { id: 'ct6', month: 'Jun', materialCost: 236000, laborCost: 154000, overheadCost: 110000, packagingCost: 41000 },
];

export const reports: Report[] = [
  { id: 'r1', title: 'Daily Production Summary', type: 'Operations', generatedAt: '2026-06-26', summary: 'All departments are operating above plan.' },
  { id: 'r2', title: 'Buyer Performance Report', type: 'Sales', generatedAt: '2026-06-25', summary: 'Premium buyers contributed 62% of revenue.' },
];

export const notifications: Notification[] = [
  { id: 'n1', title: 'Delay Alert', message: 'Order ORD-1004 moved to delayed due to material shortage.', read: false, createdAt: '2026-06-26' },
  { id: 'n2', title: 'Warehouse Restock', message: 'Glue pack stock crossed reorder level.', read: true, createdAt: '2026-06-25' },
];

export const users: User[] = [
  { id: 'u1', name: 'Mina Rahman', role: 'Operations Director', email: 'mina@easycalc.com', avatar: 'MR' },
  { id: 'u2', name: 'Sajid Hossain', role: 'Production Manager', email: 'sajid@easycalc.com', avatar: 'SH' },
];
