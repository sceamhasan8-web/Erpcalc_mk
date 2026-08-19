import mongoose, { model, models, Schema } from 'mongoose';

const stringRequired = { type: String, required: true };
const stringOptional = { type: String, required: false };
const numberOptional = { type: Number, required: false };

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const BuyerSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('b') },
  name: stringRequired,
  company: stringOptional,
  email: stringOptional,
  phone: stringOptional,
  region: stringOptional,
  tier: { type: String, enum: ['Standard', 'Premium', 'Strategic'], required: false },
  rating: numberOptional,
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const DepartmentSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('dept') },
  name: stringRequired,
  efficiency: numberOptional,
  capacity: numberOptional,
  manpower: numberOptional,
  workingHours: numberOptional,
  productionCapability: numberOptional,
  productionCapabilityPerHour: numberOptional,
  activeOrders: numberOptional,
  completedToday: numberOptional,
  notes: stringOptional,
});

const ArticleSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('art') },
  name: stringRequired,
  code: stringOptional,
  colors: { type: [String], default: [] },
  description: stringOptional,
});

const OrderSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('ord') },
  buyerId: stringRequired,
  orderNumber: stringRequired,
  style: stringOptional,
  quantity: { type: Number, required: true },
  completedQuantity: { type: Number, default: 0 },
  pendingQuantity: { type: Number, default: 0 },
  rejectedQuantity: { type: Number, default: 0 },
  currentDepartment: stringOptional,
  status: { type: String, enum: ['Planned', 'In Progress', 'Completed', 'Delayed', 'Cancelled'], default: 'Planned' },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  startDate: stringOptional,
  eta: stringOptional,
  productionPercentage: { type: Number, default: 0 },
  cost: numberOptional,
  revenue: numberOptional,
  estimatedCompletion: stringOptional,
});

const BuyerOrderSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('bo') },
  orderNumber: stringRequired,
  buyerId: stringRequired,
  buyerName: stringOptional,
  items: { type: [Schema.Types.Mixed], default: [] },
  articleId: stringOptional,
  articleName: stringOptional,
  color: stringOptional,
  quantity: { type: Number, required: true },
  unit: { type: String, required: false },
  deliveryDate: stringOptional,
  createdAt: { type: String, default: () => new Date().toISOString() },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  notes: stringOptional,
  status: { type: String, enum: ['Pending', 'Confirmed', 'In Production', 'Completed'], default: 'Pending' },
  requiredDepartments: { type: [String], default: [] },
  genderCategory: { type: String, enum: ['mens', 'womens', 'both'], required: false },
  sizeBreakdown: { type: Schema.Types.Mixed, default: {} },
  image: stringOptional,
});

const ProductionFlowSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('pf') },
  orderId: stringRequired,
  department: stringRequired,
  processName: stringOptional,
  completed: { type: Number, required: true },
  pending: { type: Number, default: 0 },
  rejected: { type: Number, default: 0 },
  updatedAt: { type: String, default: () => new Date().toISOString() },
  itemId: stringOptional,
  articleName: stringOptional,
  color: stringOptional,
  genderCategory: { type: String, enum: ['mens', 'womens', 'both'], required: false },
  sizeBreakdown: { type: Schema.Types.Mixed, default: {} },
  notes: stringOptional,
});

const FinishedGoodSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('fg') },
  sku: stringRequired,
  item: stringRequired,
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['Ready', 'Packed', 'Reserved', 'Shipped'], required: false },
  orderId: stringOptional,
});

const WarehouseStockSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('ws') },
  sku: stringRequired,
  item: stringRequired,
  quantity: { type: Number, required: true },
  unit: { type: String, required: false },
  unitPrice: numberOptional,
  totalPrice: numberOptional,
  reorderLevel: numberOptional,
  location: stringOptional,
  category: stringOptional,
  orderId: stringOptional,
  orderNumber: stringOptional,
  buyerName: stringOptional,
  articleName: stringOptional,
});

const MaterialReceivalSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('mr') },
  sku: stringRequired,
  item: stringRequired,
  quantity: { type: Number, required: true },
  unit: { type: String, required: false },
  unitPrice: numberOptional,
  totalPrice: numberOptional,
  source: { type: String, enum: ['Buyer', 'Own Purchase'], required: true },
  buyerId: stringOptional,
  buyerName: stringOptional,
  orderId: stringOptional,
  orderNumber: stringOptional,
  articleName: stringOptional,
  location: stringOptional,
  category: stringOptional,
  receivedAt: { type: String, default: () => new Date().toISOString() },
  notes: stringOptional,
});

const NotificationSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('notif') },
  title: stringRequired,
  message: stringRequired,
  read: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const ReportSchema = new Schema({
  id: { type: String, required: true, unique: true, default: () => generateId('rep') },
  title: stringRequired,
  type: stringOptional,
  generatedAt: { type: String, default: () => new Date().toISOString() },
  summary: stringOptional,
  details: stringOptional,
});

const AppSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

export const Buyer = models.Buyer || model('Buyer', BuyerSchema);
export const Department = models.Department || model('Department', DepartmentSchema);
export const Article = models.Article || model('Article', ArticleSchema);
export const Order = models.Order || model('Order', OrderSchema);
export const BuyerOrder = models.BuyerOrder || model('BuyerOrder', BuyerOrderSchema);
export const ProductionFlow = models.ProductionFlow || model('ProductionFlow', ProductionFlowSchema);
export const FinishedGood = models.FinishedGood || model('FinishedGood', FinishedGoodSchema);
export const WarehouseStock = models.WarehouseStock || model('WarehouseStock', WarehouseStockSchema);
export const MaterialReceival = models.MaterialReceival || model('MaterialReceival', MaterialReceivalSchema);
export const Notification = models.Notification || model('Notification', NotificationSchema);
export const Report = models.Report || model('Report', ReportSchema);
export const AppSettings = models.AppSettings || model('AppSettings', AppSettingsSchema);
