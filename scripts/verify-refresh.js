const API_URL = 'http://127.0.0.1:5000/api/v1/auth';

async function testRefreshToken() {
  try {
    console.log('Testing Refresh Token Endpoint...');

    // 1. Register a temporary user
    const email = `test_${Date.now()}@example.com`;
    const password = 'Password123!';
    
    console.log(`Registering user: ${email}`);
    const registerRes = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            password,
            fName: 'Test',
            lName: 'User',
            phone: '1234567890',
            companyName: 'Test Co'
        })
    });

    if (!registerRes.ok) {
        const err = await registerRes.json();
        console.error('Registration failed:', err);
        return;
    }

    const authData = await registerRes.json();
    const { accessToken, refreshToken } = authData.data;
    
    console.log('Registration successful.');
    console.log('Access Token:', accessToken ? 'Received' : 'Missing');
    console.log('Refresh Token:', refreshToken ? 'Received' : 'Missing');

    if (!refreshToken) {
        console.error('FAILED: No refresh token received on register.');
        return;
    }

    // 2. Try to refresh the token
    console.log('Attempting to refresh token...');
    const refreshRes = await fetch(`${API_URL}/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
    });

    if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        console.log('SUCCESS: Token refreshed successfully.');
        console.log('New Access Token:', refreshData.data.accessToken ? 'Received' : 'Missing');
        console.log('New Refresh Token:', refreshData.data.refreshToken ? 'Received' : 'Missing');
    } else {
        const err = await refreshRes.json();
        console.error('FAILED: Token refresh failed.', err);
    }

  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

testRefreshToken();
