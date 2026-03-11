export const EquipamentSchemaCollected = {
  name: "EquipamentCollected",
  properties: {
    id: "int",
    current_customer_id: "string",
    equipment_type: "string",
    current_customer: { type: "object", objectType: "CurrentCustomerCollected" },
    created_at: "date",
  },
  primaryKey: "id",
}

export const CurrentCustomerCollectedSchema = {
  name: "CurrentCustomerCollected",
  properties: {
    name: "string",
  },
}
