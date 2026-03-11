export const LoginSchema = {
  name: "Login",
  properties: {
    _id: "string",
    email: "string",
    name: "string?",
    password: "string?",
    created_at: "date",
  },
  primaryKey: "_id",
}
