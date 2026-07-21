const { z } = require('zod');
const PASSWORD_POLICY = {
  minLength: 8,
  regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
  message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
};

const createKitchenSchema = z.object({
  name: z.string().trim().min(2).max(120),
  owner: z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email(),
      password: z
        .string()
        .min(PASSWORD_POLICY.minLength, PASSWORD_POLICY.message)
        .regex(PASSWORD_POLICY.regex, PASSWORD_POLICY.message),
    })
    .optional(),
});

const data = {
  name: 'Night Diner',
  owner: { name: 'Owner Two', email: 'owner2@example.com', password: 'Str0ng!Pass' },
};

const result = createKitchenSchema.safeParse(data);
console.log(JSON.stringify(result, null, 2));
