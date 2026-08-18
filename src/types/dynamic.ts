export type DynamicEntityId = string;
export type DynamicEntityTypeId = string;
export type DynamicAttributeDefinitionId = string;
export type DynamicAttributeValueId = string;
export type DynamicRelationshipTypeId = string;
export type DynamicRelationshipId = string;
export type DynamicStepDefinitionId = string;
export type DynamicEntityStepId = string;

export type DynamicEntityStatus = 'Active' | 'Inactive' | 'Archived' | 'Draft' | string;
export type DynamicDataType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'enum' | 'reference';

export interface DynamicEntityType {
  id: DynamicEntityTypeId;
  name: string;
  description?: string;
  parentTypeId?: DynamicEntityTypeId;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamicEntity {
  id: DynamicEntityId;
  entityTypeId: DynamicEntityTypeId;
  externalKey?: string;
  status?: DynamicEntityStatus;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamicAttributeOption {
  value: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface DynamicAttributeDefinition {
  id: DynamicAttributeDefinitionId;
  entityTypeId?: DynamicEntityTypeId; // null / undefined = global attribute
  name: string;
  label?: string;
  description?: string;
  dataType: DynamicDataType;
  required?: boolean;
  defaultValue?: unknown;
  validationRules?: Record<string, unknown>;
  options?: DynamicAttributeOption[];
  isSearchable?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamicAttributeValue {
  id: DynamicAttributeValueId;
  entityId: DynamicEntityId;
  attributeDefinitionId: DynamicAttributeDefinitionId;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueJson?: Record<string, unknown> | unknown[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamicRelationshipType {
  id: DynamicRelationshipTypeId;
  name: string;
  description?: string;
  sourceEntityTypeId?: DynamicEntityTypeId;
  targetEntityTypeId?: DynamicEntityTypeId;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamicEntityRelationship {
  id: DynamicRelationshipId;
  sourceEntityId: DynamicEntityId;
  targetEntityId: DynamicEntityId;
  relationshipTypeId: DynamicRelationshipTypeId;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface DynamicStepDefinition {
  id: DynamicStepDefinitionId;
  entityTypeId?: DynamicEntityTypeId;
  name: string;
  description?: string;
  sequence?: number;
  type?: string;
  metadata?: Record<string, unknown>;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamicEntityStep {
  id: DynamicEntityStepId;
  entityId: DynamicEntityId;
  stepDefinitionId: DynamicStepDefinitionId;
  status?: string;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type DynamicEntityAttributePayload = Record<string, string | number | boolean | null | unknown>;
