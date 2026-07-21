const { createKitchenSchema } = require('./src/modules/kitchen/kitchen.validation');
const data = {
  name: 'Night Diner',
  owner: { name: 'Owner Two', email: 'owner2@example.com', password: 'Str0ng!Pass' },
};

const result = createKitchenSchema.safeParse(data);
console.log(JSON.stringify(result, null, 2));
