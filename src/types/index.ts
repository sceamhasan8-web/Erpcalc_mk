// Central TypeScript models for EasyCalc Factory ERP

export type ID = string;

export type OrderStatus = 'Planned' | 'In Progress' | 'Completed' | 'Delayed' | 'Cancelled';
export type Priority = 'Low' | 'Medium' | 'High';

export type DepartmentName =
  | 'Warehouse'
  | 'PD'
  | 'Lamination'
  | 'Cutting'
  | 'Skyving'
  | 'Printing'
  | 'Embossing'
  | 'Preparation'
  | 'Sewing'
  | 'Planning'
  | 'Lasting'
  | 'DIP'
  | 'Packing'
  | 'Goods Store';

export interface Buyer {
  id: ID;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  region?: string;
  tier?: 'Standard' | 'Premium' | 'Strategic';
  rating?: number;
  createdAt?: string;
}

export interface Order {
  id: ID;
  buyerId: ID;
  orderNumber: string;
  style?: string;
  quantity: number;
  completedQuantity: number;
  pendingQuantity: number;
  rejectedQuantity: number;
  currentDepartment: string;
  status: OrderStatus;
  priority: Priority;
  startDate?: string; // ISO date
  eta?: string; // ISO date
  productionPercentage: number; // 0-100
  cost?: number;
  revenue?: number;
  estimatedCompletion?: string; // ISO date
}

export interface Department {
  id: ID;
  name: string;
  efficiency?: number; // percent
  capacity?: number; // units/day or similar
  manpower?: number; // number of workers assigned
  workingHours?: number; // hours per shift/day
  productionCapability?: number; // units per shift/day
  productionCapabilityPerHour?: number; // units per hour
  activeOrders?: number;
  completedToday?: number;
  notes?: string;
}

export interface ProductionFlow {
  id: ID;
  orderId: ID;
  department: string;
  processName?: string;
  completed: number;
  pending: number;
  rejected: number;
  updatedAt?: string; // ISO date
  itemId?: string;
  articleName?: string;
  color?: string;
  genderCategory?: 'mens' | 'womens' | 'both';
  sizeBreakdown?: Record<string, number>;
  notes?: string;
}

export interface WarehouseStock {
  id: ID;
  sku: string;
  item: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  reorderLevel?: number;
  location?: string;
  category?: string;
  orderId?: ID;
  orderNumber?: string;
  buyerName?: string;
  articleName?: string;
}

export interface MaterialReceival {
  id: ID;
  sku: string;
  item: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  source: 'Buyer' | 'Own Purchase';
  buyerId?: ID;
  buyerName?: string;
  orderId?: ID;
  orderNumber?: string;
  articleName?: string;
  location?: string;
  category?: string;
  receivedAt?: string; // ISO date
  notes?: string;
}

export interface Article {
  id: ID;
  name: string;
  code?: string;
  colors: string[];
  description?: string;
}

export interface BuyerOrderItem {
  id: string;
  articleId?: ID;
  articleName: string;
  color: string;
  genderCategory?: 'mens' | 'womens' | 'both';
  sizeBreakdown?: Record<string, number>;
  quantity: number;
  image?: string;
  requiredDepartments?: string[];
}

export interface BuyerOrder {
  id: ID;
  orderNumber: string;
  buyerId: ID;
  buyerName?: string;
  items?: BuyerOrderItem[];
  articleId?: ID;
  articleName?: string;
  color?: string;
  quantity: number;
  unit?: string;
  deliveryDate?: string; // ISO date
  createdAt?: string; // ISO date
  priority?: Priority;
  notes?: string;
  status?: 'Pending' | 'Confirmed' | 'In Production' | 'Completed';
  requiredDepartments?: string[]; // List of departments needed for this order
  genderCategory?: 'mens' | 'womens' | 'both';
  sizeBreakdown?: Record<string, number>;
  image?: string;
}

export interface FinishedGoods {
  id: ID;
  sku: string;
  item: string;
  quantity: number;
  status?: 'Ready' | 'Packed' | 'Reserved' | 'Shipped';
  orderId?: ID;
}

export interface CostTracking {
  id: ID;
  month: string; // e.g., 'Jan'
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  packagingCost?: number;
}

export interface Report {
  id: ID;
  title: string;
  type?: string;
  generatedAt?: string;
  summary?: string;
  details?: string;
}

export interface Notification {
  id: ID;
  title: string;
  message: string;
  read: boolean;
  createdAt?: string;
}

export interface User {
  id: ID;
  name: string;
  role?: string;
  email?: string;
  avatar?: string;
}

export interface SectionPlanTarget {
  department: string;
  dailyTarget: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  totalTarget?: number;
  startDate?: string;
  targetDeliveryDate?: string;
  manpower?: number;
  workingHours?: number;
  notes?: string;
}

export interface OrderProductionPlan {
  id: ID;
  orderId: ID;
  orderNumber: string;
  buyerName?: string;
  articleName?: string;
  totalQuantity: number;
  unit?: string;
  startDate?: string;
  targetDeliveryDate?: string;
  sections: Record<string, SectionPlanTarget>;
  status?: 'Planned' | 'In Progress' | 'On Track' | 'Delayed' | 'Completed';
  updatedAt: string;
}

export type {
  DynamicEntity,
  DynamicEntityType,
  DynamicAttributeDefinition,
  DynamicAttributeValue,
  DynamicRelationshipType,
  DynamicEntityRelationship,
  DynamicStepDefinition,
  DynamicEntityStep,
} from './dynamic';

export default Buyer;
