import axios from 'axios';

async function run() {
  const baseURL = 'http://localhost:5000/api/v1';
  
  // 1. Login
  const loginRes = await axios.post(`${baseURL}/auth/login`, {
    email: 'admin@hotel.com',
    password: 'Admin123!',
    secretCode: '123456'
  });
  
  const token = loginRes.data.data.accessToken;
  console.log('Login successful, token length:', token.length);
  
  // 2. Fetch kitchens
  const kitchensRes = await axios.get(`${baseURL}/kitchens?limit=100`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  console.log('Kitchens API Response:', JSON.stringify(kitchensRes.data, null, 2));
}

run().catch(err => {
  console.error('Error:', err.response?.data || err.message);
});
