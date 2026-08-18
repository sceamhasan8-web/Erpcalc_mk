import { dynamicRepository } from '@/repositories/dynamicRepository';
import type {
  DynamicAttributeDefinition,
  DynamicAttributeValue,
  DynamicEntity,
  DynamicEntityType,
  DynamicEntityRelationship,
  DynamicEntityStep,
  DynamicRelationshipType,
  DynamicStepDefinition,
} from '@/types/dynamic';

export class DynamicEntityService {
  getEntityTypes(): DynamicEntityType[] {
    return dynamicRepository.getEntityTypes();
  }

  createEntityType(payload: Omit<DynamicEntityType, 'id' | 'createdAt' | 'updatedAt'>): DynamicEntityType {
    return dynamicRepository.createEntityType(payload);
  }

  getEntities(): DynamicEntity[] {
    return dynamicRepository.getEntities();
  }

  createEntity(payload: Omit<DynamicEntity, 'id' | 'createdAt' | 'updatedAt'>): DynamicEntity {
    return dynamicRepository.createEntity(payload);
  }

  updateEntity(id: string, changes: Partial<Omit<DynamicEntity, 'id' | 'createdAt'>>): DynamicEntity | null {
    return dynamicRepository.updateEntity(id, changes);
  }

  getAttributeDefinitions(entityTypeId?: string): DynamicAttributeDefinition[] {
    return dynamicRepository.getAttributeDefinitions(entityTypeId);
  }

  createAttributeDefinition(payload: Omit<DynamicAttributeDefinition, 'id' | 'createdAt' | 'updatedAt'>): DynamicAttributeDefinition {
    return dynamicRepository.createAttributeDefinition(payload);
  }

  setAttributeValue(entityId: string, attributeDefinitionId: string, value: string | number | boolean | Date | Record<string, unknown> | unknown[] | null): DynamicAttributeValue {
    return dynamicRepository.setAttributeValue(entityId, attributeDefinitionId, value);
  }

  getAttributesForEntity(entityId: string): Record<string, unknown> {
    const values = dynamicRepository.getAttributeValuesForEntity(entityId);
    return values.reduce((acc, value) => {
      const definition = dynamicRepository.findAttributeDefinitionById(value.attributeDefinitionId);
      if (!definition) return acc;
      acc[definition.name] = this.readValue(value);
      return acc;
    }, {} as Record<string, unknown>);
  }

  findEntity(entityId: string): DynamicEntity | null {
    return dynamicRepository.findEntityById(entityId);
  }

  getRelationshipTypes(): DynamicRelationshipType[] {
    return dynamicRepository.getRelationshipTypes();
  }

  createRelationshipType(payload: Omit<DynamicRelationshipType, 'id' | 'createdAt' | 'updatedAt'>): DynamicRelationshipType {
    return dynamicRepository.createRelationshipType(payload);
  }

  createEntityRelationship(payload: Omit<DynamicEntityRelationship, 'id' | 'createdAt'>): DynamicEntityRelationship {
    return dynamicRepository.createEntityRelationship(payload);
  }

  getStepDefinitions(entityTypeId?: string): DynamicStepDefinition[] {
    return dynamicRepository.getStepDefinitions(entityTypeId);
  }

  createStepDefinition(payload: Omit<DynamicStepDefinition, 'id' | 'createdAt' | 'updatedAt'>): DynamicStepDefinition {
    return dynamicRepository.createStepDefinition(payload);
  }

  createEntityStep(payload: Omit<DynamicEntityStep, 'id'>): DynamicEntityStep {
    return dynamicRepository.createEntityStep(payload);
  }

  private readValue(value: DynamicAttributeValue): unknown {
    if (value.valueJson !== undefined) return value.valueJson;
    if (value.valueBoolean !== undefined) return value.valueBoolean;
    if (value.valueNumber !== undefined) return value.valueNumber;
    if (value.valueDate !== undefined) return value.valueDate;
    if (value.valueString !== undefined) return value.valueString;
    return null;
  }
}

export const dynamicEntityService = new DynamicEntityService();
