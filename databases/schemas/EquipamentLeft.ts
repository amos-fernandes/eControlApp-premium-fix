export const EquipamentSchemaLeft = {
  name: "EquipamentLeft",
  properties: {
    id: "int",
    current_customer_id: "string",
    equipment_type: "string",
    current_customer: { type: "object", objectType: "CurrentCustomerLeft" },
    created_at: "date",
  },
  primaryKey: "id",
}

export const CurrentCustomerLeftSchema = {
  name: "CurrentCustomerLeft",
  properties: {
    name: "string",
  },
}
