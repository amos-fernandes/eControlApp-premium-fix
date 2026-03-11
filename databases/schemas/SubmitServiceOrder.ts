export const SubmitServiceOrderSchema = {
  name: "SubmitService",
  properties: {
    _id: "int",
    collected_equipment_attributes: { type: "list", objectType: "string" },
    driver_observations: "string",
    arrival_date: "string",
    departure_date: "string",
    start_km: "string",
    end_km: "string",
    certificate_memo: "string",
    service_executions: { type: "list", objectType: "services_executions" },
  },
  primaryKey: "_id",
}

export const ServicesExecutionsSchema = {
  name: "services_executions",
  properties: {
    service: { type: "object", objectType: "service_submit" },
  },
}

export const ServiceExecutionSchema = {
  name: "service_submit",
  properties: {
    id: "int",
    amount: "int?",
    service_item_weights: "mixed",
  },
}
