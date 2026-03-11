// Arquivo mantido para compatibilidade com códigos legados
// Redireciono para a função getDB do database.ts
import { getDB } from './database';

export const getRealm = async () => {
  console.warn("getRealm está depreciado. Use diretamente as funções do database.ts");
  return getDB();
};
