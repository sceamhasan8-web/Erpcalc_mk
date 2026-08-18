import type {
  DynamicAttributeDefinition,
  DynamicAttributeDefinitionId,
  DynamicAttributeValue,
  DynamicAttributeValueId,
  DynamicEntity,
  DynamicEntityId,
  DynamicEntityType,
  DynamicEntityTypeId,
  DynamicRelationshipType,
  DynamicRelationshipTypeId,
  DynamicEntityRelationship,
  DynamicEntityStep,
  DynamicStepDefinition,
  DynamicStepDefinitionId,
  DynamicEntityStepId,
  DynamicDataType,
} from '@/types/dynamic';

const createId = (prefix: string): string => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const nowIso = (): string => new Date().toISOString();

export class DynamicRepository {
  private entityTypes: DynamicEntityType[] = [];
  private entities: DynamicEntity[] = [];
  private attributeDefinitions: DynamicAttributeDefinition[] = [];
  private attributeValues: DynamicAttributeValue[] = [];
  private relationshipTypes: DynamicRelationshipType[] = [];
  private entityRelationships: DynamicEntityRelationship[] = [];
  private stepDefinitions: DynamicStepDefinition[] = [];
  private entitySteps: DynamicEntityStep[] = [];

  getEntityTypes(): DynamicEntityType[] {
    return [...this.entityTypes];
  }

  getEntities(): DynamicEntity[] {
    return [...this.entities];
  }

  getAttributeDefinitions(entityTypeId?: DynamicEntityTypeId): DynamicAttributeDefinition[] {
    if (entityTypeId) {
      return this.attributeDefinitions.filter((def) => def.entityTypeId === entityTypeId || def.entityTypeId === undefined);
    }
    return [...this.attributeDefinitions];
  }

  getAttributeValues(): DynamicAttributeValue[] {
    return [...this.attributeValues];
  }

  getAttributeValuesForEntity(entityId: DynamicEntityId): DynamicAttributeValue[] {
    return this.attributeValues.filter((value) => value.entityId === entityId);
  }

  getRelationshipTypes(): DynamicRelationshipType[] {
    return [...this.relationshipTypes];
  }

  getEntityRelationships(entityId?: DynamicEntityId): DynamicEntityRelationship[] {
    if (!entityId) return [...this.entityRelationships];
    return this.entityRelationships.filter((relationship) => relationship.sourceEntityId === entityId || relationship.targetEntityId === entityId);
  }

  getStepDefinitions(entityTypeId?: DynamicEntityTypeId): DynamicStepDefinition[] {
    if (entityTypeId) {
      return this.stepDefinitions.filter((step) => step.entityTypeId === entityTypeId || step.entityTypeId === undefined);
    }
    return [...this.stepDefinitions];
  }

  getEntitySteps(entityId?: DynamicEntityId): DynamicEntityStep[] {
    if (!entityId) return [...this.entitySteps];
    return this.entitySteps.filter((step) => step.entityId === entityId);
  }

  createEntityType(payload: Omit<DynamicEntityType, 'id' | 'createdAt' | 'updatedAt'>): DynamicEntityType {
    const entityType: DynamicEntityType = {
      id: createId('et'),
      ...payload,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.entityTypes.push(entityType);
    return entityType;
  }

  updateEntityType(id: DynamicEntityTypeId, changes: Partial<Omit<DynamicEntityType, 'id' | 'createdAt'>>): DynamicEntityType | null {
    const index = this.entityTypes.findIndex((item) => item.id === id);
    if (index === -1) return null;
    this.entityTypes[index] = { ...this.entityTypes[index], ...changes, updatedAt: nowIso() };
    return this.entityTypes[index];
  }

  deleteEntityType(id: DynamicEntityTypeId): boolean {
    const originalLength = this.entityTypes.length;
    this.entityTypes = this.entityTypes.filter((item) => item.id !== id);
    return this.entityTypes.length < originalLength;
  }

  createEntity(payload: Omit<DynamicEntity, 'id' | 'createdAt' | 'updatedAt'>): DynamicEntity {
    const entity: DynamicEntity = {
      id: createId('ent'),
      ...payload,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.entities.push(entity);
    return entity;
  }

  updateEntity(id: DynamicEntityId, changes: Partial<Omit<DynamicEntity, 'id' | 'createdAt'>>): DynamicEntity | null {
    const index = this.entities.findIndex((entity) => entity.id === id);
    if (index === -1) return null;
    this.entities[index] = { ...this.entities[index], ...changes, updatedAt: nowIso() };
    return this.entities[index];
  }

  deleteEntity(id: DynamicEntityId): boolean {
    const originalLength = this.entities.length;
    this.entities = this.entities.filter((item) => item.id !== id);
    this.attributeValues = this.attributeValues.filter((value) => value.entityId !== id);
    this.entityRelationships = this.entityRelationships.filter((relationship) => relationship.sourceEntityId !== id && relationship.targetEntityId !== id);
    this.entitySteps = this.entitySteps.filter((step) => step.entityId !== id);
    return this.entities.length < originalLength;
  }

  createAttributeDefinition(payload: Omit<DynamicAttributeDefinition, 'id' | 'createdAt' | 'updatedAt'>): DynamicAttributeDefinition {
    const attributeDefinition: DynamicAttributeDefinition = {
      id: createId('ad'),
      ...payload,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.attributeDefinitions.push(attributeDefinition);
    return attributeDefinition;
  }

  updateAttributeDefinition(id: DynamicAttributeDefinitionId, changes: Partial<Omit<DynamicAttributeDefinition, 'id' | 'createdAt'>>): DynamicAttributeDefinition | null {
    const index = this.attributeDefinitions.findIndex((item) => item.id === id);
    if (index === -1) return null;
    this.attributeDefinitions[index] = { ...this.attributeDefinitions[index], ...changes, updatedAt: nowIso() };
    return this.attributeDefinitions[index];
  }

  deleteAttributeDefinition(id: DynamicAttributeDefinitionId): boolean {
    const originalLength = this.attributeDefinitions.length;
    this.attributeDefinitions = this.attributeDefinitions.filter((item) => item.id !== id);
    this.attributeValues = this.attributeValues.filter((value) => value.attributeDefinitionId !== id);
    return this.attributeDefinitions.length < originalLength;
  }

  setAttributeValue(
    entityId: DynamicEntityId,
    attributeDefinitionId: DynamicAttributeDefinitionId,
    value: string | number | boolean | Date | Record<string, unknown> | unknown[] | null,
  ): DynamicAttributeValue {
    const definition = this.attributeDefinitions.find((def) => def.id === attributeDefinitionId);
    if (!definition) {
      throw new Error(`Attribute definition '${attributeDefinitionId}' not found.`);
    }

    const existingIndex = this.attributeValues.findIndex(
      (item) => item.entityId === entityId && item.attributeDefinitionId === attributeDefinitionId,
    );

    const normalized = this.normalizeValue(value, definition.dataType);
    const attributeValue: DynamicAttributeValue = {
      id: existingIndex >= 0 ? this.attributeValues[existingIndex].id : createId('av'),
      entityId,
      attributeDefinitionId,
      ...normalized,
      createdAt: existingIndex >= 0 ? this.attributeValues[existingIndex].createdAt : nowIso(),
      updatedAt: nowIso(),
    };

    if (existingIndex >= 0) {
      this.attributeValues[existingIndex] = attributeValue;
    } else {
      this.attributeValues.push(attributeValue);
    }

    return attributeValue;
  }

  private normalizeValue(value: string | number | boolean | Date | Record<string, unknown> | unknown[] | null, dataType: DynamicDataType) {
    const field: Partial<DynamicAttributeValue> = {};
    if (value === null || value === undefined) {
      return field;
    }

    switch (dataType) {
      case 'number':
        field.valueNumber = typeof value === 'number' ? value : Number(value as string);
        break;
      case 'boolean':
        field.valueBoolean = typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';
        break;
      case 'date':
        field.valueDate = value instanceof Date ? value.toISOString() : String(value);
        break;
      case 'json':
        field.valueJson = typeof value === 'object' ? (value as Record<string, unknown> | unknown[]) : { raw: value };
        break;
      default:
        field.valueString = String(value);
        break;
    }

    return field;
  }

  findEntityById(id: DynamicEntityId): DynamicEntity | null {
    return this.entities.find((item) => item.id === id) ?? null;
  }

  findAttributeDefinitionById(id: DynamicAttributeDefinitionId): DynamicAttributeDefinition | null {
    return this.attributeDefinitions.find((item) => item.id === id) ?? null;
  }

  createRelationshipType(payload: Omit<DynamicRelationshipType, 'id' | 'createdAt' | 'updatedAt'>): DynamicRelationshipType {
    const relationshipType: DynamicRelationshipType = {
      id: createId('rt'),
      ...payload,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.relationshipTypes.push(relationshipType);
    return relationshipType;
  }

  createEntityRelationship(payload: Omit<DynamicEntityRelationship, 'id' | 'createdAt'>): DynamicEntityRelationship {
    const relationship: DynamicEntityRelationship = {
      id: createId('rel'),
      ...payload,
      createdAt: nowIso(),
    };
    this.entityRelationships.push(relationship);
    return relationship;
  }

  createStepDefinition(payload: Omit<DynamicStepDefinition, 'id' | 'createdAt' | 'updatedAt'>): DynamicStepDefinition {
    const stepDefinition: DynamicStepDefinition = {
      id: createId('sd'),
      ...payload,
      active: payload.active ?? true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.stepDefinitions.push(stepDefinition);
    return stepDefinition;
  }

  createEntityStep(payload: Omit<DynamicEntityStep, 'id'>): DynamicEntityStep {
    const entityStep: DynamicEntityStep = {
      id: createId('es'),
      ...payload,
    };
    this.entitySteps.push(entityStep);
    return entityStep;
  }
}

export const dynamicRepository = new DynamicRepository();
