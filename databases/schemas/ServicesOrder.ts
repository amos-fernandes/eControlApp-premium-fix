export const ServicesOrderSchema = {
  name: "ServicesOrdersList",
  properties: {
    id: "int",
    identifier: "string",
    status: "string",
    service_date: "string",
    customer_id: "int?",
    customer_name: "string?",
    address_text: "string?",
    observations: "string?",
    driver_observations: "string?",
    created_at: "string?",
    vehicle_info: "string?",
    voyage_info: "string?",
  },
  primaryKey: "id",
}
