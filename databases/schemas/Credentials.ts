export const CredentialsSchema = {
  name: "Credentials",
  properties: {
    _id: "string",
    accessToken: "string",
    uid: "string",
    client: "string",
    created_at: "date",
  },
  primaryKey: "_id",
}
