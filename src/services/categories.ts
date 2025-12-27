import { executeSql } from './database';
import { Category } from '../types';

export async function getAllCategories(): Promise<Category[]> {
  return executeSql<Category>('SELECT * FROM categories ORDER BY name ASC');
}

export async function getCategory(id: string): Promise<Category | null> {
  const rows = await executeSql<Category>('SELECT * FROM categories WHERE id = ?', [id]);
  return rows.length > 0 ? rows[0] : null;
}
